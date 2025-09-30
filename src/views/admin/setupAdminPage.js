import { createApp, h } from 'vue';
import { Tooltip, Input } from 'ant-design-vue';
import { api as viewerApi } from 'v-viewer';
import Toastify from 'toastify-js';
import {
  ROLE_LIST,
  STATUS_VALUES,
  STATUS_TRANSLATION_KEYS,
  STATUS_ALIAS_MAP,
  DN_SCAN_STATUS_ORDERED_LIST,
  DN_SCAN_STATUS_VALUES,
  STATUS_DISPLAY_OVERRIDES,
} from '../../config.js';
import { getApiBase } from '../../utils/env.js';

import { createDnEntryManager } from './dnEntry.js';
import { createStatusCardManager } from './statusCards.js';
import { createLspSummaryCardManager } from './lspSummaryCards.js';
import { createFilterBridgeManager } from './filterBridgeManager.js';
import { getTodayDateStringInTimezone } from './dateUtils.js';
import { escapeHtml, setFormControlValue } from './utils.js';

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
  const mStatusDelivery = el('m-status-delivery');
  const mStatusDeliveryField = el('m-status-delivery-field');
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

  let editingId = 0;
  let editingItem = null;
  let currentRoleKey = null;
  let currentUserInfo = null;
  let cachedItems = [];
  let removeI18nListener = null;
  let viewerInstance = null;
  let statusMismatchTooltips = [];
  let detailInputMounts = [];

  const ROLE_MAP = new Map((ROLE_LIST || []).map((role) => [role.key, role]));
  const TRANSPORT_MANAGER_ROLE_KEY = 'transportManager';
  const ARCHIVE_THRESHOLD_DAYS = 55;
  const AUTH_STORAGE_KEY = 'jakarta-admin-auth-state';

  const notifyRoleChange = (roleKey, role, userInfo) => {
    if (typeof onRoleChange !== 'function') return;
    try {
      onRoleChange(roleKey || '', role || null, userInfo || null);
    } catch (err) {
      console.error(err);
    }
  };

  const STATUS_VALUE_TO_KEY = STATUS_TRANSLATION_KEYS || {};
  const STATUS_ALIAS_LOOKUP = STATUS_ALIAS_MAP || {};
  const STATUS_KNOWN_VALUES = new Set(Object.keys(STATUS_VALUE_TO_KEY));
  const STATUS_NOT_EMPTY_VALUE = '__NOT_EMPTY__';
  const STATUS_MISMATCH_TOOLTIP_FALLBACK =
    '配送状态(status_delivery)与司机上传的货物状态(status)不一致，请检查并更新。';
  const PLAN_MOS_TIME_ZONE = 'Asia/Jakarta';
  const PLAN_MOS_TIMEZONE_OFFSET_MINUTES = 7 * 60;
  const JAKARTA_UTC_OFFSET_MINUTES = 7 * 60;

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
  const TRANSPORT_MANAGER_STATUS_CARDS = [
    { status: STATUS_VALUES.PREPARE_VEHICLE, label: 'Prepare Vehicle' },
    { status: STATUS_VALUES.ON_THE_WAY, label: 'On The Way' },
    { status: STATUS_VALUES.ON_SITE, label: 'On Site' },
    { status: STATUS_VALUES.POD, label: 'POD' },
    { status: STATUS_VALUES.WAITING_PIC_FEEDBACK, label: 'Waiting PIC Feedback' },
    {
      status: STATUS_VALUES.REPLAN_MOS_LSP_DELAY,
      label: 'RePlan MOS due to LSP Delay',
    },
    { status: STATUS_VALUES.REPLAN_MOS_PROJECT, label: 'RePlan MOS Project' },
    { status: STATUS_VALUES.CANCEL_MOS, label: 'Cancel MOS' },
    { status: STATUS_VALUES.CLOSE_BY_RN, label: 'Close by RN' },
    { status: STATUS_VALUES.NO_STATUS, label: 'No Status' },
  ];
  const STATUS_DELIVERY_OPTIONS = [
    STATUS_VALUES.PREPARE_VEHICLE,
    STATUS_VALUES.ON_THE_WAY,
    STATUS_VALUES.ON_SITE,
    STATUS_VALUES.POD,
    STATUS_VALUES.WAITING_PIC_FEEDBACK,
  ];
  const DEFAULT_MODAL_STATUS_ORDER =
    Array.isArray(DN_SCAN_STATUS_ORDERED_LIST) &&
    DN_SCAN_STATUS_ORDERED_LIST.length
      ? DN_SCAN_STATUS_ORDERED_LIST.map((value) =>
          typeof value === 'string' ? value.trim() : String(value || '')
        ).filter(Boolean)
      : [
          'ARRIVED AT WH',
          'TRANSPORTING FROM WH',
          'ARRIVED AT XD/PM',
          'TRANSPORTING FROM XD/PM',
          'ARRIVED AT SITE',
        ];
  const STATUS_ANY_VALUE = '';
  const DEFAULT_STATUS_VALUE = STATUS_NOT_EMPTY_VALUE;
  setFilterValue('status', DEFAULT_STATUS_VALUE);

  const expandedRowKeys = new Set();
  const SUMMARY_BASE_COLUMN_COUNT = 11;
  const SUMMARY_COLUMN_WITH_ACTIONS_COUNT = 12;
  const DETAIL_KEY_PRIORITY = [
    'du_id',
    'lsp',
    'region',
    'plan_mos_date',
    'area',
    'status_wh',
    'status_delivery',
    'status',
    'issue_remark',
    'remark',
    'photo_url',
    'lonlat',
    'mos_given_time',
    'expected_arrival_time_from_project',
    'hw_tracker',
    'lsp_tracker',
    'driver_contact_name',
    'driver_contact_number',
    'transportation_time',
    'distance_poll_mover_to_site',
    'delivery_type_a_to_b',
    'estimate_depart_from_start_point_etd',
    'estimate_arrive_sites_time_eta',
    'actual_depart_from_start_point_atd',
    'actual_arrive_time_ata',
    'mos_attempt_1st_time',
    'mos_attempt_2nd_time',
    'mos_attempt_3rd_time',
    'mos_attempt_4th_time',
    'mos_attempt_5th_time',
    'mos_attempt_6th_time',
    'project_request',
    'mos_type',
    'subcon',
    'subcon_receiver_contact_number',
    'gs_sheet',
    'gs_row',
    'created_at',
    'last_updated_by',
    'latest_record_created_at',
  ];
  const DETAIL_INPUT_FIELD_SET = new Set(
    [
      'distance_poll_mover_to_site',
      'driver_contact_name',
      'driver_contact_number',
      'delivery_type_a_to_b',
      'transportation_time',
      'estimate_depart_from_start_point_etd',
      'estimate_arrive_sites_time_eta',
    ].map((key) => key.toLowerCase())
  );
  const REGION_FIELD_CANDIDATES = [
    'region',
    'region_name',
    'regionName',
    'area',
    'territory',
  ];
  const PLAN_MOS_DATE_FIELD_CANDIDATES = [
    'plan_mos_date',
    'plan_mos',
    'plan_date',
    'plan_mos_datetime',
    'plan_mos_at',
    'plan_mos_time',
    'plan_mos_dt',
    'plan_delivery_date',
  ];
  const ISSUE_REMARK_FIELD_CANDIDATES = [
    'issue_remark',
    'issueRemark',
    'issue_remarks',
    'issueRemarks',
    'issue_note',
    'issue_notes',
  ];
  const STATUS_DELIVERY_FIELD_CANDIDATES = [
    'status_delivery',
    'delivery_status',
    'statusDelivery',
    'deliveryStatus',
    'status_deliver',
  ];
  const UPDATED_AT_FIELD_CANDIDATES = [
    'updated_at',
    'created_at',
    'updatedAt',
    'createdAt',
    'last_updated',
    'lastUpdate',
    'lastUpdated',
    'modified_at',
    'modifiedAt',
    'timestamp',
  ];
  const LSP_FIELD_CANDIDATES = [
    'lsp',
    'lsp_name',
    'lsp_code',
    'logistics_provider',
    'logistics_service_provider',
    'logistic_provider',
    'provider',
    'provider_name',
  ];
  const ORIGIN_FIELD_CANDIDATES = [
    'origin_location',
    'origin',
    'origin_address',
    'origin_city',
    'origin_branch',
    'from_location',
    'from',
    'from_address',
    'from_city',
    'pickup_location',
    'pickup_address',
    'pickup_city',
    'start_location',
    'start_address',
  ];
  const DESTINATION_FIELD_CANDIDATES = [
    'destination_location',
    'destination',
    'destination_address',
    'destination_city',
    'destination_branch',
    'to_location',
    'to',
    'to_address',
    'to_city',
    'drop_location',
    'drop_address',
    'arrival_location',
    'arrival_address',
    'end_location',
    'end_address',
  ];
  const LAT_FIELD_CANDIDATES = ['lat', 'latitude'];
  const LNG_FIELD_CANDIDATES = ['lng', 'longitude', 'long'];
  const ORIGIN_FALLBACK_REGEX = /(origin|start|from|pickup)/i;
  const DESTINATION_FALLBACK_REGEX = /(destination|dest|to|drop|arrival|end)/i;
  const LSP_FALLBACK_REGEX = /(lsp|provider)/i;
  const PHOTO_FIELD_CANDIDATES = [
    'photo_url',
    'photo',
    'photo_urls',
    'photoUrl',
    'photoURL',
    'image_url',
    'image',
    'imageUrl',
    'picture_url',
    'attachment',
    'attachment_url',
  ];
  const SUMMARY_FIELD_KEYS = new Set([
    'dn_number',
    'status',
    'remark',
    'issue_remark',
    'issueRemark',
    'issue_remarks',
    'issueRemarks',
    'issue_note',
    'issue_notes',
    'status_delivery',
    'delivery_status',
    'statusDelivery',
    'deliveryStatus',
    'status_deliver',
    'photo_url',
    'photo',
    'photo_urls',
    'photoUrl',
    'photoURL',
    'image_url',
    'image',
    'imageUrl',
    'picture_url',
    'attachment',
    'attachment_url',
    'lat',
    'lng',
    'latitude',
    'longitude',
    'lsp',
    'lsp_name',
    'lsp_code',
    'logistics_provider',
    'logistics_service_provider',
    'logistic_provider',
    'provider',
    'provider_name',
    'provider_code',
    'region',
    'region_name',
    'regionName',
    'area',
    'territory',
    'plan_mos_date',
    'plan_mos',
    'plan_date',
    'plan_mos_datetime',
    'plan_mos_at',
    'plan_mos_time',
    'plan_mos_dt',
    'plan_delivery_date',
    'created_at',
    'updated_at',
    'updatedAt',
    'createdAt',
    'last_updated',
    'lastUpdate',
    'lastUpdated',
    'modified_at',
    'modifiedAt',
    'timestamp',
  ]);

  const ICON_MARKUP = Object.freeze({
    photo:
      '<svg aria-hidden="true" focusable="false" class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M4 7a2 2 0 0 1 2-2h2l1-1h6l1 1h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12" r="3.25" fill="currentColor"/></svg>',
    map:
      '<svg aria-hidden="true" focusable="false" class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12 2a6 6 0 0 0-6 6c0 4.63 6 12 6 12s6-7.37 6-12a6 6 0 0 0-6-6zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>',
    edit:
      '<svg aria-hidden="true" focusable="false" class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M5 17.5V21h3.5L18.37 11.13a1 1 0 0 0 0-1.41l-2.09-2.09a1 1 0 0 0-1.41 0L5 17.5zm12.71-9.21 1.4-1.4a1 1 0 0 0 0-1.42l-1.6-1.6a1 1 0 0 0-1.42 0l-1.4 1.4z"/></svg>',
    delete:
      '<svg aria-hidden="true" focusable="false" class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M9 3h6l.62 1.25H21V6H3V4.25h5.38L9 3zm-3 4h12l-.84 10.07A2 2 0 0 1 15.18 21H8.82a2 2 0 0 1-1.98-1.93z"/></svg>',
  });

  function getIconMarkup(name) {
    return ICON_MARKUP[name] || '';
  }

  function shouldShowActionsColumn() {
    return Boolean(currentRoleKey);
  }

  function getSummaryColumnCount(showActions = shouldShowActionsColumn()) {
    return showActions ? SUMMARY_COLUMN_WITH_ACTIONS_COUNT : SUMMARY_BASE_COLUMN_COUNT;
  }

  function updateActionColumnVisibility() {
    const show = shouldShowActionsColumn();
    if (actionsHeader) {
      actionsHeader.style.display = show ? '' : 'none';
    }
    if (tbl) {
      tbl.classList.toggle('has-actions', show);
    }
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

  function hideUpdatedAtColumn() {
    if (updatedAtHeader) {
      updatedAtHeader.style.display = 'none';
      updatedAtHeader.setAttribute('aria-hidden', 'true');
    }
    if (!tbody) return;
    tbody.querySelectorAll('td[data-column="updatedAt"]').forEach((cell) => {
      cell.style.display = 'none';
      cell.setAttribute('aria-hidden', 'true');
    });
  }

  updateActionColumnVisibility();
  hideHasAttachmentFilter();
  hideUpdatedAtColumn();

  const q = { page: 1, page_size: 20, mode: 'single', lastParams: '' };

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

  function cleanupViewer() {
    if (!viewerInstance) return;
    const instance = viewerInstance;
    viewerInstance = null;
    try {
      instance.destroy();
    } catch (err) {
      console.error(err);
    }
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

  async function copyTextToClipboard(text) {
    const value = typeof text === 'string' ? text : String(text || '');
    if (!value) return false;

    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (err) {
        console.error('Clipboard API copy failed', err);
      }
    }

    if (typeof document === 'undefined' || !document.body) {
      return false;
    }

    let textarea = null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);

      const selection = document.getSelection();
      const originalRange =
        selection && selection.rangeCount > 0
          ? selection.getRangeAt(0).cloneRange()
          : null;

      textarea.select();
      const copied = document.execCommand('copy');

      if (selection) {
        selection.removeAllRanges();
        if (originalRange) {
          selection.addRange(originalRange);
        }
      }

      return copied;
    } catch (err) {
      console.error('Fallback clipboard copy failed', err);
      return false;
    } finally {
      if (textarea && textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    }
  }

  function getCurrentRole() {
    return currentRoleKey ? ROLE_MAP.get(currentRoleKey) || null : null;
  }

  function getCurrentPermissions() {
    return getCurrentRole()?.permissions || null;
  }

  function isTransportManagerRole(roleKey = currentRoleKey) {
    return roleKey === TRANSPORT_MANAGER_ROLE_KEY;
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
    getCurrentRoleKey: () => currentRoleKey,
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

  const statusCards = createStatusCardManager({
    container: statusCardContainer,
    wrapper: statusCardWrapper,
    signal,
    API_BASE,
    i18n,
    getCurrentRole,
    normalizeStatusValue,
    i18nStatusDisplay,
    getStatusDeliveryValues: () => getFilterValues('status_delivery'),
    getStatusFilterValue: () => getSingleFilterValue('status'),
    transportManagerCards: TRANSPORT_MANAGER_STATUS_CARDS,
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

  function sanitizeUserInfo(user) {
    if (!user || typeof user !== 'object') return null;
    const info = {};
    if (user.id != null) info.id = user.id;
    if (typeof user.name === 'string') {
      const trimmed = user.name.trim();
      if (trimmed) info.name = trimmed;
    }
    return Object.keys(info).length ? info : null;
  }

  function getUserDisplayName(user) {
    if (!user || typeof user !== 'object') return '';
    if (typeof user.name === 'string') {
      const trimmed = user.name.trim();
      if (trimmed) return trimmed;
    }
    return '';
  }

  function getLocalStorageSafe() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  }

  function persistAuthState(roleKey, userInfo) {
    const storage = getLocalStorageSafe();
    if (!storage) return;
    try {
      if (!roleKey) {
        storage.removeItem(AUTH_STORAGE_KEY);
        return;
      }
      const payload = {
        roleKey,
        userInfo: sanitizeUserInfo(userInfo),
      };
      storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error(err);
    }
  }

  function loadStoredAuthState() {
    const storage = getLocalStorageSafe();
    if (!storage) return null;
    try {
      const raw = storage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const { roleKey } = parsed;
      if (!roleKey || !ROLE_MAP.has(roleKey)) {
        storage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }
      return {
        roleKey,
        userInfo: sanitizeUserInfo(parsed.userInfo),
      };
    } catch (err) {
      console.error(err);
      try {
        storage?.removeItem(AUTH_STORAGE_KEY);
      } catch (removeErr) {
        console.error(removeErr);
      }
    }
    return null;
  }

  function getEffectiveUserInfo() {
    if (currentUserInfo?.name) return currentUserInfo;
    const stored = loadStoredAuthState();
    if (stored?.userInfo) {
      const sanitized = sanitizeUserInfo({
        ...(currentUserInfo || {}),
        ...stored.userInfo,
      });
      if (sanitized) {
        currentUserInfo = sanitized;
        return sanitized;
      }
    }
    return currentUserInfo;
  }

  function normalizeStatusValue(raw) {
    const text = (raw || '').trim();
    if (!text) return '';
    const alias = STATUS_ALIAS_LOOKUP[text];
    if (alias) return alias;
    if (STATUS_KNOWN_VALUES.has(text)) return text;
    const upper = text.toUpperCase();
    if (STATUS_KNOWN_VALUES.has(upper)) return upper;
    return text;
  }

  function shouldShowStatusMismatch(statusDeliveryRaw, statusRaw) {
    const delivery = normalizeStatusValue(statusDeliveryRaw);
    const status = normalizeStatusValue(statusRaw);
    if (!delivery) return false;
    if (delivery === STATUS_VALUES.ON_THE_WAY) {
      return status === DN_SCAN_STATUS_VALUES.ARRIVED_AT_SITE;
    }
    if (
      delivery === STATUS_VALUES.ON_SITE ||
      delivery === STATUS_VALUES.POD
    ) {
      return status !== DN_SCAN_STATUS_VALUES.ARRIVED_AT_SITE;
    }
    return false;
  }

  function i18nStatusDisplay(value) {
    const canonical = normalizeStatusValue(value);
    const override =
      (STATUS_DISPLAY_OVERRIDES && STATUS_DISPLAY_OVERRIDES[canonical]) ||
      (STATUS_DISPLAY_OVERRIDES && STATUS_DISPLAY_OVERRIDES[value]);
    if (override) return override;
    const key = STATUS_VALUE_TO_KEY[canonical] || STATUS_VALUE_TO_KEY[value];
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

  function getStatusMismatchTooltipMessage() {
    return translateInstant('table.statusMismatchTooltip', STATUS_MISMATCH_TOOLTIP_FALLBACK);
  }

  function shouldRenderDetailInput(key) {
    if (!key) return false;
    const normalized = String(key).trim().toLowerCase();
    return DETAIL_INPUT_FIELD_SET.has(normalized);
  }

  function encodeDetailInputValue(value) {
    if (value === undefined || value === null) return '';
    try {
      return encodeURIComponent(String(value));
    } catch (err) {
      console.error(err);
    }
    return '';
  }

  function decodeDetailInputValue(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (err) {
      console.error(err);
    }
    return value;
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

  function getRowKey(item, index) {
    if (item && typeof item === 'object') {
      if (item.id !== undefined && item.id !== null) return `id:${item.id}`;
      if (item.dn_id !== undefined && item.dn_id !== null) return `dnid:${item.dn_id}`;
      if (item.uuid) return `uuid:${item.uuid}`;
      if (item.dn_number) return `dn:${item.dn_number}`;
    }
    return `idx:${index}`;
  }

  function getFirstNonEmpty(item, candidates) {
    if (!item || typeof item !== 'object' || !Array.isArray(candidates)) return '';
    for (const key of candidates) {
      if (!key) continue;
      if (Object.prototype.hasOwnProperty.call(item, key)) {
        const val = normalizeTextValue(item[key]);
        if (val) return val;
      }
    }
    return '';
  }

  function collectValues(item, candidates) {
    const list = [];
    const seen = new Set();
    if (!item || typeof item !== 'object' || !Array.isArray(candidates)) {
      return list;
    }
    candidates.forEach((key) => {
      if (!key) return;
      if (!Object.prototype.hasOwnProperty.call(item, key)) return;
      const val = normalizeTextValue(item[key]);
      if (!val || seen.has(val)) return;
      seen.add(val);
      list.push(val);
    });
    return list;
  }

  function getValuesByRegex(item, regex, exclude = new Set()) {
    const values = [];
    const seen = new Set();
    if (!item || typeof item !== 'object' || !regex) return values;
    Object.entries(item).forEach(([key, raw]) => {
      if (!regex.test(key)) return;
      if (exclude.has(key)) return;
      const val = normalizeTextValue(raw);
      if (!val || seen.has(val)) return;
      seen.add(val);
      values.push(val);
    });
    return values;
  }

  function getLspDisplay(item) {
    const direct = getFirstNonEmpty(item, LSP_FIELD_CANDIDATES);
    if (direct) return direct;
    const fallbackValues = getValuesByRegex(
      item,
      LSP_FALLBACK_REGEX,
      new Set(LSP_FIELD_CANDIDATES)
    );
    return fallbackValues.join(' / ');
  }

  function getLocationDisplay(item, candidates, regex) {
    const values = collectValues(item, candidates);
    if (!values.length && regex) {
      values.push(...getValuesByRegex(item, regex, new Set(candidates)));
    }
    return values.join(' / ');
  }

  function getOriginDisplay(item) {
    return getLocationDisplay(item, ORIGIN_FIELD_CANDIDATES, ORIGIN_FALLBACK_REGEX);
  }

  function getDestinationDisplay(item) {
    return getLocationDisplay(item, DESTINATION_FIELD_CANDIDATES, DESTINATION_FALLBACK_REGEX);
  }

  function getRegionDisplay(item) {
    return getFirstNonEmpty(item, REGION_FIELD_CANDIDATES);
  }

  function getPlanMosDateDisplay(item) {
    return getFirstNonEmpty(item, PLAN_MOS_DATE_FIELD_CANDIDATES);
  }

  function getIssueRemarkDisplay(item) {
    return getFirstNonEmpty(item, ISSUE_REMARK_FIELD_CANDIDATES);
  }

  function getStatusDeliveryCanonicalValue(item) {
    const raw = getFirstNonEmpty(item, STATUS_DELIVERY_FIELD_CANDIDATES);
    return normalizeStatusValue(raw);
  }

  function getStatusDeliveryDisplay(item) {
    return getFirstNonEmpty(item, STATUS_DELIVERY_FIELD_CANDIDATES);
  }

  function getUpdatedAtDisplay(item) {
    return getFirstNonEmpty(item, UPDATED_AT_FIELD_CANDIDATES);
  }

  function getCoordinateParts(item) {
    const lat = getFirstNonEmpty(item, LAT_FIELD_CANDIDATES);
    const lng = getFirstNonEmpty(item, LNG_FIELD_CANDIDATES);
    return [lat, lng];
  }

  function getPhotoUrl(item) {
    if (!item || typeof item !== 'object') return '';
    const direct = getFirstNonEmpty(item, PHOTO_FIELD_CANDIDATES);
    if (direct) return direct;
    const fallback = getValuesByRegex(
      item,
      /(photo|image|picture|attachment)/i,
      new Set(PHOTO_FIELD_CANDIDATES)
    );
    return fallback.length ? fallback[0] : '';
  }

  function buildLocationCell(item) {
    const [lat, lng] = getCoordinateParts(item);
    if (lat && lng) {
      const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(
        lng
      )}`;
      const safeMapUrl = escapeHtml(mapUrl);
      const label = translateInstant('table.mapIconLabel', 'Open in Google Maps') || 'Open in Google Maps';
      const safeLabel = escapeHtml(label);
      const icon = getIconMarkup('map');
      return `<div class="coord-cell"><a href="${safeMapUrl}" target="_blank" rel="noopener" class="icon-link map-link" aria-label="${safeLabel}" data-i18n-aria-label="table.mapIconLabel" title="${safeLabel}" data-i18n-title="table.mapIconLabel">${icon}</a></div>`;
    }
    return '<span class="muted">-</span>';
  }

  function buildPhotoCell(item) {
    const photo = getPhotoUrl(item);
    if (!photo) {
      return '<span class="muted">-</span>';
    }
    const absUrl = toAbsUrl(photo);
    const safeUrl = escapeHtml(absUrl);
    const label = translateInstant('table.photoIconLabel', 'View photo') || 'View photo';
    const safeLabel = escapeHtml(label);
    return `<button type="button" class="icon-link view-link" data-url="${safeUrl}" aria-label="${safeLabel}" data-i18n-aria-label="table.photoIconLabel" title="${safeLabel}" data-i18n-title="table.photoIconLabel">${getIconMarkup('photo')}</button>`;
  }

  const HIDDEN_DETAIL_FIELDS = new Set(['dn_number', 'id', 'lng', 'lat']);

  function collectDetailEntries(item) {
    if (!item || typeof item !== 'object') return [];
    const entries = Object.entries(item).filter(([key]) => {
      const normalizedKey = String(key).trim().toLowerCase();
      return !HIDDEN_DETAIL_FIELDS.has(normalizedKey);
    });
    const hasLonlatEntry = entries.some(
      ([key]) => String(key).trim().toLowerCase() === 'lonlat'
    );
    const latValue = item?.lat ?? item?.latitude;
    const lngValue = item?.lng ?? item?.longitude;
    const hasCoordinates =
      latValue !== undefined &&
      latValue !== null &&
      lngValue !== undefined &&
      lngValue !== null;
    if (!entries.length && !hasCoordinates) {
      return [];
    }
    if (!hasLonlatEntry && hasCoordinates) {
      entries.push(['lonlat', `${lngValue},${latValue}`]);
    }
    if (!entries.length) return [];
    const priority = new Map();
    DETAIL_KEY_PRIORITY.forEach((key, index) => {
      if (!priority.has(key)) priority.set(key, index);
    });
    return entries.sort(([a], [b]) => {
      const keyA = String(a);
      const keyB = String(b);
      const pa = priority.has(keyA) ? priority.get(keyA) : Infinity;
      const pb = priority.has(keyB) ? priority.get(keyB) : Infinity;
      if (pa !== pb) return pa - pb;
      return keyA.localeCompare(keyB);
    });
  }

  function formatDetailValue(key, value, item) {
    if (value === null || value === undefined || value === '') {
      return '<span class="muted">-</span>';
    }
    if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof Date))) {
      try {
        return `<pre class="detail-json">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
      } catch (err) {
        console.error(err);
        return escapeHtml(String(value));
      }
    }
    const text = normalizeTextValue(value);
    if (!text) return '<span class="muted">-</span>';
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'lonlat') {
      const deriveCoordinate = (source) => {
        if (source === null || source === undefined) return null;
        if (typeof source === 'number') return source;
        const trimmed = String(source).trim();
        return trimmed ? trimmed : null;
      };
      let lng = deriveCoordinate(item?.lng ?? item?.longitude);
      let lat = deriveCoordinate(item?.lat ?? item?.latitude);
      const hasCoord = (coord) => coord !== null && coord !== undefined && coord !== '';
      if ((!hasCoord(lng) || !hasCoord(lat)) && typeof value === 'string') {
        const parts = value.split(',');
        if (parts.length >= 2) {
          if (!hasCoord(lng)) lng = deriveCoordinate(parts[0]);
          if (!hasCoord(lat)) lat = deriveCoordinate(parts[1]);
        }
      }
      if (hasCoord(lng) && hasCoord(lat)) {
        const lngText = String(lng).trim();
        const latText = String(lat).trim();
        const mapQuery = `${latText},${lngText}`;
        const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}`;
        const safeUrl = escapeHtml(mapUrl);
        const displayText = escapeHtml(`${lngText}, ${latText}`);
        return `<a href="${safeUrl}" target="_blank" rel="noopener">${displayText}</a>`;
      }
    }
    if (/photo|image|picture|attachment/.test(lowerKey)) {
      const absUrl = toAbsUrl(text);
      const safeUrl = escapeHtml(absUrl);
      const viewLabel = translateInstant('table.view', '查看') || '查看';
      const safeLabel = escapeHtml(viewLabel);
      return `<div class="detail-links"><button type="button" class="view-link" data-url="${safeUrl}" data-i18n="table.view">${safeLabel}</button></div>`;
    }
    if (/url/.test(lowerKey)) {
      const absUrl = toAbsUrl(text);
      const safeUrl = escapeHtml(absUrl);
      return `<a href="${safeUrl}" target="_blank" rel="noopener">${safeUrl}</a>`;
    }
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function buildDetailContent(item, entries) {
    const title =
      '<div class="detail-title" data-i18n="details.title">全部字段</div>';
    if (!entries || !entries.length) {
      return `<div class="detail-content">${title}<div class="muted" data-i18n="details.empty">暂无更多字段。</div></div>`;
    }
    const meta = '';
    const rows = entries
      .map(([key, value]) => {
        const keyString = String(key);
        const safeKey = escapeHtml(keyString);
        if (shouldRenderDetailInput(keyString)) {
          const textValue = normalizeTextValue(value);
          const encodedValue = escapeHtml(encodeDetailInputValue(textValue));
          const attrKey = escapeHtml(keyString.trim().toLowerCase());
          return [
            '<div class="detail-item detail-item-input">',
            `<div class="detail-key">${safeKey}</div>`,
            `<div class="detail-value detail-value-input" data-input-key="${attrKey}" data-input-value="${encodedValue}"></div>`,
            '</div>',
          ].join('');
        }
        const valueHtml = formatDetailValue(keyString, value, item);
        return [
          '<div class="detail-item">',
          `<div class="detail-key">${safeKey}</div>`,
          `<div class="detail-value">${valueHtml}</div>`,
          '</div>',
        ].join('');
      })
      .join('');
    const saveLabel = translateInstant('details.save', '保存') || '保存';
    const saveButtonHtml = `<div class="detail-actions"><button type="button" class="btn detail-save-btn" disabled aria-disabled="true" data-i18n="details.save">${escapeHtml(saveLabel)}</button></div>`;
    return `<div class="detail-content">${title}${meta}<div class="detail-grid">${rows}</div>${saveButtonHtml}</div>`;
  }

  function buildSummaryRow(item, detailEntries, { rowKey, expanded, hasDetails, showActions }) {
    const detailAvailable =
      typeof hasDetails === 'boolean'
        ? hasDetails && detailEntries.length > 0
        : detailEntries.length > 0 &&
          detailEntries.some(([key]) => !SUMMARY_FIELD_KEYS.has(String(key)));
    const classes = ['summary-row'];
    if (detailAvailable) classes.push('expandable');
    if (expanded && detailAvailable) classes.push('expanded');
    const classAttr = classes.join(' ');
    const tabAttr = detailAvailable ? ' tabindex="0"' : '';
    const ariaAttr = detailAvailable ? ` aria-expanded="${expanded ? 'true' : 'false'}"` : '';
    const rawDnNumber = item?.dn_number ? String(item.dn_number) : '';
    const safeDnNumber = rawDnNumber ? escapeHtml(rawDnNumber) : '';
    const dnNumberDisplay = safeDnNumber || '<span class="muted">-</span>';
    const lsp = getLspDisplay(item);
    const region = getRegionDisplay(item);
    const planMos = getPlanMosDateDisplay(item);
    const issueRemark = getIssueRemarkDisplay(item);
    const statusDelivery = getStatusDeliveryDisplay(item);
    const statusDeliveryCanonical = getStatusDeliveryCanonicalValue(item);
    const updatedAt = getUpdatedAtDisplay(item);
    const remarkText = normalizeTextValue(item?.remark);
    const remarkDisplay = remarkText
      ? escapeHtml(remarkText).replace(/\n/g, '<br>')
      : '<span class="muted">-</span>';
    const statusValue = normalizeStatusValue(item?.status);
    const statusRaw = statusValue || item?.status || '';
    const statusCell = `<td data-raw-status="${escapeHtml(statusRaw)}" data-status-delivery="${escapeHtml(
      statusDeliveryCanonical || ''
    )}">${i18nStatusDisplay(statusRaw)}</td>`;
    const photoCell = buildPhotoCell(item);
    const locationCell = buildLocationCell(item);
    const lspCell = lsp ? escapeHtml(lsp) : '<span class="muted">-</span>';
    const regionCell = region ? escapeHtml(region) : '<span class="muted">-</span>';
    const planCell = planMos ? escapeHtml(planMos) : '<span class="muted">-</span>';
    const issueRemarkCell = issueRemark
      ? escapeHtml(issueRemark).replace(/\n/g, '<br>')
      : '<span class="muted">-</span>';
    const statusDeliveryCell = statusDelivery
      ? escapeHtml(statusDelivery).replace(/\n/g, '<br>')
      : '<span class="muted">-</span>';
    const updatedCell = updatedAt ? escapeHtml(updatedAt) : '<span class="muted">-</span>';
    const hint = detailAvailable
      ? '<div class="summary-hint" data-i18n="table.expandHint">点击查看全部字段</div>'
      : '';
    const actionsContent = showActions ? buildActionCell(item, remarkText || '') : '';

    const firstCell = `      <td>
        <div class="summary-cell">
          <span class="row-toggle" aria-hidden="true"></span>
          <div class="summary-primary" data-dn-number="${safeDnNumber}">${dnNumberDisplay}</div>
        </div>
        ${hint}
      </td>`;

    const cells = [
      firstCell,
      `      <td>${regionCell}</td>`,
      `      <td>${planCell}</td>`,
      `      <td>${lspCell}</td>`,
      `      <td>${issueRemarkCell}</td>`,
      `      <td>${statusDeliveryCell}</td>`,
      `      ${statusCell}`,
      `      <td>${remarkDisplay}</td>`,
      `      <td>${photoCell}</td>`,
      `      <td>${locationCell}</td>`,
      `      <td data-column="updatedAt" aria-hidden="true" style="display: none">${updatedCell}</td>`,
    ];
    if (showActions) {
      cells.push(`      <td>${actionsContent || '<span class="muted">-</span>'}</td>`);
    }

    const cellsHtml = cells.join('\n');
    return `<tr class="${classAttr}" data-row-key="${escapeHtml(rowKey)}"${tabAttr}${ariaAttr}>
${cellsHtml}
    </tr>`;
  }

  function buildDetailRow(
    item,
    detailEntries,
    { rowKey, expanded, hasDetails, summaryColumnCount }
  ) {
    const detailAvailable =
      typeof hasDetails === 'boolean'
        ? hasDetails && detailEntries.length > 0
        : detailEntries.length > 0 &&
          detailEntries.some(([key]) => !SUMMARY_FIELD_KEYS.has(String(key)));
    if (!detailAvailable) return '';
    const classAttr = `detail-row${expanded ? ' expanded' : ''}`;
    const styleAttr = expanded ? '' : ' style="display: none"';
    const content = buildDetailContent(item, detailEntries);
    const colSpan = summaryColumnCount || getSummaryColumnCount();
    return `<tr class="${classAttr}" data-row-key="${escapeHtml(rowKey)}"${styleAttr}>
      <td colspan="${colSpan}">${content}</td>
    </tr>`;
  }

  function findRowElements(rowKey) {
    if (!tbody) return { summary: null, detail: null };
    let summary = null;
    let detail = null;
    tbody.querySelectorAll('tr[data-row-key]').forEach((row) => {
      if (row.getAttribute('data-row-key') !== rowKey) return;
      if (row.classList.contains('summary-row')) summary = row;
      else if (row.classList.contains('detail-row')) detail = row;
    });
    return { summary, detail };
  }

  function toggleRow(rowKey, expand) {
    if (!rowKey) return;
    const { summary, detail } = findRowElements(rowKey);
    if (!summary || !detail) return;
    const next = expand !== undefined ? !!expand : !summary.classList.contains('expanded');
    summary.classList.toggle('expanded', next);
    summary.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (next) {
      detail.style.display = '';
      detail.classList.add('expanded');
      expandedRowKeys.add(rowKey);
    } else {
      detail.style.display = 'none';
      detail.classList.remove('expanded');
      expandedRowKeys.delete(rowKey);
    }
  }

  function applyAllTranslations() {
    if (typeof applyTranslations === 'function') {
      applyTranslations();
    }
    translateStatusCells();
    updateAuthButtonLabel();
    updateRoleBadge();
    statusCards.updateLabels();
    statusCards.updateActiveState();
    lspSummaryCards.updateActiveState();
    refreshDnEntryVisibility();
    populateModalStatusOptions(mStatus?.value || '');
    populateModalStatusDeliveryOptions(mStatusDelivery?.value || '');
    dnEntry.renderFilterPreview();
    updateDetailSaveButtonLabels();
  }

  if (i18n && typeof i18n.onChange === 'function') {
    removeI18nListener = i18n.onChange(() => {
      applyAllTranslations();
    });
  }

  function setRole(nextRoleKey, userInfo = null) {
    currentRoleKey = nextRoleKey || null;
    currentUserInfo = sanitizeUserInfo(userInfo);
    updateAuthButtonLabel();
    updateRoleBadge();
    refreshDnEntryVisibility();
    populateModalStatusOptions(mStatus?.value || '');
    populateModalStatusDeliveryOptions(mStatusDelivery?.value || '');
    updateModalFieldVisibility();
    updateActionColumnVisibility();
    rerenderTableActions();
    statusCards.render();
    statusCards.refreshCounts();
    lspSummaryCards.updateActiveState();
    persistAuthState(currentRoleKey, currentUserInfo);
    const role = currentRoleKey ? ROLE_MAP.get(currentRoleKey) || null : null;
    notifyRoleChange(currentRoleKey || '', role, currentUserInfo);
  }

  function getRoleLabel(role) {
    if (!role) return '';
    const fallback = role.label || role.description || role.key;
    if (!i18n) return fallback;
    try {
      const key = `roles.${role.key}`;
      const translated = i18n.t(key);
      if (translated && translated !== key) return translated;
    } catch (err) {
      console.error(err);
    }
    return fallback;
  }

  function updateAuthButtonLabel() {
    if (!authBtn) return;
    const role = getCurrentRole();
    const displayName = getUserDisplayName(currentUserInfo);
    if (displayName) {
      authBtn.textContent = displayName;
      authBtn.removeAttribute('data-i18n');
      return;
    }
    const key = role ? 'auth.switch' : 'auth.trigger';
    const label = role ? getRoleLabel(role) : i18n?.t(key) || '授权';
    authBtn.textContent = label;
    authBtn.setAttribute('data-i18n', key);
  }

  function updateRoleBadge() {
    if (!authRoleTag) return;
    const role = getCurrentRole();
    if (!role) {
      authRoleTag.textContent = '';
      authRoleTag.style.display = 'none';
      return;
    }
    const roleLabel = getRoleLabel(role);
    if (i18n) {
      const tpl = i18n.t('auth.current');
      if (tpl && tpl !== 'auth.current') {
        authRoleTag.textContent = tpl.replace('{role}', roleLabel);
      } else {
        authRoleTag.textContent = `当前角色：${roleLabel}`;
      }
    } else {
      authRoleTag.textContent = `当前角色：${roleLabel}`;
    }
    authRoleTag.style.display = '';
  }

  function updateModalFieldVisibility() {
    const perms = getCurrentPermissions();
    const allowRemark = Boolean(perms?.allowRemark);
    const allowPhoto = Boolean(perms?.allowPhoto);
    const allowStatusDelivery = Boolean(perms?.canEdit);

    if (mStatusDeliveryField) {
      mStatusDeliveryField.style.display = allowStatusDelivery ? '' : 'none';
    }
    if (mStatusDelivery) {
      mStatusDelivery.disabled = !allowStatusDelivery;
      if (!allowStatusDelivery) {
        setFormControlValue(mStatusDelivery, '');
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
    const canonical = normalizeStatusValue(value);
    if (!canonical) return '';
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
    const baseList = rawAllowed.length ? rawAllowed : DEFAULT_MODAL_STATUS_ORDER;
    const seen = new Set();
    const normalized = [];

    baseList.forEach((value) => {
      const canonical = normalizeStatusValue(value);
      if (!canonical || seen.has(canonical)) return;
      seen.add(canonical);
      normalized.push(canonical);
    });

    const ordered = [];
    DEFAULT_MODAL_STATUS_ORDER.forEach((value) => {
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
      ordered.push(...DEFAULT_MODAL_STATUS_ORDER);
    }

    const selectedRaw = selected || '';
    const selectedCanonical = normalizeStatusValue(selectedRaw);
    if (selectedCanonical && !ordered.includes(selectedCanonical)) {
      ordered.push(selectedCanonical);
    }

    const keepLabel = i18n?.t('modal.status.keep') || '（不修改）';
    mStatus.innerHTML = '';
    const keepOption = document.createElement('option');
    keepOption.value = '';
    keepOption.setAttribute('data-i18n', 'modal.status.keep');
    keepOption.textContent = keepLabel;
    mStatus.appendChild(keepOption);

    const appended = new Set();
    ordered.forEach((value) => {
      const canonical = normalizeStatusValue(value);
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

  function populateModalStatusDeliveryOptions(selected) {
    if (!mStatusDelivery) return;
    const selectedRaw = selected || '';
    const selectedCanonical = normalizeStatusValue(selectedRaw);
    const keepLabel = i18n?.t('modal.statusDelivery.keep') || '（不修改）';

    mStatusDelivery.innerHTML = '';
    const keepOption = document.createElement('option');
    keepOption.value = '';
    keepOption.setAttribute('data-i18n', 'modal.statusDelivery.keep');
    keepOption.textContent = keepLabel;
    mStatusDelivery.appendChild(keepOption);

    const appended = new Set();
    STATUS_DELIVERY_OPTIONS.forEach((value) => {
      const canonical = normalizeStatusValue(value);
      if (!canonical || appended.has(canonical)) return;
      appended.add(canonical);
      const opt = document.createElement('option');
      opt.value = canonical;
      opt.textContent = getModalStatusLabel(canonical);
      if (canonical === selectedCanonical) {
        opt.selected = true;
      }
      mStatusDelivery.appendChild(opt);
    });

    if (selectedCanonical && !appended.has(selectedCanonical)) {
      const opt = document.createElement('option');
      opt.value = selectedCanonical;
      opt.textContent = getModalStatusLabel(selectedCanonical);
      opt.selected = true;
      mStatusDelivery.appendChild(opt);
      appended.add(selectedCanonical);
    }

    if (selectedCanonical) {
      setFormControlValue(mStatusDelivery, selectedCanonical);
    } else {
      setFormControlValue(mStatusDelivery, '');
    }
  }

  function syncStatusDeliveryWithStatus() {
    if (!mStatus || !mStatusDelivery) return;
    const canonicalStatus = normalizeStatusValue(mStatus.value);
    if (!canonicalStatus) {
      setFormControlValue(mStatusDelivery, '');
      return;
    }
    const nextValue =
      canonicalStatus === DN_SCAN_STATUS_VALUES.ARRIVED_AT_SITE
        ? STATUS_VALUES.ON_SITE
        : STATUS_VALUES.ON_THE_WAY;
    setFormControlValue(mStatusDelivery, nextValue);
  }

  if (mStatus && mStatusDelivery) {
    mStatus.addEventListener(
      'change',
      () => {
        syncStatusDeliveryWithStatus();
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

  function cleanupStatusMismatchTooltips() {
    if (!statusMismatchTooltips.length) return;
    statusMismatchTooltips.forEach(({ app, mountEl }) => {
      try {
        app.unmount();
      } catch (err) {
        console.error(err);
      }
      if (mountEl && mountEl.parentNode) {
        mountEl.parentNode.removeChild(mountEl);
      }
    });
    statusMismatchTooltips = [];
  }

  function cleanupDetailInputs() {
    if (!detailInputMounts.length) return;
    detailInputMounts.forEach(({ app, mountEl }) => {
      try {
        app.unmount();
      } catch (err) {
        console.error(err);
      }
      if (mountEl) {
        mountEl.innerHTML = '';
        delete mountEl.dataset.inputCurrent;
      }
    });
    detailInputMounts = [];
  }

  function setupDetailInputs() {
    if (!tbody) return;
    const targets = tbody.querySelectorAll('.detail-value[data-input-key]');
    if (!targets.length) return;
    targets.forEach((target) => {
      const encodedValue = target.getAttribute('data-input-value') || '';
      const initialValue = decodeDetailInputValue(encodedValue);
      const app = createApp({
        data() {
          return {
            currentValue: initialValue,
          };
        },
        render() {
          return h(Input, {
            value: this.currentValue,
            'onUpdate:value': (next) => {
              this.currentValue = next;
              target.dataset.inputCurrent = encodeDetailInputValue(next);
            },
          });
        },
      });
      target.dataset.inputCurrent = encodeDetailInputValue(initialValue);
      detailInputMounts.push({ app, mountEl: target });
      app.mount(target);
    });
  }

  function updateDetailSaveButtonLabels() {
    if (!tbody) return;
    const label = translateInstant('details.save', '保存') || '保存';
    tbody.querySelectorAll('.detail-save-btn').forEach((btn) => {
      btn.textContent = label;
    });
  }

  function setupStatusMismatchTooltips() {
    if (!tbody) return;
    const tooltipTargets = tbody.querySelectorAll(
      '.status-mismatch[data-status-mismatch="true"]'
    );
    if (!tooltipTargets.length) return;
    tooltipTargets.forEach((target) => {
      const message =
        target.getAttribute('data-tooltip-message') || getStatusMismatchTooltipMessage();
      const mountEl = document.createElement('span');
      target.appendChild(mountEl);
      const app = createApp({
        render() {
          return h(
            Tooltip,
            { title: message, placement: 'top' },
            {
              default: () =>
                h(
                  'span',
                  {
                    class: 'status-mismatch-icon',
                    role: 'img',
                    'aria-label': message,
                  },
                  '!'
                ),
            }
          );
        },
      });
      statusMismatchTooltips.push({ app, mountEl });
      app.mount(mountEl);
    });
  }

  function translateStatusCells() {
    if (!tbody) return;
    cleanupStatusMismatchTooltips();
    const tooltipMessage = getStatusMismatchTooltipMessage();
    const processedRows = new Set();
    tbody.querySelectorAll('td[data-raw-status]').forEach((td) => {
      const summaryRow = td.closest('tr.summary-row');
      if (summaryRow && !processedRows.has(summaryRow)) {
        summaryRow.classList.remove('status-mismatch-row');
        summaryRow.removeAttribute('data-status-mismatch');
        processedRows.add(summaryRow);
      }
      const raw = td.getAttribute('data-raw-status') || '';
      const canonical = normalizeStatusValue(raw);
      const value = canonical || raw;
      const display = i18nStatusDisplay(value);
      td.innerHTML = '';
      const textSpan = document.createElement('span');
      textSpan.className = 'status-text';
      textSpan.textContent = display || '';
      td.appendChild(textSpan);

      const statusDeliveryValue = td.getAttribute('data-status-delivery') || '';
      if (shouldShowStatusMismatch(statusDeliveryValue, raw)) {
        const indicator = document.createElement('span');
        indicator.className = 'status-mismatch';
        indicator.setAttribute('data-status-mismatch', 'true');
        indicator.setAttribute('data-tooltip-message', tooltipMessage);
        td.appendChild(indicator);
        if (summaryRow) {
          summaryRow.classList.add('status-mismatch-row');
          summaryRow.setAttribute('data-status-mismatch', 'true');
        }
      }
    });
    setupStatusMismatchTooltips();
  }

  function applyLspSummaryCardFilter(lspName) {
    const normalizedLsp = normalizeTextValue(lspName);
    if (!normalizedLsp) return;
    resetAllFilters({ statusValue: DEFAULT_STATUS_VALUE });
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
    const targetStatus = def?.type === 'status' ? canonicalStatus : '';
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

    // Clicking a status card should only apply the status_delivery filter.
    // Keep the status filter cleared so the query does not constrain by status.
    setFilterValue('status', '');

    setFilterValue('status_delivery', targetStatus);

    setFilterValue('plan_mos_date', todayJakarta);

    if (dnInput) {
      dnInput.value = '';
      dnEntry.normalizeFilterInput({ enforceFormat: false });
    }
  }

  function openViewerWithUrl(url) {
    if (!url) return;

    cleanupViewer();

    try {
      viewerInstance = viewerApi({
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
            cleanupViewer();
          },
        },
        images: [url],
      });
    } catch (err) {
      console.error(err);
      cleanupViewer();
    }
  }

  function buildActionCell(it, remark) {
    const perms = getCurrentPermissions();
    if (!perms || (!perms.canEdit && !perms.canDelete)) return '';
    const buttons = [];
    const canonicalStatus = normalizeStatusValue(it.status);
    const statusAttr = escapeHtml(canonicalStatus || it.status || '');
    const dnAttr = escapeHtml(it.dn_number || '');
    const duAttr = escapeHtml(it.du_id || '');
    const remarkAttr = escapeHtml(remark);
    if (perms.canEdit) {
      const editLabel = translateInstant('actions.edit', 'Edit') || 'Edit';
      const safeEditLabel = escapeHtml(editLabel);
      buttons.push(
        `<button type="button" class="icon-btn" data-act="edit" data-id="${it.id}" data-dn="${dnAttr}" data-status="${statusAttr}" data-remark="${remarkAttr}" data-du="${duAttr}" aria-label="${safeEditLabel}" data-i18n-aria-label="actions.edit" title="${safeEditLabel}" data-i18n-title="actions.edit">${getIconMarkup('edit')}</button>`
      );
    }
    if (perms.canDelete) {
      const deleteLabel = translateInstant('actions.delete', 'Delete') || 'Delete';
      const safeDeleteLabel = escapeHtml(deleteLabel);
      buttons.push(
        `<button type="button" class="icon-btn danger" data-act="del" data-id="${it.id}" data-dn="${dnAttr}" aria-label="${safeDeleteLabel}" data-i18n-aria-label="actions.delete" title="${safeDeleteLabel}" data-i18n-title="actions.delete">${getIconMarkup('delete')}</button>`
      );
    }
    if (!buttons.length) return '';
    return `<div class="actions">${buttons.join('')}</div>`;
  }

  function renderRows(items) {
    if (!tbody) return;
    updateActionColumnVisibility();
    cleanupStatusMismatchTooltips();
    cleanupDetailInputs();
    cachedItems = Array.isArray(items) ? items.slice() : [];
    const currentKeys = new Set();
    const showActions = shouldShowActionsColumn();
    const summaryColumnCount = getSummaryColumnCount(showActions);
    tbody.innerHTML = cachedItems
      .map((item, index) => {
        const rowKey = getRowKey(item, index);
        currentKeys.add(rowKey);
        const detailEntries = collectDetailEntries(item);
        const hasDetails =
          detailEntries.length > 0 &&
          detailEntries.some(([key]) => !SUMMARY_FIELD_KEYS.has(String(key)));
        const isExpanded = hasDetails && expandedRowKeys.has(rowKey);
        const summaryHtml = buildSummaryRow(item, detailEntries, {
          rowKey,
          expanded: isExpanded,
          hasDetails,
          showActions,
        });
        const detailHtml = buildDetailRow(item, detailEntries, {
          rowKey,
          expanded: isExpanded,
          hasDetails,
          summaryColumnCount,
        });
        if (!hasDetails) {
          expandedRowKeys.delete(rowKey);
        }
        return summaryHtml + (detailHtml || '');
      })
      .join('');
    setupDetailInputs();
    hideUpdatedAtColumn();
    Array.from(expandedRowKeys).forEach((key) => {
      if (!currentKeys.has(key)) {
        expandedRowKeys.delete(key);
      }
    });
  }

  function rerenderTableActions() {
    if (!tbody) return;
    renderRows(cachedItems);
    bindRowActions();
    applyAllTranslations();
  }

  function bindRowActions() {
    if (!tbody) return;
    tbody.querySelectorAll('button[data-act]').forEach((btn) => {
      const act = btn.getAttribute('data-act');
      const id = Number(btn.getAttribute('data-id'));
      if (act === 'edit') {
        btn.addEventListener(
          'click',
          () => {
            const item = cachedItems.find((it) => it.id === id);
            if (item) openModalEdit(item);
          },
          { signal }
        );
      } else if (act === 'del') {
        btn.addEventListener(
          'click',
          () => {
            const item = cachedItems.find((it) => it.id === id);
            if (item) {
              onDelete(item);
              return;
            }
            const dnAttr = btn.getAttribute('data-dn') || '';
            onDelete({ id, dn_number: dnAttr });
          },
          { signal }
        );
      }
    });

    tbody.querySelectorAll('.view-link').forEach((trigger) => {
      trigger.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          const url = trigger.getAttribute('data-url');
          if (typeof trigger.blur === 'function') {
            trigger.blur();
          }
          openViewerWithUrl(url);
        },
        { signal }
      );
    });

    tbody.querySelectorAll('.summary-primary').forEach((primary) => {
      primary.addEventListener(
        'click',
        async (event) => {
          event.stopPropagation();
          const dnValue = (primary.getAttribute('data-dn-number') || '').trim();
          if (!dnValue) return;
          const copied = await copyTextToClipboard(dnValue);
          if (copied) {
            showToast('已复制DN Number', 'success');
          } else {
            showToast('复制 DN Number 失败', 'error');
          }
        },
        { signal }
      );
    });

    tbody.querySelectorAll('tr.summary-row.expandable').forEach((row) => {
      const rowKey = row.getAttribute('data-row-key');
      if (!rowKey) return;
      row.addEventListener(
        'click',
        (event) => {
          if (!row.classList.contains('expandable')) return;
          const target = event.target;
          if (target && (target.closest('button') || target.closest('a'))) return;
          toggleRow(rowKey);
        },
        { signal }
      );
      row.addEventListener(
        'keydown',
        (event) => {
          if (!row.classList.contains('expandable')) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          const target = event.target;
          if (target && target !== row && target.closest('button, a')) {
            return;
          }
          event.preventDefault();
          toggleRow(rowKey);
        },
        { signal }
      );
    });
  }

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
      const deliveryOptions = payload?.status_delivery || payload?.status_deliver;
      setFilterDropdownOptions('status_delivery', deliveryOptions);
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
      const st = getSingleFilterValue('status');
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
      const statusDeliveryValues = getFilterValues('status_delivery');

      if (tokens.length === 1) params.set('dn_number', tokens[0]);
      if (du) params.set('du_id', du.toUpperCase());
      if (st === STATUS_NOT_EMPTY_VALUE) {
        params.set('status_not_empty', 'true');
      } else if (st) {
        params.set('status', st);
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
      if (statusDeliveryValues.length === 1) {
        params.set('status_delivery', statusDeliveryValues[0]);
      } else if (statusDeliveryValues.length > 1) {
        statusDeliveryValues.forEach((value) => params.append('status_delivery', value));
      }
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
      renderRows(items);
      bindRowActions();
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
    const canonicalStatus = normalizeStatusValue(item.status);
    populateModalStatusOptions(canonicalStatus);
    const statusDeliveryRaw =
      item.status_delivery ||
      item.statusDelivery ||
      item.status_deliver ||
      item.statusDeliver ||
      '';
    const canonicalStatusDelivery = normalizeStatusValue(statusDeliveryRaw);
    populateModalStatusDeliveryOptions(canonicalStatusDelivery);
    updateModalFieldVisibility();
    if (mMsg) mMsg.textContent = '';
    if (mask) mask.style.display = 'flex';
  }

  function closeModal() {
    if (mask) mask.style.display = 'none';
    editingId = 0;
    editingItem = null;
    if (mStatusDelivery) {
      setFormControlValue(mStatusDelivery, '');
    }
  }

  function buildFormDataForSave() {
    const perms = getCurrentPermissions();
    const form = new FormData();
    const statusValRaw = mStatus?.value || '';
    const statusVal = normalizeStatusValue(statusValRaw) || statusValRaw;
    const statusDeliveryRaw = mStatusDelivery?.value || '';
    const statusDeliveryVal =
      normalizeStatusValue(statusDeliveryRaw) || statusDeliveryRaw;
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

    const originalStatusRaw = currentItem?.status || '';
    const originalStatus =
      normalizeStatusValue(originalStatusRaw) || originalStatusRaw || '';
    const statusToSubmit = statusVal || originalStatus;
    if (statusToSubmit) {
      form.set('status', statusToSubmit);
    }
    const originalStatusDeliveryRaw =
      currentItem?.status_delivery ||
      currentItem?.statusDelivery ||
      currentItem?.status_deliver ||
      currentItem?.statusDeliver ||
      '';
    const originalStatusDelivery =
      normalizeStatusValue(originalStatusDeliveryRaw) || originalStatusDeliveryRaw || '';
    const statusDeliveryToSubmit = statusDeliveryVal || originalStatusDelivery;
    form.set('status_delivery', statusDeliveryToSubmit || '');
    if (remarkVal) form.set('remark', remarkVal);
    if (allowPhoto) {
      form.set('photo', mPhoto.files[0]);
    }
    return {
      form,
      statusVal,
      statusDeliveryVal,
      remarkVal,
      allowPhoto,
      dnNumber,
      statusToSubmit,
      statusDeliveryToSubmit,
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

    if (perms.requireStatusSelection && !payload.statusVal) {
      if (mMsg)
        mMsg.textContent = i18n
          ? i18n.t('modal.status.requiredHint')
          : '请选择允许的状态后再保存。';
      return false;
    }

    const allowedOptions = Array.isArray(perms?.statusOptions)
      ? perms.statusOptions.map((status) => normalizeStatusValue(status) || status)
      : [];

    if (
      payload.statusVal &&
      allowedOptions.length &&
      !allowedOptions.includes(payload.statusVal)
    ) {
      if (mMsg)
        mMsg.textContent = i18n
          ? i18n.t('modal.status.invalid')
          : '选择的状态不在当前角色的权限范围内。';
      return false;
    }

    if (!payload.statusToSubmit) {
      if (mMsg)
        mMsg.textContent = i18n
          ? i18n.t('modal.status.requiredHint')
          : '请选择允许的状态后再保存。';
      return false;
    }

    if (
      !payload.statusVal &&
      !payload.statusDeliveryVal &&
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
      ...DETAIL_KEY_PRIORITY,
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

  function openAuthModal() {
    if (!authModal) return;
    authModal.style.display = 'flex';
    if (authMsg) authMsg.textContent = '';
    if (authInput) {
      authInput.value = '';
      setTimeout(() => {
        try {
          authInput.focus();
        } catch (err) {
          console.error(err);
        }
      }, 30);
    }
  }

  function closeAuthModal() {
    if (authModal) authModal.style.display = 'none';
  }

  function findRoleByPassword(password) {
    if (!password) return null;
    for (const role of ROLE_LIST || []) {
      const users = Array.isArray(role?.users) ? role.users : [];
      const matchedUser = users.find((user) => user?.password === password);
      if (matchedUser) {
        return { role, user: matchedUser };
      }
    }
    return null;
  }

  function handleAuthSubmit() {
    if (!authInput) return;
    const pwd = authInput.value || '';
    if (!pwd.trim()) {
      if (authMsg) authMsg.textContent = i18n ? i18n.t('auth.modal.required') : '请输入密码';
      return;
    }
    if (authMsg) authMsg.textContent = i18n ? i18n.t('auth.modal.checking') : '验证中…';
    const matched = findRoleByPassword(pwd);
    if (!matched) {
      if (authMsg) authMsg.textContent = i18n ? i18n.t('auth.modal.failed') : '密码错误，请重试';
      return;
    }
    const sanitizedUser = sanitizeUserInfo(matched.user);
    setRole(matched.role.key, matched.user);
    closeAuthModal();
    const roleLabel = getRoleLabel(matched.role);
    const displayName = getUserDisplayName(sanitizedUser) || roleLabel || 'user';
    showToast(`You are logged in as ${displayName}.`, 'success');
    fetchList();
  }

  authBtn?.addEventListener('click', openAuthModal, { signal });
  authCancel?.addEventListener('click', closeAuthModal, { signal });
  authConfirm?.addEventListener('click', handleAuthSubmit, { signal });
  authModal?.addEventListener(
    'click',
    (e) => {
      if (e.target === authModal) closeAuthModal();
    },
    { signal }
  );
  authInput?.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAuthSubmit();
      }
    },
    { signal }
  );

  subscribeToFilterChange('status', () => {
    statusCards.updateActiveState();
  });

  subscribeToFilterChange('status_delivery', () => {
    statusCards.updateActiveState();
  });

  subscribeToFilterChange('lsp', () => {
    lspSummaryCards.updateActiveState();
  });

  function resetAllFilters({ statusValue = DEFAULT_STATUS_VALUE } = {}) {
    setFilterValue('status', statusValue);
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
    setFilterValue('status_delivery', '');
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
      resetAllFilters({ statusValue: DEFAULT_STATUS_VALUE });
      q.page = 1;
      fetchList();
    },
    { signal }
  );

  rootEl.addEventListener(
    'admin:status-switch-change',
    (event) => {
      const detail = event?.detail || {};
      const targetValue = detail.showOnlyNonEmpty ? DEFAULT_STATUS_VALUE : STATUS_ANY_VALUE;
      setFilterValue('status', targetValue);
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

  function restoreAuthFromStorage() {
    const stored = loadStoredAuthState();
    if (stored && stored.roleKey) {
      setRole(stored.roleKey, stored.userInfo);
    } else {
      updateAuthButtonLabel();
      updateRoleBadge();
      refreshDnEntryVisibility();
      populateModalStatusOptions('');
      populateModalStatusDeliveryOptions('');
      updateModalFieldVisibility();
      rerenderTableActions();
      statusCards.render();
      statusCards.refreshCounts();
      notifyRoleChange('', null, null);
    }
  }

  async function init() {
    dnEntry.normalizeFilterInput({ enforceFormat: false });
    if (hint) hint.textContent = i18n?.t('hint.ready') || '输入条件后点击查询。';
    await fetchFilterCandidates();
    await fetchList();
  }

  restoreAuthFromStorage();
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
    cleanupViewer();
    cleanupStatusMismatchTooltips();
    cleanupDetailInputs();
  };
}
