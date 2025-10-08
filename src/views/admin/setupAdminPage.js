import { api as viewerApi } from 'v-viewer';
import Toastify from 'toastify-js';
import {
  STATUS_DELIVERY_VALUES,
  DN_SCAN_STATUS_DELIVERY_VALUES,
  STATUS_DELIVERY_DISPLAY_OVERRIDES,
  DN_SCAN_STATUS_DELIVERY_ITEMS,
} from '../../config.js';
import { getApiBase, getMapboxAccessToken } from '../../utils/env.js';

import { createDnEntryManager } from './dnEntry.js';
import { createStatusDeliveryCardManager } from './statusCards.js';
import { createLspSummaryCardManager } from './lspSummaryCards.js';
import { createFilterBridgeManager } from './filterBridgeManager.js';
import { createAuthHandler } from './authHandler.js';
import { getTodayDateStringInTimezone } from './dateUtils.js';
import {
  escapeHtml,
  setFormControlValue,
  lockBodyScroll,
  unlockBodyScroll,
  resetBodyScrollLock,
} from './utils.js';
import { createTableRenderer } from './tableRenderer.js';

import {
  TRANSPORT_MANAGER_ROLE_KEY,
  STATUS_DELIVERY_VALUE_TO_KEY,
  STATUS_DELIVERY_ALIAS_LOOKUP,
  STATUS_DELIVERY_KNOWN_VALUES,
  STATUS_DELIVERY_NOT_EMPTY_VALUE,
  STATUS_DELIVERY_ANY_VALUE,
  DEFAULT_STATUS_DELIVERY_VALUE,
  PLAN_MOS_TIME_ZONE,
  PLAN_MOS_TIMEZONE_OFFSET_MINUTES,
  JAKARTA_UTC_OFFSET_MINUTES,
  ARCHIVE_THRESHOLD_DAYS,
  TRANSPORT_MANAGER_STATUS_DELIVERY_CARDS,
  STATUS_SITE_OPTIONS,
  DEFAULT_MODAL_STATUS_DELIVERY_ORDER,
  DN_DETAIL_KEYS,
  ICON_MARKUP,
} from './constants.js';

const SCAN_STATUS_META = new Map(
  (DN_SCAN_STATUS_DELIVERY_ITEMS || []).map((item) => [item.value, item])
);

const API_BASE = getApiBase();

