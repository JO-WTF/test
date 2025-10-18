import { api as viewerApi } from 'v-viewer';
import {
  STATUS_DELIVERY_VALUES,
  STATUS_DELIVERY_ITEMS,
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
  fetchWithPayload,
  bindAsyncButtonClick,
  normalizeTextValue,
  setSearchParamValues,
  convertDateToOffsetIso,
  formatTimestampWithOffset,
  formatTimestampForExport,
  isTimestampKey,
  downloadCSV,
  extractItemsFromResponse,
  showToast,
} from './utils.js';
import { prepareUpdateHistoryItems } from './updateHistoryData.js';

import {
  TRANSPORT_MANAGER_ROLE_KEY,
  STATUS_DELIVERY_VALUE_TO_KEY,
  STATUS_DELIVERY_ALIAS_MAP,
  STATUS_DELIVERY_KNOWN_VALUES,
  DEFAULT_STATUS_DELIVERY_VALUE,
  PLAN_MOS_TIME_ZONE,
  JAKARTA_UTC_OFFSET_MINUTES,
  ARCHIVE_THRESHOLD_DAYS,
  TRANSPORT_MANAGER_STATUS_DELIVERY_CARDS,
  DN_DETAIL_KEYS,
  ICON_MARKUP,
} from './constants.js';

const API_BASE = getApiBase();
const JAKARTA_OFFSET = Number.isFinite(JAKARTA_UTC_OFFSET_MINUTES)
  ? JAKARTA_UTC_OFFSET_MINUTES
  : 0;
const EXPORT_PREFERRED_KEYS = [
  ...DN_DETAIL_KEYS,
  'du_id',
  'status_delivery',
  'status_site',
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

export function setupAdminPage(
  rootEl,
  {
    i18n,
    applyTranslations,
    planMosDateSelect,
    filterSelects,
    filterInputs,
    onRoleChange,
    modalControllers = {},
    tableBridge = null,
  } = {}
) {
  if (!rootEl) return () => { };

  const controller = new AbortController();
  const { signal } = controller;

  const el = (id) => {
    if (!id) return null;
    try {
      return document.getElementById(id);
    } catch (err) {
      console.error(`Failed to query element #${id}`, err);
      return null;
    }
  };

  const scanStatusMeta = new Map(
    (STATUS_DELIVERY_ITEMS || []).map((item) => [item.value, item])
  );

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
  const hint = el('hint');

  const hasSelect = el('f-has');
  const hasSelectField = hasSelect ? hasSelect.closest('.field') : null;

  const mId = el('modal-id');
  const mStatusDelivery = el('m-status-delivery');
  const mStatusSite = el('m-status-site');
  const mStatusSiteField = el('m-status-site-field');
  const mRemark = el('m-remark');
  const mRemarkField = el('m-remark-field');
  const mPhoto = el('m-photo');
  const mPhotoField = el('m-photo-field');
  const mMsg = el('m-msg');
  const filtersGrid = el('filters-grid');
  const filtersToggle = el('filters-toggle');

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
  const dnEntryInput = el('dn-input');
  const dnEntryPreview = el('dn-preview-modal');
  const dnCancel = el('dn-cancel');
  const dnConfirm = el('dn-confirm');
  const archiveExpiredDnBtn = el('btn-archive-expired-dn');

  const editModalController = modalControllers?.edit || null;
  const authModalController = modalControllers?.auth || null;
  const dnModalController = modalControllers?.dn || null;
  const updateHistoryModalController = modalControllers?.updateHistory || null;

  let editingId = 0;
  let editingItem = null;
  let removeI18nListener = null;
  let filtersExpanded = true;
  let filtersMediaQuery = null;
  let removeFiltersMediaListener = null;

  if (filtersToggle) {
    filtersToggle.setAttribute('aria-expanded', 'false');
    filtersToggle.addEventListener('click', () => {
      setFiltersExpanded(!filtersExpanded);
    }, { signal });
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    filtersMediaQuery = window.matchMedia('(max-width: 768px)');
    const mediaHandler = (event) => {
      handleFiltersMediaChange(event);
    };
    if (typeof filtersMediaQuery.addEventListener === 'function') {
      filtersMediaQuery.addEventListener('change', mediaHandler);
      removeFiltersMediaListener = () => {
        try {
          filtersMediaQuery.removeEventListener('change', mediaHandler);
        } catch (err) {
          console.error(err);
        }
      };
    } else if (typeof filtersMediaQuery.addListener === 'function') {
      filtersMediaQuery.addListener(mediaHandler);
      removeFiltersMediaListener = () => {
        try {
          filtersMediaQuery.removeListener(mediaHandler);
        } catch (err) {
          console.error(err);
        }
      };
    }
    handleFiltersMediaChange(filtersMediaQuery);
  } else {
    setFiltersExpanded(true);
  }

  // 初始化授权处理器
  const authHandler = createAuthHandler({
    authBtn,
    authCancel,
    authConfirm,
    authInput,
    authMsg,
    authRoleTag,
    authModalController,
    signal,
    i18n,
    showToast,
    onRoleChange,
    onRoleApplied: handleAuthRoleApplied,
    onAuthSuccess: () => {
      // 授权成功后执行完整初始化逻辑
      init();
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

  function convertDateToJakartaIso(dateString, options = {}) {
    return convertDateToOffsetIso(dateString, {
      ...options,
      offsetMinutes: JAKARTA_OFFSET,
    });
  }

  function formatTimestampToJakarta(timestamp) {
    return formatTimestampWithOffset(timestamp, {
      offsetMinutes: JAKARTA_OFFSET,
    });
  }

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
    const raw = Number(q.page_size);
    if (!Number.isFinite(raw) || raw <= 0) {
      q.page_size = fallback;
      return fallback;
    }
    const normalized = Math.min(1000, Math.max(1, Math.floor(raw)));
    if (normalized !== q.page_size) {
      q.page_size = normalized;
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
      mode === 'batch'
        ? '/api/dn/list/batch?'
        : mode === 'batch_du'
        ? '/api/dn/list/batch-by-du?'
        : '/api/dn/list/search?';
    return `${API_BASE}${basePath}${params}`;
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
    dnEntryInput,
    dnEntryPreview,
    dnCancel,
    dnConfirm,
    signal,
    i18n,
    API_BASE,
    showToast,
    getCurrentPermissions,
    getCurrentRoleKey: () => authHandler.getCurrentRoleKey(),
    fetchList,
    dnModalController,
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
  i18nStatusDeliveryDisplay: i18nStatusDisplay,
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
    const alias = STATUS_DELIVERY_ALIAS_MAP[text];
    if (alias) return alias;
    if (STATUS_DELIVERY_KNOWN_VALUES.has(text)) return text;
    const upper = text.toUpperCase();
    if (STATUS_DELIVERY_KNOWN_VALUES.has(upper)) return upper;
    return text;
  }

  function i18nStatusDisplay(value) {
    const canonical = normalizeStatusDeliveryValue(value);
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

  function updateFiltersToggleLabel() {
    if (!filtersToggle) return;
    const key = filtersExpanded ? 'filters.toggle.hide' : 'filters.toggle.show';
    const fallback = filtersExpanded ? 'Hide Filters' : 'Show Filters';
    filtersToggle.textContent = translateInstant(key, fallback);
  }

  function setFiltersExpanded(expanded) {
    filtersExpanded = !!expanded;
    if (filtersGrid) {
      filtersGrid.classList.toggle('is-visible', filtersExpanded);
    }
    if (filtersToggle) {
      filtersToggle.setAttribute('aria-expanded', filtersExpanded ? 'true' : 'false');
      filtersToggle.setAttribute('data-state', filtersExpanded ? 'expanded' : 'collapsed');
    }
    updateFiltersToggleLabel();
  }

  function handleFiltersMediaChange(event) {
    const isMobile = !!event?.matches;
    setFiltersExpanded(!isMobile);
  }

  function applyAllTranslations() {
    if (typeof applyTranslations === 'function') {
      applyTranslations();
    }
    tableBridge?.notifyTranslations?.();
    authHandler.refreshLabels();
    statusCards.updateLabels();
    statusCards.updateActiveState();
    lspSummaryCards.updateActiveState();
    refreshDnEntryVisibility();
    populateModalStatusOptions({ type: 'delivery', selected: mStatusDelivery?.value || '' });
    populateModalStatusOptions({ type: 'site', selected: mStatusSite?.value || '' });
    dnEntry.renderFilterPreview();
    updateFiltersToggleLabel();
  }

  if (i18n && typeof i18n.onChange === 'function') {
    removeI18nListener = i18n.onChange(() => {
      applyAllTranslations();
    });
  }

  function handleAuthRoleApplied(_roleKey, _role, _userInfo) {
    refreshDnEntryVisibility();
    populateModalStatusOptions({ type: 'delivery', selected: mStatusDelivery?.value || '' });
    populateModalStatusOptions({ type: 'site', selected: mStatusSite?.value || '' });
    updateModalFieldVisibility();
    tableBridge?.setPermissions?.(getCurrentPermissions());
    tableBridge?.setTransportManager?.(isTransportManagerRole());
    tableBridge?.notifyTranslations?.();
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
    const meta = scanStatusMeta.get(canonical);
    if (meta) {
      const translated = translateInstant(meta.filterLabelKey, canonical);
      if (translated) return translated;
    }
    const label = i18nStatusDisplay(canonical);
    if (label) return label;
    return canonical;
  }

  function populateModalStatusOptions({ type, selected }) {
    const isDelivery = type === 'delivery';
    const selectEl = isDelivery ? mStatusDelivery : mStatusSite;
    if (!selectEl) return;

    const perms = getCurrentPermissions();
    const optionsAllowed = Array.isArray(perms?.[isDelivery ? 'statusDeliveryOptions' : 'statusSiteOptions'])
      ? perms[isDelivery ? 'statusDeliveryOptions' : 'statusSiteOptions']
      : [];
    const selectedCanonical = normalizeStatusDeliveryValue(selected);

    selectEl.innerHTML = '';

    const keepValue = '';
    const keepLabel = isDelivery
      ? (i18n?.t('modal.statusDelivery.keep') || '（不修改）')
      : (i18n?.t('modal.statusSite.keep') || '（不修改）');

    // 默认选择“不修改”
    const createOption = (value, label, isSelected = false) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (isSelected) opt.selected = true;
      selectEl.appendChild(opt);
    };

    createOption(keepValue, keepLabel, true);

    optionsAllowed.forEach((value) => {
      const canonical = normalizeStatusDeliveryValue(value);
      if (canonical) {
        createOption(
          canonical,
          isDelivery ? getModalStatusLabel(canonical) : i18nStatusDisplay(canonical),
          false // 其他选项不默认选中
        );
      }
    });

    selectEl.value = keepValue;
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
      JAKARTA_OFFSET,
      'dd MMM yy'
    );
    setFilterValue('plan_mos_date', todayJakarta);
    setFilterValue('lsp', normalizedLsp);
    statusCards.updateActiveState();
    lspSummaryCards.updateActiveState();
    q.page = 1;
    fetchList();
  }

  function applyStatusCardFilter(def, canonicalValue) {
    const isDeliveryCard = def?.type === 'status_delivery';
    const isSiteCard = def?.type === 'status_site';
    if (!isDeliveryCard && !isSiteCard) return;

    const fallbackValue = isDeliveryCard ? def?.status_delivery : def?.status_site;
    const preferredValue =
      typeof canonicalValue === 'string' ? canonicalValue : '';
    const normalizedValue =
      (preferredValue ||
        (typeof fallbackValue === 'string' ? fallbackValue : '') ||
        '').trim();
    const isTotalSelection =
      normalizedValue && normalizedValue.toLowerCase() === 'total';
    const toCompareKey = (value) => {
      if (value === undefined || value === null) return '';
      const normalized =
        normalizeStatusDeliveryValue(value) || (typeof value === 'string' ? value : String(value));
      return String(normalized || '').trim().toLowerCase();
    };
    const currentDeliveryKey = toCompareKey(getSingleFilterValue('status_delivery'));
    const currentSiteValues = getFilterValues('status_site');
    const currentSiteValue =
      Array.isArray(currentSiteValues) && currentSiteValues.length
        ? currentSiteValues[0]
        : '';
    const currentSiteKey = toCompareKey(currentSiteValue);
    const targetKey = toCompareKey(normalizedValue);
    const isAlreadySelected =
      !isTotalSelection &&
      !!targetKey &&
      (isDeliveryCard
        ? targetKey === currentDeliveryKey
        : targetKey === currentSiteKey);

    if (isDeliveryCard) {
      setFilterValue(
        'status_delivery',
        isTotalSelection || isAlreadySelected
          ? DEFAULT_STATUS_DELIVERY_VALUE
          : normalizedValue
      );
    } else if (isSiteCard) {
      if (isTotalSelection || isAlreadySelected || !normalizedValue) {
        setFilterValue('status_site', '');
      } else {
        setFilterValue('status_site', [normalizedValue]);
      }
    }

    const currentPlanMosDate = getSingleFilterValue('plan_mos_date');
    if (!currentPlanMosDate) {
      const todayJakarta = getTodayDateStringInTimezone(
        PLAN_MOS_TIME_ZONE,
        JAKARTA_OFFSET,
        'dd MMM yy'
      );
      setFilterValue('plan_mos_date', todayJakarta);
    }
  }


  async function fetchFilterCandidates() {
    try {
      const { resp, data, message } = await fetchWithPayload(
        `${API_BASE}/api/dn/filters`,
        { signal }
      );
      if (!resp.ok) {
        throw new Error(message || `HTTP ${resp.status}`);
      }
      const payload = data?.data && typeof data.data === 'object' ? data.data : data;
      setFilterDropdownOptions('lsp', payload?.lsp);
      setFilterDropdownOptions('region', payload?.region);
      setFilterDropdownOptions('area', payload?.area);
      setFilterDropdownOptions('plan_mos_date', payload?.plan_mos_date);
      setFilterDropdownOptions('project_request', payload?.project_request);
      setFilterDropdownOptions('subcon', payload?.subcon);
      const siteOptions = payload?.status_site;
      setFilterDropdownOptions('status_site', siteOptions);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('Failed to load DN filter options', err);
    }
  }

  function buildParamsAuto() {
    const params = new URLSearchParams();
    const dnTokens = dnEntry.normalizeFilterInput({ enforceFormat: false });
    const ps = getNormalizedPageSize();
    q.page_size = ps;

    const duRaw = getInputValue('du');
    const duTokens = (duRaw || '')
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);

    let mode = 'single';
    if (dnTokens.length) {
      mode = 'batch';
    } else if (duTokens.length) {
      mode = 'batch_du';
    }
    q.mode = mode;

    if (mode === 'batch') {
      dnTokens.forEach((token) => params.append('dn_number', token));
    } else {
      const st = getSingleFilterValue('status_delivery');
      const rk = getInputValue('remark').trim();
      const hp = hasSelect?.value;
      const hc = getSingleFilterValue('has_coordinate');
      const df = getDateFilterValue('date_from');
      const dt = getDateFilterValue('date_to');
      const lspValues = getFilterValues('lsp');
      const regionValues = getFilterValues('region');
      const areaValues = getFilterValues('area');
      const planMosDateTokens = getFilterValues('plan_mos_date');
      const projectValues = getFilterValues('project_request');
      const subconValues = getFilterValues('subcon');
      const statusSiteValues = getFilterValues('status_site');

      if (dnTokens.length === 1) params.set('dn_number', dnTokens[0]);
      if (st === '__NOT_EMPTY__') {
        params.set('status_delivery_not_empty', 'true');
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
      setSearchParamValues(params, {
        lsp: lspValues,
        region: regionValues,
        area: areaValues,
        date: planMosDateTokens,
        project_request: projectValues,
        subcon: subconValues,
        du_id: duTokens,
        status_site: statusSiteValues,
      });
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
    if (!hint) return;
    try {
      hint.textContent = i18n?.t('hint.loading') || '加载中…';
      tableBridge?.setLoading?.(true);
      statusCards.setLoadingState?.(true);
      q.page_size = getNormalizedPageSize();

      const params = buildParamsAuto();
      const url = buildSearchUrl(params);
      const { resp, data, message } = await fetchWithPayload(url, { signal });
      if (!resp.ok) {
        throw new Error(message || `HTTP ${resp.status}`);
      }

      const items = Array.isArray(data?.items) ? data.items : [];

      // 如果 search 接口返回了 stats，就把它传递给 statusCards 与 lspSummaryCards
      try {
        const rawStats = data?.stats ?? null;
        if (rawStats && typeof rawStats === 'object') {
          const sd = rawStats.status_delivery || rawStats.statusDelivery || {};
          // status_site may be returned separately by the backend; merge it into the
          // unified counts object so statusCards can find counts for both delivery
          // and site-type status cards.
          const ss = rawStats.status_site || rawStats.statusSite || {};
          const counts = Object.create(null);
          Object.keys(sd || {}).forEach((k) => {
            const n = Number(sd[k]);
            counts[k] = Number.isFinite(n) ? n : 0;
          });
          // Merge site stats, summing with any existing delivery counts if keys collide
          Object.keys(ss || {}).forEach((k) => {
            const n = Number(ss[k]);
            const prev = Number.isFinite(Number(counts[k])) ? Number(counts[k]) : 0;
            counts[k] = prev + (Number.isFinite(n) ? n : 0);
          });
          const totalFromStats = Number.isFinite(Number(rawStats.total)) ? Number(rawStats.total) : null;
          const total = totalFromStats !== null ? totalFromStats : (data?.total || Object.values(counts).reduce((s, v) => s + (Number.isFinite(Number(v)) ? Number(v) : 0), 0));
          const lspSummary = Array.isArray(rawStats.lsp_summary) ? rawStats.lsp_summary : Array.isArray(rawStats.lspSummary) ? rawStats.lspSummary : [];
          const statsObj = { counts, total, lspSummary };
          try {
            statusCards.refreshCounts(statsObj);
          } catch (err) {
            console.error('Error calling statusCards.refreshCounts with stats', err);
          }
          try {
            lspSummaryCards.setData(lspSummary);
            lspSummaryCards.updateActiveState();
          } catch (err) {
            console.error('Error updating lspSummaryCards from stats', err);
          }
        } else {
          // no stats returned, still trigger refresh (will be no-op or fetch nothing)
          try {
            statusCards.refreshCounts();
          } catch (err) {
            console.error('Error calling statusCards.refreshCounts', err);
          }
        }
      } catch (err) {
        console.error('Failed to process stats from list response', err);
      }

      tableBridge?.setItems?.(items, {
        total: Number(data?.total) || 0,
        page: q.page,
        pageSize: q.page_size,
      });
      applyAllTranslations();

      hint.textContent = items.length
        ? ''
        : i18n?.t('hint.empty') || '没有数据';
    } catch (err) {
      hint.textContent = `${i18n?.t('hint.error') || '查询失败'}：${err?.message || err}`;
      tableBridge?.setItems?.([], {
        total: 0,
        page: q.page,
        pageSize: q.page_size,
      });
    } finally {
      // Ensure any loading indicator is cleared regardless of outcome.
      try {
        tableBridge?.setLoading?.(false);
      } catch (err) {
        console.error('Failed to clear table loading state', err);
      }
      try {
        statusCards.setLoadingState?.(false);
      } catch (err) {
        console.error('Failed to clear status card loading state', err);
      }
    }
  }

  let photoViewerInstance = null;

  function cleanupPhotoViewer() {
    if (!photoViewerInstance) return;
    try {
      if (typeof photoViewerInstance.destroy === 'function') {
        photoViewerInstance.destroy();
      }
    } catch (err) {
      console.error(err);
    }
    photoViewerInstance = null;
  }

  function openPhotoViewer(url) {
    if (!url || !viewerApi) return;

    cleanupPhotoViewer();

    try {
      photoViewerInstance = viewerApi({
        options: {
          navbar: false,
          title: false,
          toolbar: false,
          fullscreen: false,
          movable: true,
          zoomRatio: 0.4,
          loading: true,
          backdrop: true,
          hidden() {
            cleanupPhotoViewer();
          },
        },
        images: [url],
      });
    } catch (err) {
      console.error(err);
      cleanupPhotoViewer();
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
    populateModalStatusOptions({ type: 'delivery', selected: canonicalStatus });
    const statusSiteRaw =
      item.status_site ||
      item.statusSite ||
      '';
    const canonicalStatusSite = normalizeStatusDeliveryValue(statusSiteRaw);
    populateModalStatusOptions({ type: 'site', selected: canonicalStatusSite });
    updateModalFieldVisibility();
    if (mMsg) mMsg.textContent = '';
    if (editModalController?.open) {
      editModalController.open();
    }
  }

  function closeModal() {
    if (editModalController?.close) {
      editModalController.close();
    }
    editingId = 0;
    editingItem = null;
    if (mStatusSite) {
      setFormControlValue(mStatusSite, '');
    }
  }

  async function openUpdateHistoryModal(dnNumber) {
    if (!dnNumber) return;
    try {
      const modal = updateHistoryModalController;
      if (modal && modal.setLoading) modal.setLoading(true);
      if (modal && modal.setError) modal.setError('');
      if (modal && modal.setData) modal.setData([], dnNumber);
      if (modal && modal.open) modal.open();

      const url = `${API_BASE}/api/dn/${encodeURIComponent(dnNumber)}`;
      const { resp, data, message } = await fetchWithPayload(url, { signal });
      if (!resp.ok) {
        throw new Error(message || `HTTP ${resp.status}`);
      }

      const items = Array.isArray(data?.items) ? data.items : [];
      const prepared = prepareUpdateHistoryItems(items, {
        i18n,
        i18nStatusDisplay,
        escapeHtml,
        formatTimestampToJakarta,
        toAbsUrl,
        getIconMarkup,
        getMapboxStaticImageUrl,
        statusDeliveryValueToKey: STATUS_DELIVERY_VALUE_TO_KEY,
        statusDeliveryAliasMap: STATUS_DELIVERY_ALIAS_MAP,
      });
      if (modal && modal.setData) modal.setData(prepared, dnNumber);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (updateHistoryModalController && updateHistoryModalController.setError) {
        const errorMsg = i18n?.t('updateHistory.error') || '加载失败';
        updateHistoryModalController.setError(`${errorMsg}: ${err?.message || err}`);
      }
      console.error('Failed to load update history', err);
    } finally {
      if (updateHistoryModalController && updateHistoryModalController.setLoading) {
        updateHistoryModalController.setLoading(false);
      }
    }
  }

  function closeUpdateHistoryModal() {
    if (updateHistoryModalController?.close) {
      updateHistoryModalController.close();
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

  // historyOk listener removed; modal close handled by component via modalControllers
  function buildFormDataForSave() {
    const perms = getCurrentPermissions();
    const form = new FormData();
    const statusDeliveryValRaw = mStatusDelivery?.value || '';
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

    if (perms.requireStatusDeliverySelection && !payload.statusDeliveryVal) {
      if (mMsg)
        mMsg.textContent = i18n
          ? i18n.t('modal.status_delivery.requiredHint')
          : '请选择允许的状态后再保存。';
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
      const { resp, data, message } = await fetchWithPayload(
        `${API_BASE}/api/dn/${encodeURIComponent(dnNumber)}`,
        { method: 'DELETE', signal }
      );
      if (!resp.ok) throw new Error(message || `HTTP ${resp.status}`);
      if (hint) hint.textContent = i18n?.t('modal.deleteSuccess') || '删除成功';
      await fetchList();
    } catch (err) {
      if (hint)
        hint.textContent = `${i18n?.t('modal.deleteError') || '删除失败'}：${err?.message || err}`;
    }
  }

  function formatTimestampForJakartaExport(value) {
    return formatTimestampForExport(value, { offsetMinutes: JAKARTA_OFFSET });
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

    EXPORT_PREFERRED_KEYS.forEach((key) => {
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
        if (isTimestampKey(lowerKey)) {
          const formatted = formatTimestampForJakartaExport(value);
          if (formatted) return formatted;
        }
        if (/photo|image|picture|attachment/.test(lowerKey) || /url/.test(lowerKey)) {
          return toAbsUrl(strValue);
        }
        return strValue;
      });
      rows.push(row);
    });
    return rows;
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

  async function exportData({ basePath, prepareParams, filename }) {
    if (!hint) return;
    try {
      hint.textContent = i18n?.t('actions.exporting') || '正在导出数据，请稍候…';
      const params = getExportSearchParams();
      if (typeof prepareParams === 'function') {
        try {
          prepareParams(params);
        } catch (err) {
          console.error(err);
        }
      }
      const url = buildExportUrl(basePath, params);
      const { resp, data, message } = await fetchWithPayload(url);
      if (!resp.ok) {
        throw new Error(message || `HTTP ${resp.status}`);
      }

      const items = extractItemsFromResponse(data);

      if (!items.length) {
        window.alert(i18n?.t('actions.exportNone') || '没有匹配的数据可导出。');
        hint.textContent = '';
        return;
      }

      downloadCSV(toCsvRows(items), filename);
      hint.textContent = '';
    } catch (err) {
      hint.textContent = `${i18n?.t('actions.exportError') || '导出失败'}：${err?.message || err}`;
    }
  }

  async function exportAll() {
    const basePath =
      q.mode === 'batch'
        ? '/api/dn/list/batch'
        : q.mode === 'batch_du'
        ? '/api/dn/list/batch-by-du'
        : '/api/dn/list/search';
    await exportData({
      basePath,
      prepareParams: (params) => {
        if (params && typeof params.set === 'function') {
          params.set('page_size', 'all');
        }
      },
    });
  }

  async function exportUpdateRecords() {
    await exportData({
      basePath: '/api/dn/records',
      filename: 'dn_update_records.csv',
    });
  }

  // 授权模态框和事件处理已移至 authHandler.js

  subscribeToFilterChange('status_delivery', () => {
    statusCards.updateActiveState();
  });

  subscribeToFilterChange('status_site', () => {
    statusCards.updateActiveState();
  });

  subscribeToFilterChange('lsp', () => {
    lspSummaryCards.updateActiveState();
  });

  function resetAllFilters({
    statusDeliveryValue = DEFAULT_STATUS_DELIVERY_VALUE,
    preservePageSize = false,
  } = {}) {
    setFilterValue('status_delivery', statusDeliveryValue);
    setInputValue('remark', '');
    setFormControlValue(hasSelect, '');
    setFilterValue('has_coordinate', '');
    setFilterValue('date_from', '');
    setFilterValue('date_to', '');
    setFilterValue('plan_mos_date', '');
    setFilterValue('lsp', '');
    setFilterValue('region', '');
  setFilterValue('area', '');
    setFilterValue('project_request', '');
    setFilterValue('subcon', '');
    setFilterValue('status_site', '');
    setInputValue('du', '');
    if (!preservePageSize) {
      q.page_size = 20;
    }
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
      const targetValue = detail.showOnlyNonEmpty ? '__NOT_EMPTY__' : "";
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

  const exportAllBtn = el('btn-export-all');
  bindAsyncButtonClick(exportAllBtn, exportAll, { signal });

  const exportRecordsBtn = el('btn-export-records');
  bindAsyncButtonClick(exportRecordsBtn, exportUpdateRecords, { signal });

  const syncSheetBtn = el('btn-sync-google-sheet');
  bindAsyncButtonClick(syncSheetBtn, async () => {
    if (!syncSheetBtn) return;
    try {
      const { resp, message: responseMessage } = await fetchWithPayload(
        `${API_BASE}/api/dn/sync`,
        { method: 'GET' }
      );
      if (!resp.ok) {
        const baseError = i18n?.t('actions.syncGoogleSheetError') || '同步失败';
        const errorMessage = responseMessage
          ? i18n?.t('actions.syncGoogleSheetErrorWithMsg', { msg: responseMessage }) ||
            `${baseError}：${responseMessage}`
          : baseError;
        showToast(errorMessage, 'error');
        return;
      }

      const baseSuccess =
        i18n?.t('actions.syncGoogleSheetSuccess') || '已触发 Google Sheet 数据更新';
      const successMessage = responseMessage
        ? i18n?.t('actions.syncGoogleSheetSuccessWithMsg', { msg: responseMessage }) ||
          `${baseSuccess}：${responseMessage}`
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
    }
  }, { signal });

  bindAsyncButtonClick(
    archiveExpiredDnBtn,
    async () => {
      if (!archiveExpiredDnBtn) return;
      try {
        const { resp, data, message: responseMessage } = await fetchWithPayload(
          `${API_BASE}/api/dn/archive/mark`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threshold_days: ARCHIVE_THRESHOLD_DAYS }),
          }
        );

        if (!resp.ok || (data && data.ok === false)) {
          const baseError =
            i18n?.t('actions.archiveExpiredDnError') || '归档过期 DN 标记失败';
          const errorMessage = responseMessage
            ? i18n?.t('actions.archiveExpiredDnErrorWithMsg', { msg: responseMessage }) ||
              `${baseError}：${responseMessage}`
            : baseError;
          showToast(errorMessage, 'error');
          return;
        }

        const rawMatchedRows = data?.data?.matched_rows;
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
        } else if (responseMessage) {
          successMessage =
            i18n?.t('actions.archiveExpiredDnSuccessWithMsg', { msg: responseMessage }) ||
            `${baseSuccess}：${responseMessage}`;
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
      }
    },
    {
      signal,
      onFinally: () => {
        if (archiveExpiredDnBtn) {
          archiveExpiredDnBtn.disabled = !isTransportManagerRole();
        }
      },
    }
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
    await fetchList();
    await fetchFilterCandidates();
  }

  hideHasAttachmentFilter();

  tableBridge?.setNormalizeStatusDelivery?.(normalizeStatusDeliveryValue);
  tableBridge?.setStatusDisplay?.(i18nStatusDisplay);
  tableBridge?.setUtilities?.({
    toAbsUrl,
    formatTimestampToJakarta,
  });
  tableBridge?.setPermissions?.(getCurrentPermissions());
  tableBridge?.setTransportManager?.(isTransportManagerRole());
  tableBridge?.registerActionHandlers?.({
    onEdit: openModalEdit,
    onDelete,
    onViewHistory: openUpdateHistoryModal,
    onOpenPhoto: openPhotoViewer,
  });
  tableBridge?.registerPaginationHandlers?.({
    onPageChange(page, pageSize) {
      const normalizedPage = Math.max(1, Number(page) || 1);
      const normalizedSize = Math.max(1, Math.min(1000, Number(pageSize) || q.page_size));
      let shouldFetch = false;
      if (q.page !== normalizedPage) {
        q.page = normalizedPage;
        shouldFetch = true;
      }
      if (q.page_size !== normalizedSize) {
        q.page_size = normalizedSize;
        shouldFetch = true;
      }
      if (shouldFetch) {
        fetchList();
      } else {
        tableBridge?.notifyTranslations?.();
      }
    },
  });

  const hasAuth = authHandler.restoreFromStorage();
  if (hasAuth) {
    init();
  } else {
    try {
      authHandler.openAuthModal?.();
    } catch (err) {
      console.error('Failed to open auth modal:', err);
    }
  }
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
    if (removeFiltersMediaListener) {
      try {
        removeFiltersMediaListener();
      } catch (err) {
        console.error(err);
      }
    }
    cleanupFilterSubscriptions();
    cleanupPhotoViewer();
  };
}