export function setupAdminPage(
  rootEl,
  {
    i18n,
    applyTranslations,
    planMosDateSelect,
    filterSelects,
    filterInputs,
    onRoleChange,
  } = {}
) {
  if (!rootEl) return () => {};

  const controller = new AbortController();
  const { signal } = controller;

  const el = (id) => rootEl.querySelector(`#${id}`);

  const {
    getFilterValues,
    getSingleFilterValue,
    getDateFilterValue,
    setFilterDropdownOptions,
    setFilterValue,
    getInputValue,
    setInputValue,
    subscribeToFilterChange,
    cleanupSubscriptions: cleanupFilterSubscriptions,
  } = createFilterBridgeManager({
    filterSelects,
    filterInputs,
    planMosDateSelect,
  });

  const dnInput = el('f-dn');
  const dnPreview = el('dn-preview');
  const tbl = el('tbl');
  const tbody = tbl?.querySelector('tbody');
  const actionsHeader = tbl?.querySelector('thead th[data-column="actions"]');
  const updatedAtHeader = tbl?.querySelector('thead th[data-column="updatedAt"]');
  const hint = el('hint');
  const pager = el('pager');
  const pginfo = el('pginfo');

  const hasSelect = el('f-has');
  const hasSelectField = hasSelect ? hasSelect.closest('.field') : null;
  const pageSizeInput = el('f-ps2');

  const mask = el('modal-mask');
  const mId = el('modal-id');
  const mStatus = el('m-status');
  const mStatusSite = el('m-status-site');
  const mStatusSiteField = el('m-status-site-field');
  const mRemark = el('m-remark');
  const mRemarkField = el('m-remark-field');
  const mPhoto = el('m-photo');
  const mPhotoField = el('m-photo-field');
  const mMsg = el('m-msg');

  const authModal = el('auth-modal');
  const authBtn = el('btn-auth');
  const authCancel = el('auth-cancel');
  const authConfirm = el('auth-confirm');
  const authInput = el('auth-password');
  const authMsg = el('auth-msg');
  const authRoleTag = el('auth-role-tag');

  const statusCardWrapper = el('status-card-wrapper');
  const statusCardContainer = el('status-card-container');
  const lspSummaryWrapper = el('lsp-summary-card-wrapper');
  const lspSummaryContainer = el('lsp-summary-card-container');

  const dnBtn = el('btn-dn-entry');
  const dnModal = el('dn-modal');
  const dnEntryInput = el('dn-input');
  const dnEntryPreview = el('dn-preview-modal');
  const dnClose = el('dn-close');
  const dnCancel = el('dn-cancel');
  const dnConfirm = el('dn-confirm');
  const archiveExpiredDnBtn = el('btn-archive-expired-dn');

  const updateHistoryModal = el('update-history-modal');
  const historyDnNumber = el('history-dn-number');
  const historyContent = el('history-content');
  const historyOk = el('history-ok');

  let editingId = 0;
  let editingItem = null;
  let removeI18nListener = null;
  let tableRenderer = null;

  // 初始化授权处理器
  const authHandler = createAuthHandler({
    authModal,
    authBtn,
    authCancel,
    authConfirm,
    authInput,
    authMsg,
    authRoleTag,
    signal,
    i18n,
    showToast,
    onRoleChange,
    onRoleApplied: handleAuthRoleApplied,
    onAuthSuccess: (role, userInfo) => {
      // 授权成功后刷新列表
      fetchList();
    },
  });

  function getEffectiveUserInfo() {
    try {
      return authHandler?.getCurrentUserInfo?.() || null;
    } catch (err) {
      console.error('Failed to resolve user info:', err);
      return null;
    }
  }

  function convertDateToJakartaIso(dateString, { endOfDay = false } = {}) {
    if (!dateString) return '';

    const parts = String(dateString).split('-');
    if (parts.length < 3) {
      return formatDateFallback(dateString, { endOfDay });
    }

    const [yearPart, monthPart, dayPart] = parts;
    const year = Number(yearPart);
    const monthIndex = Number(monthPart) - 1;
    const day = Number(dayPart);

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(monthIndex) ||
      !Number.isFinite(day)
    ) {
      return formatDateFallback(dateString, { endOfDay });
    }

    // 统一将起止日期固定到雅加达中午，避免在不同时区展示或解析时日期被偏移。
    const hours = 12;
    const minutes = 0;
    const seconds = 0;
    const milliseconds = 0;

    const offsetMinutes = Number.isFinite(JAKARTA_UTC_OFFSET_MINUTES)
      ? JAKARTA_UTC_OFFSET_MINUTES
      : 0;

    const utcTimestamp =
      Date.UTC(year, monthIndex, day, hours, minutes, seconds, milliseconds) -
      offsetMinutes * 60 * 1000;

    return new Date(utcTimestamp).toISOString();
  }

  function formatDateFallback(dateString, _opts = {}) {
    const suffix = 'T12:00:00';
    const value = new Date(`${dateString}${suffix}`);
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
    return value.toISOString();
  }

  function formatTimestampToJakarta(timestamp) {
    if (!timestamp) return '';
    
    let date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return '';
    }
    
    if (Number.isNaN(date.getTime())) return '';
    
    // 转换为雅加达时间 (UTC+7)
    const jakartaOffset = JAKARTA_UTC_OFFSET_MINUTES || 420; // 默认 420 分钟 = 7 小时
    const utcTime = date.getTime();
    const jakartaTime = new Date(utcTime + jakartaOffset * 60 * 1000);
    
    const year = jakartaTime.getUTCFullYear();
    const month = String(jakartaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jakartaTime.getUTCDate()).padStart(2, '0');
    const hours = String(jakartaTime.getUTCHours()).padStart(2, '0');
    const minutes = String(jakartaTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(jakartaTime.getUTCSeconds()).padStart(2, '0');
    
    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
  }

  // 使用 STATUS_DELIVERY_VALUES 作为 status_delivery 值，label 也使用同样的值以保持一致性
  // 实际显示文本会通过 i18n 系统翻译
  setFilterValue('status_delivery', DEFAULT_STATUS_DELIVERY_VALUE);

  function getIconMarkup(name) {
    return ICON_MARKUP[name] || '';
  }

  function hideHasAttachmentFilter() {
    if (hasSelect) {
      hasSelect.value = '';
      hasSelect.setAttribute('aria-hidden', 'true');
    }
    if (hasSelectField) {
      hasSelectField.style.display = 'none';
      hasSelectField.setAttribute('aria-hidden', 'true');
      const label = hasSelectField.querySelector('label');
      if (label) {
        label.setAttribute('aria-hidden', 'true');
      }
    }
  }

  const q = {
    page: 1,
    page_size: 20,
    mode: 'single',
    lastParams: '',
    show_deleted: false,
  };

  function getNormalizedPageSize() {
    const fallback = 20;
    if (!pageSizeInput) return fallback;
    const raw = Number(pageSizeInput.value);
    if (!Number.isFinite(raw) || raw <= 0) {
      setFormControlValue(pageSizeInput, String(fallback));
      return fallback;
    }
    const normalized = Math.min(1000, Math.max(1, Math.floor(raw)));
    if (String(normalized) !== String(pageSizeInput.value)) {
      setFormControlValue(pageSizeInput, String(normalized));
    }
    return normalized;
  }

  function buildSearchUrl(paramInput, mode = q.mode) {
    const params =
      typeof paramInput === 'string'
        ? paramInput
        : paramInput && typeof paramInput.toString === 'function'
        ? paramInput.toString()
        : '';
    const basePath =
      mode === 'batch' ? '/api/dn/list/batch?' : '/api/dn/list/search?';
    return `${API_BASE}${basePath}${params}`;
  }

  function showToast(text, type = 'info') {
    const backgroundColor =
      type === 'success'
        ? '#16a34a'
        : type === 'error'
        ? '#dc2626'
        : '#0f172a';
    Toastify({
      text,
      duration: 3000,
      gravity: 'bottom',
      position: 'center',
      stopOnFocus: true,
      style: { background: backgroundColor },
    }).showToast();
  }

  function getCurrentRole() {
    return authHandler.getCurrentRole();
  }

  function getCurrentPermissions() {
    return getCurrentRole()?.permissions || null;
  }

  function isTransportManagerRole(roleKey) {
    const key = roleKey !== undefined ? roleKey : authHandler.getCurrentRoleKey();
    return key === TRANSPORT_MANAGER_ROLE_KEY;
  }

  const dnEntry = createDnEntryManager({
    dnInput,
    dnPreview,
    dnBtn,
    dnModal,
    dnEntryInput,
    dnEntryPreview,
    dnClose,
    dnCancel,
    dnConfirm,
    signal,
    i18n,
    API_BASE,
    showToast,
    getCurrentPermissions,
    getCurrentRoleKey: () => authHandler.getCurrentRoleKey(),
    fetchList,
  });

  const lspSummaryCards = createLspSummaryCardManager({
    container: lspSummaryContainer,
    wrapper: lspSummaryWrapper,
    signal,
    getActiveLspValues: () => getFilterValues('lsp'),
    onCardClick(item) {
      if (!item || !item.lsp) return;
      applyLspSummaryCardFilter(item.lsp);
      lspSummaryCards.updateActiveState();
    },
  });

  const statusCards = createStatusDeliveryCardManager({
    container: statusCardContainer,
    wrapper: statusCardWrapper,
    signal,
    API_BASE,
    i18n,
    getCurrentRole,
    normalizeStatusDeliveryValue,
    i18nStatusDisplay,
  getStatusSiteValues: () => getFilterValues('status_site'),
  getStatusDeliveryFilterValue: () => getSingleFilterValue('status_delivery'),
    transportManagerCards: TRANSPORT_MANAGER_STATUS_DELIVERY_CARDS,
    onApplyFilter(def, canonicalStatus) {
      applyStatusCardFilter(def, canonicalStatus);
      statusCards.updateActiveState();
      q.page = 1;
      fetchList();
    },
    onStatsFetched(stats) {
      const summary = Array.isArray(stats?.lspSummary)
        ? stats.lspSummary
        : [];
      lspSummaryCards.setData(summary);
      lspSummaryCards.updateActiveState();
    },
    onLoadingChange(isLoading) {
      lspSummaryCards.setLoading(isLoading);
    },
  });

  // 授权相关函数已移至 authHandler.js

  function normalizeStatusDeliveryValue(raw) {
    const text = (raw || '').trim();
    if (!text) return '';
    const alias = STATUS_DELIVERY_ALIAS_LOOKUP[text];
    if (alias) return alias;
    if (STATUS_DELIVERY_KNOWN_VALUES.has(text)) return text;
    const upper = text.toUpperCase();
    if (STATUS_DELIVERY_KNOWN_VALUES.has(upper)) return upper;
    return text;
  }

  function i18nStatusDisplay(value) {
    const canonical = normalizeStatusDeliveryValue(value);
    const override =
      (STATUS_DELIVERY_DISPLAY_OVERRIDES && STATUS_DELIVERY_DISPLAY_OVERRIDES[canonical]) ||
      (STATUS_DELIVERY_DISPLAY_OVERRIDES && STATUS_DELIVERY_DISPLAY_OVERRIDES[value]);
    if (override) return override;
    const key = STATUS_DELIVERY_VALUE_TO_KEY[canonical] || STATUS_DELIVERY_VALUE_TO_KEY[value];
    if (key && i18n) {
      try {
        const translated = i18n.t(key);
        if (translated && translated !== key) return translated;
      } catch (err) {
        console.error(err);
      }
    }
    return canonical || value || '';
  }

  function translateInstant(key, fallback = '') {
    if (!i18n) return fallback;
    try {
      const translated = i18n.t(key);
      if (translated && translated !== key) return translated;
    } catch (err) {
      console.error(err);
    }
    return fallback;
  }

  function normalizeTextValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    try {
      return String(value).trim();
    } catch (err) {
      console.error(err);
    }
    return '';
  }

  function applyAllTranslations() {
    if (typeof applyTranslations === 'function') {
      applyTranslations();
    }
    if (tableRenderer) {
      tableRenderer.translateStatusCells();
      tableRenderer.updateDetailSaveButtonLabels();
    }
    authHandler.refreshLabels();
    statusCards.updateLabels();
    statusCards.updateActiveState();
    lspSummaryCards.updateActiveState();
    refreshDnEntryVisibility();
    populateModalStatusOptions(mStatus?.value || '');
  populateModalStatusSiteOptions(mStatusSite?.value || '');
    dnEntry.renderFilterPreview();
  }

  if (i18n && typeof i18n.onChange === 'function') {
    removeI18nListener = i18n.onChange(() => {
      applyAllTranslations();
    });
  }

  function handleAuthRoleApplied(_roleKey, _role, _userInfo) {
    refreshDnEntryVisibility();
    populateModalStatusOptions(mStatus?.value || '');
  populateModalStatusSiteOptions(mStatusSite?.value || '');
    updateModalFieldVisibility();
    if (tableRenderer) {
      tableRenderer.updateActionColumnVisibility();
      tableRenderer.rerenderTableActions();
    }
    statusCards.render();
    statusCards.refreshCounts();
    lspSummaryCards.updateActiveState();
  }

  function updateModalFieldVisibility() {
    const perms = getCurrentPermissions();
    const allowRemark = Boolean(perms?.allowRemark);
    const allowPhoto = Boolean(perms?.allowPhoto);
    const allowStatusSite = Boolean(perms?.canEdit);

    if (mStatusSiteField) {
      mStatusSiteField.style.display = allowStatusSite ? '' : 'none';
    }
    if (mStatusSite) {
      mStatusSite.disabled = !allowStatusSite;
      if (!allowStatusSite) {
        setFormControlValue(mStatusSite, '');
      }
    }

    if (mRemarkField) {
      mRemarkField.style.display = allowRemark ? '' : 'none';
    }
    if (mRemark) {
      mRemark.disabled = !allowRemark;
    }
    if (mPhotoField) {
      mPhotoField.style.display = allowPhoto ? '' : 'none';
    }
    if (mPhoto) {
      mPhoto.disabled = !allowPhoto;
      if (!allowPhoto) {
        try {
          mPhoto.value = '';
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  function getModalStatusLabel(value) {
    const canonical = normalizeStatusDeliveryValue(value);
    if (!canonical) return '';
    const meta = SCAN_STATUS_META.get(canonical);
    if (meta) {
      const translated = translateInstant(meta.filterLabelKey, meta.fallbackLabel || canonical);
      if (translated) return translated;
    }
    const label = i18nStatusDisplay(canonical);
    if (label) return label;
    return canonical;
  }

  function populateModalStatusOptions(selected) {
    if (!mStatus) return;
    const perms = getCurrentPermissions();
    const rawAllowed = Array.isArray(perms?.statusOptions)
      ? perms.statusOptions
      : [];
    const baseList = rawAllowed.length ? rawAllowed : DEFAULT_MODAL_STATUS_DELIVERY_ORDER;
    const seen = new Set();
    const normalized = [];

    baseList.forEach((value) => {
      const canonical = normalizeStatusDeliveryValue(value);
      if (!canonical || seen.has(canonical)) return;
      seen.add(canonical);
      normalized.push(canonical);
    });

    const ordered = [];
    DEFAULT_MODAL_STATUS_DELIVERY_ORDER.forEach((value) => {
      if (seen.has(value)) {
        ordered.push(value);
        seen.delete(value);
      }
    });
    normalized.forEach((value) => {
      if (seen.has(value)) {
        ordered.push(value);
        seen.delete(value);
      }
    });

    if (!ordered.length) {
      ordered.push(...DEFAULT_MODAL_STATUS_DELIVERY_ORDER);
    }

    const selectedRaw = selected || '';
    const selectedCanonical = normalizeStatusDeliveryValue(selectedRaw);
    if (selectedCanonical && !ordered.includes(selectedCanonical)) {
      ordered.push(selectedCanonical);
    }

  const keepLabel = i18n?.t('modal.status_delivery.keep') || '（不修改）';
    mStatus.innerHTML = '';
    const keepOption = document.createElement('option');
    keepOption.value = '';
  keepOption.setAttribute('data-i18n', 'modal.status_delivery.keep');
    keepOption.textContent = keepLabel;
    mStatus.appendChild(keepOption);

    const appended = new Set();
    ordered.forEach((value) => {
      const canonical = normalizeStatusDeliveryValue(value);
      if (!canonical || appended.has(canonical)) return;
      appended.add(canonical);
      const opt = document.createElement('option');
      opt.value = canonical;
      opt.textContent = getModalStatusLabel(canonical);
      if (canonical === selectedCanonical) {
        opt.selected = true;
      }
      mStatus.appendChild(opt);
    });

    if (selectedCanonical && !appended.has(selectedCanonical)) {
      const opt = document.createElement('option');
      opt.value = selectedCanonical;
      opt.textContent = getModalStatusLabel(selectedCanonical);
      opt.selected = true;
      mStatus.appendChild(opt);
      appended.add(selectedCanonical);
    }

    if (selectedCanonical) {
      mStatus.value = selectedCanonical;
    } else {
      mStatus.value = '';
    }
  }

  function populateModalStatusSiteOptions(selected) {
    if (!mStatusSite) return;
    const selectedRaw = selected || '';
    const selectedCanonical = normalizeStatusDeliveryValue(selectedRaw);
    const keepLabel = i18n?.t('modal.statusSite.keep') || '（不修改）';

    mStatusSite.innerHTML = '';
    const keepOption = document.createElement('option');
    keepOption.value = '';
    keepOption.setAttribute('data-i18n', 'modal.statusSite.keep');
    keepOption.textContent = keepLabel;
    mStatusSite.appendChild(keepOption);

    const appended = new Set();
    STATUS_SITE_OPTIONS.forEach((value) => {
      const canonical = normalizeStatusDeliveryValue(value);
      if (!canonical || appended.has(canonical)) return;
      appended.add(canonical);
      const opt = document.createElement('option');
      opt.value = canonical;
      opt.textContent = getModalStatusLabel(canonical);
      if (canonical === selectedCanonical) {
        opt.selected = true;
      }
      mStatusSite.appendChild(opt);
    });

    if (selectedCanonical && !appended.has(selectedCanonical)) {
      const opt = document.createElement('option');
      opt.value = selectedCanonical;
      opt.textContent = getModalStatusLabel(selectedCanonical);
      opt.selected = true;
      mStatusSite.appendChild(opt);
      appended.add(selectedCanonical);
    }

    if (selectedCanonical) {
      setFormControlValue(mStatusSite, selectedCanonical);
    } else {
      setFormControlValue(mStatusSite, '');
    }
  }

  function syncStatusSiteWithStatus() {
    if (!mStatus || !mStatusSite) return;
    const canonicalStatus = normalizeStatusDeliveryValue(mStatus.value);
    if (!canonicalStatus) {
      setFormControlValue(mStatusSite, '');
      return;
    }
    if (canonicalStatus === DN_SCAN_STATUS_DELIVERY_VALUES.ARRIVED_AT_WH) {
      setFormControlValue(mStatusSite, '');
      return;
    }

    const ARRIVED_AT_SITE = DN_SCAN_STATUS_DELIVERY_VALUES.ARRIVED_AT_SITE;
    const POD_STATUS = DN_SCAN_STATUS_DELIVERY_VALUES.POD || 'POD';
    const podSiteValue = STATUS_DELIVERY_VALUES.POD || POD_STATUS;

    const statusSiteMap = {
      [ARRIVED_AT_SITE]: STATUS_DELIVERY_VALUES.ON_SITE,
      [POD_STATUS]: podSiteValue,
    };

    const nextValue = statusSiteMap[canonicalStatus] || STATUS_DELIVERY_VALUES.ON_THE_WAY;
    setFormControlValue(mStatusSite, nextValue);
  }

  if (mStatus && mStatusSite) {
    mStatus.addEventListener(
      'change',
      () => {
        syncStatusSiteWithStatus();
      },
      { signal }
    );
  }

  function refreshDnEntryVisibility() {
    dnEntry.refreshVisibility();
    if (!archiveExpiredDnBtn) return;
    const visible = isTransportManagerRole();
    archiveExpiredDnBtn.style.display = visible ? '' : 'none';
    archiveExpiredDnBtn.setAttribute('aria-hidden', visible ? 'false' : 'true');
    archiveExpiredDnBtn.disabled = !visible;
  }

  function applyLspSummaryCardFilter(lspName) {
    const normalizedLsp = normalizeTextValue(lspName);
    if (!normalizedLsp) return;
  resetAllFilters();
    const todayJakarta = getTodayDateStringInTimezone(
      PLAN_MOS_TIME_ZONE,
      PLAN_MOS_TIMEZONE_OFFSET_MINUTES,
      'dd MMM yy'
    );
    setFilterValue('plan_mos_date', todayJakarta);
    setFilterValue('lsp', normalizedLsp);
    statusCards.updateActiveState();
    lspSummaryCards.updateActiveState();
    q.page = 1;
    fetchList();
  }

  function applyStatusCardFilter(def, canonicalStatus) {
  const targetStatus = def?.type === 'status_delivery' ? canonicalStatus : '';
    const todayJakarta = getTodayDateStringInTimezone(
      PLAN_MOS_TIME_ZONE,
      PLAN_MOS_TIMEZONE_OFFSET_MINUTES,
      'dd MMM yy'
    );

    setInputValue('remark', '');
    setFormControlValue(hasSelect, '');
    setFilterValue('has_coordinate', '');
    setFilterValue('date_from', '');
    setFilterValue('date_to', '');
    setInputValue('du', '');

    setFilterValue('lsp', '');
    setFilterValue('region', '');
    setFilterValue('subcon', '');
    setFilterValue('status_wh', '');

  // Clicking a status card应该只应用 status_site 筛选。
  // 保持 status_delivery 筛选为空，避免查询被 status_delivery 限制。
  setFilterValue('status_delivery', '');

  setFilterValue('status_site', targetStatus);

    setFilterValue('plan_mos_date', todayJakarta);

    if (dnInput) {
      dnInput.value = '';
      dnEntry.normalizeFilterInput({ enforceFormat: false });
    }
  }

  // 本地表格渲染逻辑已移除，统一由 tableRenderer 管理

  async function fetchFilterCandidates() {
    try {
      const resp = await fetch(`${API_BASE}/api/dn/filters`, { signal });
      const text = await resp.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (err) {
        console.error(err);
      }
      if (!resp.ok) {
        throw new Error((data && (data.detail || data.message)) || `HTTP ${resp.status}`);
      }

      const payload = data?.data && typeof data.data === 'object' ? data.data : data;
      setFilterDropdownOptions('lsp', payload?.lsp);
      setFilterDropdownOptions('region', payload?.region);
      setFilterDropdownOptions('plan_mos_date', payload?.plan_mos_date);
      setFilterDropdownOptions('subcon', payload?.subcon);
      setFilterDropdownOptions('status_wh', payload?.status_wh);
  const siteOptions = payload?.status_site;
  setFilterDropdownOptions('status_site', siteOptions);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('Failed to load DN filter options', err);
    }
  }

  function buildParamsAuto() {
    const params = new URLSearchParams();
    const tokens = dnEntry.normalizeFilterInput({ enforceFormat: false });
    const ps = getNormalizedPageSize();
    q.page_size = ps;

    if (tokens.length > 1) {
      tokens.forEach((token) => params.append('dn_number', token));
      q.mode = 'batch';
    } else {
      q.mode = 'single';
  const st = getSingleFilterValue('status_delivery');
      const rk = getInputValue('remark').trim();
      const hp = hasSelect?.value;
      const hc = getSingleFilterValue('has_coordinate');
      const df = getDateFilterValue('date_from');
      const dt = getDateFilterValue('date_to');
      const du = getInputValue('du').trim();
      const lspValues = getFilterValues('lsp');
      const regionValues = getFilterValues('region');
      const planMosDateTokens = getFilterValues('plan_mos_date');
      const subconValues = getFilterValues('subcon');
      const statusWhValues = getFilterValues('status_wh');
  const statusSiteValues = getFilterValues('status_site');

      if (tokens.length === 1) params.set('dn_number', tokens[0]);
      if (du) params.set('du_id', du.toUpperCase());
      if (st === STATUS_DELIVERY_NOT_EMPTY_VALUE) {
        params.set('status_not_empty', 'true');
      } else if (st) {
  params.set('status_delivery', st);
      }
      if (rk) params.set('remark', rk);
      if (hp) params.set('has_photo', hp);
      if (hc) params.set('has_coordinate', hc);
      if (df) {
        const jakartaDateFrom = convertDateToJakartaIso(df);
        if (jakartaDateFrom) params.set('date_from', jakartaDateFrom);
      }
      if (dt) {
        const jakartaDateTo = convertDateToJakartaIso(dt, { endOfDay: true });
        if (jakartaDateTo) params.set('date_to', jakartaDateTo);
      }
      if (lspValues.length === 1) {
        params.set('lsp', lspValues[0]);
      } else if (lspValues.length > 1) {
        lspValues.forEach((value) => params.append('lsp', value));
      }
      if (regionValues.length === 1) {
        params.set('region', regionValues[0]);
      } else if (regionValues.length > 1) {
        regionValues.forEach((value) => params.append('region', value));
      }
      if (planMosDateTokens.length === 1) {
        params.set('date', planMosDateTokens[0]);
      } else if (planMosDateTokens.length > 1) {
        planMosDateTokens.forEach((token) => params.append('date', token));
      }
      if (subconValues.length === 1) {
        params.set('subcon', subconValues[0]);
      } else if (subconValues.length > 1) {
        subconValues.forEach((value) => params.append('subcon', value));
      }
      if (statusWhValues.length === 1) {
        params.set('status_wh', statusWhValues[0]);
      } else if (statusWhValues.length > 1) {
        statusWhValues.forEach((value) => params.append('status_wh', value));
      }
      if (statusSiteValues.length === 1) {
        params.set('status_site', statusSiteValues[0]);
      } else if (statusSiteValues.length > 1) {
        statusSiteValues.forEach((value) => params.append('status_site', value));
      }
    }

    if (q.mode === 'single') {
      params.set('show_deleted', q.show_deleted ? 'true' : 'false');
    }

    params.set('page', q.page);
    params.set('page_size', q.page_size);
    q.lastParams = params.toString();
    return q.lastParams;
  }

  function toAbsUrl(u) {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    const sep = u.startsWith('/') ? '' : '/';
    return `${API_BASE}${sep}${u}`;
  }

  async function fetchList() {
    if (!hint || !tbl || !pager || !pginfo) return;
    try {
      hint.textContent = i18n?.t('hint.loading') || '加载中…';
      tbl.style.display = 'none';
      pager.style.display = 'none';

      const params = buildParamsAuto();
      const url = buildSearchUrl(params);
      const resp = await fetch(url);
      const text = await resp.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (err) {
        console.error(err);
      }
      if (!resp.ok) {
        throw new Error((data && (data.detail || data.message)) || `HTTP ${resp.status}`);
      }

      const items = Array.isArray(data?.items) ? data.items : [];
      tableRenderer.renderRows(items);
      tableRenderer.bindRowActions();
      applyAllTranslations();

      tbl.style.display = '';
      hint.textContent = items.length
        ? ''
        : i18n?.t('hint.empty') || '没有数据';

      const total = data?.total || 0;
      const pages = Math.max(1, Math.ceil(total / q.page_size));
      const pageLabel = i18n?.t('pager.info');
      if (pageLabel && pageLabel !== 'pager.info') {
        pginfo.textContent = pageLabel
          .replace('{page}', q.page)
          .replace('{pages}', pages)
          .replace('{total}', total);
      } else {
        pginfo.textContent = `第 ${q.page} / ${pages} 页，共 ${total} 条`;
      }
      pager.style.display = pages > 1 ? '' : 'none';
      const prev = el('prev');
      const next = el('next');
      if (prev) prev.disabled = q.page <= 1;
      if (next) next.disabled = q.page >= pages;
    } catch (err) {
      hint.textContent = `${i18n?.t('hint.error') || '查询失败'}：${err?.message || err}`;
      tbl.style.display = 'none';
      pager.style.display = 'none';
    } finally {
      statusCards.refreshCounts();
    }
  }

  function openModalEdit(item) {
    const perms = getCurrentPermissions();
    if (!perms?.canEdit) {
      showToast(i18n ? i18n.t('auth.toast.denied') : '当前角色无权编辑该记录', 'error');
      return;
    }
    editingId = Number(item.id);
    editingItem = item || null;
    if (mId) {
      const label = item.dn_number ? `${item.dn_number}` : '';
      mId.textContent = `#${editingId} / ${label}`;
    }
    if (mRemark) {
      const remarkVal = item.remark ? String(item.remark) : '';
      mRemark.value = perms.allowRemark ? remarkVal : '';
    }
    if (mPhoto) {
      try {
        mPhoto.value = '';
      } catch (err) {
        console.error(err);
      }
    }
  const canonicalStatus = normalizeStatusDeliveryValue(item.status_delivery || item.status);
    populateModalStatusOptions(canonicalStatus);
    const statusSiteRaw =
      item.status_site ||
      item.statusSite ||
      '';
    const canonicalStatusSite = normalizeStatusDeliveryValue(statusSiteRaw);
    populateModalStatusSiteOptions(canonicalStatusSite);
    updateModalFieldVisibility();
    if (mMsg) mMsg.textContent = '';
    const wasVisible = mask && mask.style.display === 'flex';
    if (mask) mask.style.display = 'flex';
    if (!wasVisible) {
      lockBodyScroll();
    }
  }

  function closeModal() {
    const wasVisible = mask && mask.style.display === 'flex';
    if (mask) mask.style.display = 'none';
    if (wasVisible) {
      unlockBodyScroll();
    }
    editingId = 0;
    editingItem = null;
    if (mStatusSite) {
      setFormControlValue(mStatusSite, '');
    }
  }

  async function openUpdateHistoryModal(dnNumber) {
    if (!dnNumber || !updateHistoryModal) return;
    
    if (historyDnNumber) {
      historyDnNumber.textContent = dnNumber;
    }
    
    if (historyContent) {
      historyContent.innerHTML = '<div class="loading-state" data-i18n="updateHistory.loading">加载中...</div>';
    }
    
    const wasVisible = updateHistoryModal.style.display === 'flex';
    updateHistoryModal.style.display = 'flex';
    if (!wasVisible) {
      lockBodyScroll();
    }

    try {
      const url = `${API_BASE}/api/dn/${encodeURIComponent(dnNumber)}`;
      const resp = await fetch(url, { signal });
      const text = await resp.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (err) {
        console.error(err);
      }
      
      if (!resp.ok) {
        throw new Error((data && (data.detail || data.message)) || `HTTP ${resp.status}`);
      }
      
      const items = Array.isArray(data?.items) ? data.items : [];
      renderUpdateHistory(items);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (historyContent) {
        const errorMsg = i18n?.t('updateHistory.error') || '加载失败';
        historyContent.innerHTML = `<div class="error-state">${escapeHtml(errorMsg)}: ${escapeHtml(err?.message || err)}</div>`;
      }
      console.error('Failed to load update history', err);
    }
  }

  function closeUpdateHistoryModal() {
    if (updateHistoryModal) {
      const wasVisible = updateHistoryModal.style.display === 'flex';
      updateHistoryModal.style.display = 'none';
      if (wasVisible) {
        unlockBodyScroll();
      }
    }
  }

  function getMapboxStaticImageUrl(lng, lat, zoom = 13, width = 300, height = 160) {
    // Get Mapbox token from env
    const mapboxToken = getMapboxAccessToken();
    if (!mapboxToken || !lng || !lat) return '';
    
    // Mapbox Static Images API
    // https://docs.mapbox.com/api/maps/static-images/
    const style = 'mapbox/streets-v12'; // or 'mapbox/satellite-streets-v12' for satellite view
    const marker = `pin-s+ff0000(${lng},${lat})`; // Small red pin
    
    return `https://api.mapbox.com/styles/v1/${style}/static/${marker}/${lng},${lat},${zoom},0/${width}x${height}@2x?access_token=${encodeURIComponent(mapboxToken)}`;
  }

  function renderUpdateHistory(items) {
    if (!historyContent) return;
    
    if (!items || items.length === 0) {
      const emptyMsg = i18n?.t('updateHistory.empty') || '暂无更新记录';
      historyContent.innerHTML = `<div class="empty-state">${escapeHtml(emptyMsg)}</div>`;
      return;
    }
    
    const recordsHtml = items.map((item, index) => {
  const status = i18nStatusDisplay(item.status_delivery || item.status || '');
      const remark = item.remark ? escapeHtml(item.remark) : '<span class="muted">-</span>';
      const photoUrl = item.photo_url ? toAbsUrl(item.photo_url) : '';
      
      // Build updated_by with phone_number
      let updatedBy = '<span class="muted">-</span>';
      if (item.updated_by) {
        updatedBy = escapeHtml(item.updated_by);
        if (item.phone_number) {
          updatedBy += ` <span class="phone-number-suffix">(${escapeHtml(item.phone_number)})</span>`;
        }
      }
      
      const createdAt = item.created_at ? formatTimestampToJakarta(item.created_at) : '<span class="muted">-</span>';
      
      const [lat, lng] = [item.lat, item.lng];
      const hasCoords = lat && lng;
      
      // Build map preview section
      let mapSection = '';
      if (hasCoords) {
        const mapImageUrl = getMapboxStaticImageUrl(lng, lat);
        const googleMapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;
        const coords = `${escapeHtml(lat)}, ${escapeHtml(lng)}`;
        
        if (mapImageUrl) {
          mapSection = `
            <a href="${escapeHtml(googleMapsUrl)}" target="_blank" rel="noopener" class="history-map-image-link" title="在 Google Maps 中打开">
              <img src="${escapeHtml(mapImageUrl)}" alt="位置地图" class="history-map-image" loading="lazy" />
              <div class="history-map-overlay">
                ${getIconMarkup('map')}
              </div>
            </a>
          `;
        } else {
          // Fallback if no Mapbox token
          mapSection = `
            <a href="${escapeHtml(googleMapsUrl)}" target="_blank" rel="noopener" class="history-map-link-compact">
              ${getIconMarkup('map')} 查看地图
            </a>
          `;
        }
      } else {
        mapSection = '<span class="muted">无位置</span>';
      }
      
      // Build photo section
      const photoSection = photoUrl
        ? `<img src="${escapeHtml(photoUrl)}" alt="现场照片" class="history-photo-thumbnail view-link" data-url="${escapeHtml(photoUrl)}" loading="lazy" />`
        : '<span class="muted">无照片</span>';
      
      return `
        <div class="history-record ${index === 0 ? 'latest' : ''}">
          <div class="history-record-header">
            <div class="history-record-index">#${items.length - index}</div>
            <div class="history-record-time">${createdAt}</div>
          </div>
          <div class="history-record-main">
            <div class="history-record-info">
              <div class="history-info-row">
                <div class="history-field">
                  <div class="history-field-label">状态</div>
                  <div class="history-field-value history-status"><strong>${status}</strong></div>
                </div>
                <div class="history-field">
                  <div class="history-field-label">更新人</div>
                  <div class="history-field-value">${updatedBy}</div>
                </div>
              </div>
              <div class="history-field">
                <div class="history-field-label">备注</div>
                <div class="history-field-value">${remark}</div>
              </div>
            </div>
            <div class="history-record-media">
              <div class="history-media-item">${mapSection}</div>
              <div class="history-media-item">${photoSection}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    historyContent.innerHTML = `<div class="history-records">${recordsHtml}</div>`;
    
    // Bind photo view buttons
    historyContent.querySelectorAll('.view-link').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = trigger.getAttribute('data-url');
        tableRenderer.openViewerWithUrl(url);
      }, { signal });
    });
  }

  if (historyOk) {
    historyOk.addEventListener('click', closeUpdateHistoryModal, { signal });
  }
  if (updateHistoryModal) {
    updateHistoryModal.addEventListener('click', (e) => {
      if (e.target === updateHistoryModal) {
        closeUpdateHistoryModal();
      }
    }, { signal });
  }

  function buildFormDataForSave() {
    const perms = getCurrentPermissions();
    const form = new FormData();
  const statusDeliveryValRaw = mStatus?.value || '';
  const statusDeliveryVal = normalizeStatusDeliveryValue(statusDeliveryValRaw) || statusDeliveryValRaw;
    const statusSiteRaw = mStatusSite?.value || '';
    const statusSiteVal =
      normalizeStatusDeliveryValue(statusSiteRaw) || statusSiteRaw;
    const remarkVal = perms?.allowRemark ? (mRemark?.value || '').trim() : '';
    const allowPhoto = perms?.allowPhoto && mPhoto?.files && mPhoto.files[0];
    const currentItem = editingItem || null;
    const dnNumber = (currentItem?.dn_number || currentItem?.dnNumber || '').trim();
    if (dnNumber) {
      form.set('dnNumber', dnNumber);
    }

    const resolvedUser = getEffectiveUserInfo();
    const updatedBy = (resolvedUser?.name || '').trim();
    form.set('updated_by', updatedBy);

  const originalStatusRaw = currentItem?.status_delivery || currentItem?.status || '';
    const originalStatus =
      normalizeStatusDeliveryValue(originalStatusRaw) || originalStatusRaw || '';
    const statusDeliveryToSubmit = statusDeliveryVal || originalStatus;
    if (statusDeliveryToSubmit) {
      form.set('status_delivery', statusDeliveryToSubmit);
    }
    const originalStatusSiteRaw = currentItem?.status_site || currentItem?.statusSite || '';
    const originalStatusSite =
      normalizeStatusDeliveryValue(originalStatusSiteRaw) || originalStatusSiteRaw || '';
    const statusSiteToSubmit = statusSiteVal || originalStatusSite;
    form.set('status_site', statusSiteToSubmit || '');
    if (remarkVal) form.set('remark', remarkVal);
    if (allowPhoto) {
      form.set('photo', mPhoto.files[0]);
    }
    return {
      form,
      statusDeliveryVal,
      statusSiteVal,
      remarkVal,
      allowPhoto,
      dnNumber,
      statusDeliveryToSubmit,
      statusSiteToSubmit,
    };
  }

  function validateBeforeSave(payload) {
    const perms = getCurrentPermissions();
    if (!perms?.canEdit) {
      if (mMsg)
        mMsg.textContent = i18n
          ? i18n.t('auth.toast.denied')
          : '当前角色无权编辑该记录';
      return false;
    }

    if (!payload?.dnNumber) {
      if (mMsg) mMsg.textContent = '当前记录缺少 DN 号，无法保存。';
      return false;
    }

  if (perms.requireStatusSelection && !payload.statusDeliveryVal) {
      if (mMsg)
        mMsg.textContent = i18n
          ? i18n.t('modal.status_delivery.requiredHint')
          : '请选择允许的状态后再保存。';
      return false;
    }

    const allowedOptions = Array.isArray(perms?.statusOptions)
  ? perms.statusOptions.map((status_delivery) => normalizeStatusDeliveryValue(status_delivery) || status_delivery)
      : [];

    if (
  payload.statusDeliveryVal &&

      allowedOptions.length &&
  !allowedOptions.includes(payload.statusDeliveryVal)
    ) {
      if (mMsg)
        mMsg.textContent = i18n
          ? i18n.t('modal.status_delivery.invalid')
          : '选择的状态不在当前角色的权限范围内。';
      return false;
    }

  if (!payload.statusDeliveryToSubmit) {
      if (mMsg)
        mMsg.textContent = i18n
          ? i18n.t('modal.status_delivery.requiredHint')
          : '请选择允许的状态后再保存。';
      return false;
    }

    if (
  !payload.statusDeliveryVal &&
      !payload.statusSiteVal &&
      !payload.remarkVal &&
      !payload.allowPhoto
    ) {
      if (mMsg)
        mMsg.textContent = i18n
          ? i18n.t('modal.nothingToSave')
          : '没有可保存的更改。';
      return false;
    }

    return true;
  }

  el('m-cancel')?.addEventListener('click', closeModal, { signal });

  el('m-save')?.addEventListener(
    'click',
    async () => {
      if (!editingId || !editingItem) return;
      const payload = buildFormDataForSave();
      if (!validateBeforeSave(payload)) return;

      if (mMsg) mMsg.textContent = i18n?.t('modal.saving') || '保存中…';
      try {
        const resp = await fetch(`${API_BASE}/api/dn/update`, {
          method: 'POST',
          body: payload.form,
        });
        const text = await resp.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (err) {
          console.error(err);
        }
        if (!resp.ok) {
          throw new Error((data && (data.detail || data.message)) || `HTTP ${resp.status}`);
        }
        if (mMsg) mMsg.textContent = i18n?.t('modal.success') || '保存成功';
        closeModal();
        await fetchList();
      } catch (err) {
        if (mMsg)
          mMsg.textContent = i18n
            ? i18n.t('modal.error', { msg: err?.message || err })
            : `保存失败：${err?.message || err}`;
      }
    },
    { signal }
  );

  async function onDelete(item) {
    if (!item) return;
    const id = Number(item.id);
    const dnNumber = (item.dn_number || item.dnNumber || '').trim();
    if (!id || !dnNumber) {
      showToast('删除失败：缺少 DN 号信息。', 'error');
      return;
    }
    const perms = getCurrentPermissions();
    if (!perms?.canDelete) {
      showToast(i18n ? i18n.t('auth.toast.denied') : '当前角色无权删除该记录', 'error');
      return;
    }
    const confirmMsg = `确认要删除 DN ${dnNumber}（记录 #${id}）吗？`;
    if (!window.confirm(confirmMsg)) return;
    if (hint) hint.textContent = `正在删除 DN ${dnNumber} …`;
    try {
      const resp = await fetch(`${API_BASE}/api/dn/${encodeURIComponent(dnNumber)}`, {
        method: 'DELETE',
      });
      const text = await resp.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (err) {
        console.error(err);
      }
      if (!resp.ok)
        throw new Error((data && (data.detail || data.message)) || `HTTP ${resp.status}`);
      if (hint) hint.textContent = i18n?.t('modal.deleteSuccess') || '删除成功';
      await fetchList();
    } catch (err) {
      if (hint)
        hint.textContent = `${i18n?.t('modal.deleteError') || '删除失败'}：${err?.message || err}`;
    }
  }

  function csvEscape(val) {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function toCsvRows(items) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      return [['dn_number']];
    }

    const orderedKeys = [];
    const seenKeys = new Set();
    const pushKey = (key) => {
      if (key === undefined || key === null) return;
      const strKey = String(key);
      if (seenKeys.has(strKey)) return;
      seenKeys.add(strKey);
      orderedKeys.push(strKey);
    };

    const preferredKeys = [
      ...DN_DETAIL_KEYS,
      'du_id',
      'status',
      'remark',
      'photo_url',
      'photo',
      'photo_urls',
      'lat',
      'lng',
      'latitude',
      'longitude',
      'created_at',
      'updated_at',
    ];

    preferredKeys.forEach((key) => {
      if (
        list.some(
          (item) =>
            item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, key)
        )
      ) {
        pushKey(key);
      }
    });

    list.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      Object.keys(item).forEach((key) => pushKey(key));
    });

    if (!orderedKeys.length) {
      pushKey('dn_number');
    }

    const rows = [orderedKeys];
    list.forEach((item) => {
      const row = orderedKeys.map((key) => {
        if (!item || typeof item !== 'object') return '';
        if (!Object.prototype.hasOwnProperty.call(item, key)) return '';
        const value = item[key];
        if (value === null || value === undefined) return '';
        if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof Date))) {
          try {
            return JSON.stringify(value);
          } catch (err) {
            console.error(err);
            return String(value);
          }
        }
        const strValue = normalizeTextValue(value);
        const lowerKey = key.toLowerCase();
        if (/photo|image|picture|attachment/.test(lowerKey) || /url/.test(lowerKey)) {
          return toAbsUrl(strValue);
        }
        return strValue;
      });
      rows.push(row);
    });
    return rows;
  }

  function downloadCSV(rows, filename = 'dn_all_results.csv') {
    const bom = '\uFEFF';
    const lines = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([bom + lines], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function getExportSearchParams() {
    const paramsRaw = q.lastParams || buildParamsAuto() || '';
    const params = new URLSearchParams(paramsRaw);
    params.delete('page');
    params.delete('page_size');
    return params;
  }

  function buildExportUrl(basePath, params) {
    const search = params && typeof params.toString === 'function' ? params.toString() : '';
    const query = search ? `?${search}` : '';
    return `${API_BASE}${basePath}${query}`;
  }

  function extractItemsFromResponse(payload) {
    const visited = new Set();
    const keys = ['items', 'data', 'list', 'results', 'records', 'rows'];

    const walk = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value !== 'object') return [];
      if (visited.has(value)) return [];
      visited.add(value);

      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const direct = value[key];
          if (Array.isArray(direct)) return direct;
        }
      }

      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const nested = walk(value[key]);
          if (Array.isArray(nested)) return nested;
        }
      }

      return [];
    };

    return walk(payload);
  }

  async function exportAll() {
    if (!hint) return;
    try {
      hint.textContent = i18n?.t('actions.exporting') || '正在导出数据，请稍候…';
      const params = getExportSearchParams();
      // Request all items for export - ensure backend returns full dataset
      try {
        if (params && typeof params.set === 'function') params.set('page_size', 'all');
      } catch (e) {
        // ignore
      }
      const basePath =
        q.mode === 'batch' ? '/api/dn/list/batch' : '/api/dn/list/search';
      const url = buildExportUrl(basePath, params);

      const resp = await fetch(url);
      const raw = await resp.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (err) {
        console.error(err);
      }
      if (!resp.ok) {
        const message =
          data && typeof data === 'object' && !Array.isArray(data)
            ? data.detail || data.message
            : '';
        throw new Error(message || `HTTP ${resp.status}`);
      }

      const items = extractItemsFromResponse(data);

      if (!items.length) {
        window.alert(i18n?.t('actions.exportNone') || '没有匹配的数据可导出。');
        hint.textContent = '';
        return;
      }
      downloadCSV(toCsvRows(items));
      hint.textContent = '';
    } catch (err) {
      hint.textContent = `${i18n?.t('actions.exportError') || '导出失败'}：${err?.message || err}`;
    }
  }

  async function exportUpdateRecords() {
    if (!hint) return;
    try {
      hint.textContent = i18n?.t('actions.exporting') || '正在导出数据，请稍候…';
      const params = getExportSearchParams();
      const url = buildExportUrl('/api/dn/records', params);

      const resp = await fetch(url);
      const raw = await resp.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (err) {
        console.error(err);
      }
      if (!resp.ok) {
        const message =
          data && typeof data === 'object' && !Array.isArray(data)
            ? data.detail || data.message
            : '';
        throw new Error(message || `HTTP ${resp.status}`);
      }

      const items = extractItemsFromResponse(data);

      if (!items.length) {
        window.alert(i18n?.t('actions.exportNone') || '没有匹配的数据可导出。');
        hint.textContent = '';
        return;
      }

      downloadCSV(toCsvRows(items), 'dn_update_records.csv');
      hint.textContent = '';
    } catch (err) {
      hint.textContent = `${i18n?.t('actions.exportError') || '导出失败'}：${err?.message || err}`;
    }
  }

  // 授权模态框和事件处理已移至 authHandler.js

  subscribeToFilterChange('status_delivery', (values) => {
    const first = Array.isArray(values) && values.length ? values[0] : '';
    const podValue = DN_SCAN_STATUS_DELIVERY_VALUES?.POD || 'POD';
    if (first === podValue) {
      const currentSite = getFilterValues('status_site');
      if (!currentSite.includes(podValue)) {
        setFilterValue('status_site', podValue);
      }
    }
    statusCards.updateActiveState();
  });

  subscribeToFilterChange('status_site', () => {
    statusCards.updateActiveState();
  });

  subscribeToFilterChange('lsp', () => {
    lspSummaryCards.updateActiveState();
  });

  function resetAllFilters({ statusDeliveryValue = DEFAULT_STATUS_DELIVERY_VALUE } = {}) {
  setFilterValue('status_delivery', statusDeliveryValue);
    setInputValue('remark', '');
    setFormControlValue(hasSelect, '');
    setFilterValue('has_coordinate', '');
    setFilterValue('date_from', '');
    setFilterValue('date_to', '');
    setFilterValue('plan_mos_date', '');
    setFilterValue('lsp', '');
    setFilterValue('region', '');
    setFilterValue('subcon', '');
    setFilterValue('status_wh', '');
  setFilterValue('status_site', '');
    setInputValue('du', '');
    setFormControlValue(pageSizeInput, '20');
    if (dnInput) dnInput.value = '';
    dnEntry.normalizeFilterInput({ enforceFormat: false });
  }

  el('btn-search')?.addEventListener(
    'click',
    () => {
      q.page = 1;
      fetchList();
    },
    { signal }
  );

  el('btn-reset')?.addEventListener(
    'click',
    () => {
  resetAllFilters();
      q.page = 1;
      fetchList();
    },
    { signal }
  );

  rootEl.addEventListener(
    'admin:status-switch-change',
    (event) => {
      const detail = event?.detail || {};
      const targetValue = detail.showOnlyNonEmpty ? STATUS_DELIVERY_NOT_EMPTY_VALUE : STATUS_DELIVERY_ANY_VALUE;
  setFilterValue('status_delivery', targetValue);
      q.page = 1;
      fetchList();
    },
    { signal }
  );

  rootEl.addEventListener(
    'admin:show-deleted-switch-change',
    (event) => {
      const detail = event?.detail || {};
      const nextValue = Boolean(detail.showDeleted);
      if (q.show_deleted === nextValue) return;
      q.show_deleted = nextValue;
      q.page = 1;
      fetchList();
    },
    { signal }
  );

  el('prev')?.addEventListener(
    'click',
    () => {
      if (q.page > 1) {
        q.page--;
        fetchList();
      }
    },
    { signal }
  );

  el('next')?.addEventListener(
    'click',
    () => {
      q.page++;
      fetchList();
    },
    { signal }
  );

  pageSizeInput?.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const ps = getNormalizedPageSize();
      q.page = 1;
      q.page_size = ps;
      fetchList();
    },
    { signal }
  );

  const exportAllBtn = el('btn-export-all');
  exportAllBtn?.addEventListener(
    'click',
    async () => {
      if (!exportAllBtn) return;
      exportAllBtn.disabled = true;
      try {
        await exportAll();
      } finally {
        exportAllBtn.disabled = false;
      }
    },
    { signal }
  );

  const exportRecordsBtn = el('btn-export-records');
  exportRecordsBtn?.addEventListener(
    'click',
    async () => {
      if (!exportRecordsBtn) return;
      exportRecordsBtn.disabled = true;
      try {
        await exportUpdateRecords();
      } finally {
        exportRecordsBtn.disabled = false;
      }
    },
    { signal }
  );

  const syncSheetBtn = el('btn-sync-google-sheet');
  syncSheetBtn?.addEventListener(
    'click',
    async () => {
      if (!syncSheetBtn) return;
      syncSheetBtn.disabled = true;
      try {
        const resp = await fetch(`${API_BASE}/api/dn/sync`, { method: 'GET' });
        const contentType = resp.headers?.get('content-type') || '';
        let payload = null;
        let text = '';
        if (contentType.includes('application/json')) {
          try {
            payload = await resp.json();
          } catch (err) {
            console.error(err);
          }
        } else {
          try {
            text = await resp.text();
          } catch (err) {
            console.error(err);
          }
        }

        const messageFromResp =
          (payload && (payload.message || payload.msg || payload.detail)) || text || '';

        if (!resp.ok) {
          const baseError = i18n?.t('actions.syncGoogleSheetError') || '同步失败';
          const errorMessage = messageFromResp
            ? i18n?.t('actions.syncGoogleSheetErrorWithMsg', { msg: messageFromResp }) ||
              `${baseError}：${messageFromResp}`
            : baseError;
          showToast(errorMessage, 'error');
          return;
        }

        const baseSuccess =
          i18n?.t('actions.syncGoogleSheetSuccess') || '已触发 Google Sheet 数据更新';
        const successMessage = messageFromResp
          ? i18n?.t('actions.syncGoogleSheetSuccessWithMsg', { msg: messageFromResp }) ||
            `${baseSuccess}：${messageFromResp}`
          : baseSuccess;
        showToast(successMessage, 'success');
      } catch (err) {
        const fallbackError = i18n?.t('actions.syncGoogleSheetError') || '同步失败';
        const message = err?.message || err;
        const composed = message
          ? i18n?.t('actions.syncGoogleSheetErrorWithMsg', { msg: message }) ||
            `${fallbackError}：${message}`
          : fallbackError;
        showToast(composed, 'error');
      } finally {
        syncSheetBtn.disabled = false;
      }
    },
    { signal }
  );

  archiveExpiredDnBtn?.addEventListener(
    'click',
    async () => {
      if (!archiveExpiredDnBtn || archiveExpiredDnBtn.disabled) return;
      archiveExpiredDnBtn.disabled = true;
      try {
        const resp = await fetch(`${API_BASE}/api/dn/archive/mark`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threshold_days: ARCHIVE_THRESHOLD_DAYS }),
        });

        const contentType = resp.headers?.get('content-type') || '';
        let payload = null;
        let text = '';

        if (contentType.includes('application/json')) {
          try {
            payload = await resp.json();
          } catch (err) {
            console.error(err);
          }
        } else {
          try {
            text = await resp.text();
          } catch (err) {
            console.error(err);
          }
        }

        const messageFromResp =
          (payload && (payload.message || payload.msg || payload.detail)) || text || '';

        if (!resp.ok || (payload && payload.ok === false)) {
          const baseError =
            i18n?.t('actions.archiveExpiredDnError') || '归档过期 DN 标记失败';
          const errorMessage = messageFromResp
            ? i18n?.t('actions.archiveExpiredDnErrorWithMsg', { msg: messageFromResp }) ||
              `${baseError}：${messageFromResp}`
            : baseError;
          showToast(errorMessage, 'error');
          return;
        }

        const rawMatchedRows = payload?.data?.matched_rows;
        let matchedCount = null;
        if (typeof rawMatchedRows === 'number' && Number.isFinite(rawMatchedRows)) {
          matchedCount = rawMatchedRows;
        } else if (typeof rawMatchedRows === 'string') {
          const parsed = Number(rawMatchedRows);
          if (Number.isFinite(parsed)) matchedCount = parsed;
        }

        const baseSuccess =
          i18n?.t('actions.archiveExpiredDnSuccess') || '已触发归档过期 DN 标记任务';
        let successMessage = baseSuccess;
        if (matchedCount !== null) {
          successMessage =
            i18n?.t('actions.archiveExpiredDnSuccessWithCount', { count: matchedCount }) ||
            `${baseSuccess}，匹配 ${matchedCount} 条记录`;
        } else if (messageFromResp) {
          successMessage =
            i18n?.t('actions.archiveExpiredDnSuccessWithMsg', { msg: messageFromResp }) ||
            `${baseSuccess}：${messageFromResp}`;
        }

        showToast(successMessage, 'success');
      } catch (err) {
        const fallbackError =
          i18n?.t('actions.archiveExpiredDnError') || '归档过期 DN 标记失败';
        const message = err?.message || err;
        const composed = message
          ? i18n?.t('actions.archiveExpiredDnErrorWithMsg', { msg: message }) ||
            `${fallbackError}：${message}`
          : fallbackError;
        showToast(composed, 'error');
      } finally {
        archiveExpiredDnBtn.disabled = !isTransportManagerRole();
      }
    },
    { signal }
  );

  el('btn-trust-backend-link')?.addEventListener(
    'click',
    () => {
      window.open(String(API_BASE).replace(/\/+$/, ''), '_blank');
    },
    { signal }
  );

  async function init() {
    dnEntry.normalizeFilterInput({ enforceFormat: false });
    if (hint) hint.textContent = i18n?.t('hint.ready') || '输入条件后点击查询。';
    await fetchFilterCandidates();
    await fetchList();
  }

  tableRenderer = createTableRenderer({
    tbody,
    tableEl: tbl,
    actionsHeader,
    updatedAtHeader,
    i18n,
    signal,
    showToast,
    openModalEdit,
    onDelete,
    openUpdateHistoryModal,
    getCurrentPermissions,
    isTransportManagerRole,
    translateInstant,
    normalizeStatusDeliveryValue,
    normalizeTextValue,
    i18nStatusDisplay,
    toAbsUrl,
    formatTimestampToJakarta,
    getCurrentRoleKey: () => authHandler.getCurrentRoleKey(),
    viewerApi,
  });

  tableRenderer?.updateActionColumnVisibility?.();
  hideHasAttachmentFilter();
  tableRenderer?.hideUpdatedAtColumn?.();

  authHandler.restoreFromStorage();
  init();
  applyAllTranslations();

  return () => {
    try {
      controller.abort();
    } catch (err) {
      console.error(err);
    }
    if (removeI18nListener) {
      try {
        removeI18nListener();
      } catch (err) {
        console.error(err);
      }
    }
    cleanupFilterSubscriptions();
    try {
      tableRenderer?.closeViewer?.();
    } catch (err) {
      console.error(err);
    }
    if (tableRenderer) tableRenderer.cleanup();
    resetBodyScrollLock();
  };
}
