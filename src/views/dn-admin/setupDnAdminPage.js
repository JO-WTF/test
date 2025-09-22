import Viewer from 'viewerjs';
import Toastify from 'toastify-js';
import {
  ROLE_LIST,
  STATUS_TRANSLATION_KEYS,
  STATUS_ALIAS_MAP,
} from '../../config.js';

const API_BASE =
  (window.APP_CONFIG && window.APP_CONFIG.API_BASE) ||
  window.API_BASE ||
  window.location.origin;

const DN_SEPARATOR_SOURCE = '[\\s,，；;、\\u3001]+';
const DN_SEP_RE = new RegExp(DN_SEPARATOR_SOURCE, 'gu');
const DN_SEP_CAPTURE_RE = new RegExp(`(${DN_SEPARATOR_SOURCE})`, 'gu');
const DN_SEP_TEST_RE = new RegExp(`^${DN_SEPARATOR_SOURCE}$`, 'u');
const DN_VALID_RE = /^[A-Z0-9-]{1,64}$/;
const DU_RE_FULL = /^DID\d{13}$/;
const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\u2060\uFEFF]/g;

export function setupDnAdminPage(rootEl, { i18n, applyTranslations } = {}) {
  if (!rootEl) return () => {};

  const controller = new AbortController();
  const { signal } = controller;

  const el = (id) => rootEl.querySelector(`#${id}`);

  const dnInput = el('f-dn');
  const dnPreview = el('dn-preview');
  const duFilterInput = el('f-du');
  const tbl = el('tbl');
  const tbody = tbl?.querySelector('tbody');
  const actionsHeader = tbl?.querySelector('thead th[data-column="actions"]');
  const hint = el('hint');
  const pager = el('pager');
  const pginfo = el('pginfo');

  const statusSelect = el('f-status');
  const remarkInput = el('f-remark');
  const hasSelect = el('f-has');
  const fromInput = el('f-from');
  const toInput = el('f-to');
  const pageSizeInput = el('f-ps2');

  const mask = el('modal-mask');
  const mId = el('modal-id');
  const mStatus = el('m-status');
  const mRemark = el('m-remark');
  const mRemarkField = el('m-remark-field');
  const mPhoto = el('m-photo');
  const mPhotoField = el('m-photo-field');
  const mDuField = el('m-du-field');
  const mDuInput = el('m-du-id');
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

  const dnBtn = el('btn-dn-entry');
  const dnModal = el('dn-modal');
  const dnEntryInput = el('dn-input');
  const dnEntryPreview = el('dn-preview-modal');
  const dnClose = el('dn-close');
  const dnCancel = el('dn-cancel');
  const dnConfirm = el('dn-confirm');

  let editingId = 0;
  let currentRoleKey = null;
  let currentUserInfo = null;
  let cachedItems = [];
  let removeI18nListener = null;
  let statusCardDefs = [];
  const statusCardRefs = new Map();
  let statusCardAbortController = null;
  let statusCardRequestId = 0;
  let viewer = null;

  const ROLE_MAP = new Map((ROLE_LIST || []).map((role) => [role.key, role]));
  const AUTH_STORAGE_KEY = 'jakarta-dn-admin-auth-state';

  const STATUS_VALUE_TO_KEY = STATUS_TRANSLATION_KEYS || {};
  const STATUS_ALIAS_LOOKUP = STATUS_ALIAS_MAP || {};
  const STATUS_KNOWN_VALUES = new Set(Object.keys(STATUS_VALUE_TO_KEY));

  const expandedRowKeys = new Set();
  const SUMMARY_BASE_COLUMN_COUNT = 9;
  const SUMMARY_COLUMN_WITH_ACTIONS_COUNT = 10;
  const DETAIL_KEY_PRIORITY = [
    'id',
    'dn_id',
    'dn_number',
    'du_id',
    'lsp',
    'lsp_name',
    'lsp_code',
    'logistics_provider',
    'logistics_service_provider',
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
    'origin_location',
    'origin',
    'origin_address',
    'origin_city',
    'origin_branch',
    'from_location',
    'from_address',
    'from_city',
    'pickup_location',
    'pickup_address',
    'destination_location',
    'destination',
    'destination_address',
    'destination_city',
    'destination_branch',
    'to_location',
    'to_address',
    'status',
    'remark',
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
  ];
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

  updateActionColumnVisibility();

  const q = { page: 1, page_size: 20, mode: 'single', lastParams: '' };

  function buildSearchUrl(paramInput, mode = q.mode) {
    const params =
      typeof paramInput === 'string'
        ? paramInput
        : paramInput && typeof paramInput.toString === 'function'
        ? paramInput.toString()
        : '';
    const basePath =
      mode === 'batch' ? '/api/dn/batch/list/search?' : '/api/dn/list/search?';
    return `${API_BASE}${basePath}${params}`;
  }

  const viewerHost = document.createElement('div');
  viewerHost.id = 'viewer-host-dn';
  viewerHost.style.cssText =
    'position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;overflow:hidden;';
  document.body.appendChild(viewerHost);

  function cleanupViewer() {
    if (viewer) {
      try {
        viewer.destroy();
      } catch (err) {
        console.error(err);
      }
      viewer = null;
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
      gravity: 'top',
      position: 'right',
      stopOnFocus: true,
      style: { background: backgroundColor },
    }).showToast();
  }

  function getCurrentRole() {
    return currentRoleKey ? ROLE_MAP.get(currentRoleKey) || null : null;
  }

  function getCurrentPermissions() {
    return getCurrentRole()?.permissions || null;
  }

  function sanitizeUserInfo(user) {
    if (!user || typeof user !== 'object') return null;
    const info = {};
    if (user.id != null) info.id = user.id;
    if (user.name != null) info.name = user.name;
    return Object.keys(info).length ? info : null;
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

  function i18nStatusDisplay(value) {
    const canonical = normalizeStatusValue(value);
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      const coordsText = `${lat}, ${lng}`;
      const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(
        lng
      )}`;
      const safeMapUrl = escapeHtml(mapUrl);
      const label = translateInstant('table.mapIconLabel', 'Open in Google Maps') || 'Open in Google Maps';
      const safeLabel = escapeHtml(label);
      const icon = getIconMarkup('map');
      return `<div class="coord-cell"><div>${escapeHtml(coordsText)}</div><a href="${safeMapUrl}" target="_blank" rel="noopener" class="icon-link map-link" aria-label="${safeLabel}" data-i18n-aria-label="table.mapIconLabel" title="${safeLabel}" data-i18n-title="table.mapIconLabel">${icon}</a></div>`;
    }
    if (lat || lng) {
      return escapeHtml([lat, lng].filter(Boolean).join(', '));
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
    return `<a href="#" class="icon-link view-link" data-url="${safeUrl}" aria-label="${safeLabel}" data-i18n-aria-label="table.photoIconLabel" title="${safeLabel}" data-i18n-title="table.photoIconLabel">${getIconMarkup('photo')}</a>`;
  }

  function collectDetailEntries(item) {
    if (!item || typeof item !== 'object') return [];
    const entries = Object.entries(item);
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

  function formatDetailValue(key, value) {
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
    if (/photo|image|picture|attachment/.test(lowerKey)) {
      const absUrl = toAbsUrl(text);
      const safeUrl = escapeHtml(absUrl);
      return `<div class="detail-links"><a href="#" class="view-link" data-url="${safeUrl}" data-i18n="table.view">查看</a><a href="${safeUrl}" target="_blank" rel="noopener">${safeUrl}</a></div>`;
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
    const metaParts = [];
    if (item && typeof item === 'object') {
      if (item.dn_number) metaParts.push(escapeHtml(String(item.dn_number)));
      if (item.id !== undefined && item.id !== null) {
        metaParts.push(`#${escapeHtml(String(item.id))}`);
      }
    }
    const meta = metaParts.length ? `<div class="detail-meta">${metaParts.join(' · ')}</div>` : '';
    const rows = entries
      .map(([key, value]) => {
        const safeKey = escapeHtml(String(key));
        const valueHtml = formatDetailValue(String(key), value);
        return `<div class="detail-key">${safeKey}</div><div class="detail-value">${valueHtml}</div>`;
      })
      .join('');
    return `<div class="detail-content">${title}${meta}<div class="detail-grid">${rows}</div></div>`;
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
    const dnNumber = item?.dn_number ? escapeHtml(String(item.dn_number)) : '<span class="muted">-</span>';
    const lsp = getLspDisplay(item);
    const region = getRegionDisplay(item);
    const planMos = getPlanMosDateDisplay(item);
    const updatedAt = getUpdatedAtDisplay(item);
    const remarkText = normalizeTextValue(item?.remark);
    const remarkDisplay = remarkText
      ? escapeHtml(remarkText).replace(/\n/g, '<br>')
      : '<span class="muted">-</span>';
    const statusValue = normalizeStatusValue(item?.status);
    const statusRaw = statusValue || item?.status || '';
    const statusCell = `<td data-raw-status="${escapeHtml(statusRaw)}">${i18nStatusDisplay(
      statusRaw
    )}</td>`;
    const photoCell = buildPhotoCell(item);
    const locationCell = buildLocationCell(item);
    const lspCell = lsp ? escapeHtml(lsp) : '<span class="muted">-</span>';
    const regionCell = region ? escapeHtml(region) : '<span class="muted">-</span>';
    const planCell = planMos ? escapeHtml(planMos) : '<span class="muted">-</span>';
    const updatedCell = updatedAt ? escapeHtml(updatedAt) : '<span class="muted">-</span>';
    const hint = detailAvailable
      ? '<div class="summary-hint" data-i18n="table.expandHint">点击查看全部字段</div>'
      : '';
    const actionsContent = showActions ? buildActionCell(item, remarkText || '') : '';

    const firstCell = `      <td>
        <div class="summary-cell">
          <span class="row-toggle" aria-hidden="true"></span>
          <div class="summary-primary">${dnNumber}</div>
        </div>
        ${hint}
      </td>`;

    const cells = [
      firstCell,
      `      <td>${regionCell}</td>`,
      `      <td>${planCell}</td>`,
      `      <td>${lspCell}</td>`,
      `      ${statusCell}`,
      `      <td>${remarkDisplay}</td>`,
      `      <td>${photoCell}</td>`,
      `      <td>${locationCell}</td>`,
      `      <td>${updatedCell}</td>`,
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
    updateStatusCardLabels();
    updateStatusCardActiveState();
    refreshDnEntryVisibility();
    populateModalStatusOptions(mStatus?.value || '');
    renderDnPreview();
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
    updateModalFieldVisibility();
    updateActionColumnVisibility();
    rerenderTableActions();
    renderStatusHighlightCards();
    refreshStatusHighlightCards();
    persistAuthState(currentRoleKey, currentUserInfo);
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
    const label = role ? getRoleLabel(role) : i18n?.t('auth.trigger') || '授权';
    authBtn.textContent = label;
    authBtn.setAttribute(
      'data-i18n',
      role ? 'auth.switch' : 'auth.trigger'
    );
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
    if (mDuField) {
      mDuField.style.display = perms?.canEdit ? '' : 'none';
    }
    if (mDuInput) {
      mDuInput.disabled = !perms?.canEdit;
    }
  }

  function populateModalStatusOptions(selected) {
    if (!mStatus) return;
    const perms = getCurrentPermissions();
    const allowedOptions = Array.isArray(perms?.statusOptions)
      ? perms.statusOptions.map((status) => normalizeStatusValue(status) || status)
      : [];

    const existing = new Set();
    const keepOption = mStatus.querySelector('option[value=""]');
    const selectedValue = selected || '';

    mStatus.innerHTML = '';
    if (keepOption) {
      mStatus.appendChild(keepOption);
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.setAttribute('data-i18n', 'modal.status.keep');
      opt.textContent = i18n?.t('modal.status.keep') || '（不修改）';
      mStatus.appendChild(opt);
    }

    const values = allowedOptions.length
      ? allowedOptions
      : Array.from(STATUS_KNOWN_VALUES);

    values.forEach((value) => {
      const canonical = normalizeStatusValue(value);
      if (!canonical || existing.has(canonical)) return;
      existing.add(canonical);
      const opt = document.createElement('option');
      opt.value = canonical;
      opt.textContent = i18nStatusDisplay(canonical);
      if (canonical === selectedValue) {
        opt.selected = true;
      }
      mStatus.appendChild(opt);
    });
  }

  function refreshDnEntryVisibility() {
    const perms = getCurrentPermissions();
    const allowed = Boolean(perms?.canEdit);
    if (dnBtn) {
      dnBtn.style.display = allowed ? '' : 'none';
    }
  }

  function normalizeDnRawSoft(raw) {
    return (raw || '').replace(ZERO_WIDTH_RE, '').toUpperCase();
  }

  function splitDnTokens(raw) {
    const normalized = normalizeDnRawSoft(raw);
    return normalized
      .split(DN_SEP_RE)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  function buildDnHighlightHTML(raw) {
    const normalized = normalizeDnRawSoft(raw);
    if (!normalized) return '';
    const parts = normalized.split(DN_SEP_CAPTURE_RE);
    const out = [];
    for (const chunk of parts) {
      if (!chunk) continue;
      if (DN_SEP_TEST_RE.test(chunk)) {
        out.push(`<span class="hl-sep">${escapeHtml(chunk)}</span>`);
        continue;
      }
      const token = chunk.trim();
      if (!token) continue;
      const valid = DN_VALID_RE.test(token);
      out.push(`<span class="${valid ? 'hl-ok' : 'hl-bad'}">${escapeHtml(chunk)}</span>`);
    }
    out.push('<span class="hl-sep">\n</span>');
    return out.join('');
  }

  function isValidDn(token) {
    return DN_VALID_RE.test(token || '');
  }

  function renderDnPreview() {
    if (!dnPreview || !dnInput) return;
    const html = buildDnHighlightHTML(dnInput.value);
    dnPreview.innerHTML = html;
    dnPreview.scrollTop = dnInput.scrollTop;
    dnPreview.scrollLeft = dnInput.scrollLeft;
  }

  function renderDnTokens(tokens) {
    if (!dnInput) return [];
    const list = Array.isArray(tokens) ? tokens : [];
    dnInput.value = list.join('\n');
    renderDnPreview();
    return list;
  }

  function normalizeDnInput({ enforceFormat = false } = {}) {
    if (!dnInput) return [];
    const before = dnInput.value;
    const after = normalizeDnRawSoft(before);
    if (after !== before) {
      const atEnd =
        dnInput.selectionStart === before.length &&
        dnInput.selectionEnd === before.length;
      dnInput.value = after;
      if (atEnd) {
        try {
          dnInput.selectionStart = dnInput.selectionEnd = dnInput.value.length;
        } catch (err) {
          console.error(err);
        }
      }
    }
    const tokens = splitDnTokens(dnInput.value);
    if (enforceFormat) {
      renderDnTokens(tokens);
    } else {
      renderDnPreview();
    }
    return tokens;
  }

  function translateStatusCells() {
    if (!tbody) return;
    tbody.querySelectorAll('td[data-raw-status]').forEach((td) => {
      const raw = td.getAttribute('data-raw-status') || '';
      const canonical = normalizeStatusValue(raw);
      const value = canonical || raw;
      td.textContent = i18nStatusDisplay(value);
    });
  }

  function getStatusCardLabel(def) {
    if (!def) return '';
    if (def.labelKey && i18n) {
      try {
        const translated = i18n.t(def.labelKey);
        if (translated && translated !== def.labelKey) return translated;
      } catch (err) {
        console.error(err);
      }
    }
    if (def.label) return def.label;
    return i18nStatusDisplay(def.status);
  }

  function getRoleStatusHighlights(role) {
    if (!role) return [];
    const highlights = Array.isArray(role.statusHighlights)
      ? role.statusHighlights
      : [];
    const seen = new Set();
    const list = [];
    highlights.forEach((item) => {
      if (!item) return;
      let status = '';
      let label = '';
      let labelKey = '';
      if (typeof item === 'string') {
        status = normalizeStatusValue(item) || item;
      } else if (typeof item === 'object') {
        const target = item.status ?? item.value ?? item.key;
        status = normalizeStatusValue(target) || target || '';
        if (typeof item.label === 'string') label = item.label;
        if (typeof item.labelKey === 'string') labelKey = item.labelKey;
      }
      if (!status || seen.has(status)) return;
      seen.add(status);
      list.push({ status, label, labelKey });
    });
    return list;
  }

  function renderStatusHighlightCards() {
    if (!statusCardContainer || !statusCardWrapper) return;
    const role = getCurrentRole();
    const defs = getRoleStatusHighlights(role);
    statusCardDefs = defs;
    statusCardRefs.clear();

    if (!defs.length) {
      statusCardContainer.innerHTML = '';
      statusCardWrapper.style.display = 'none';
      statusCardWrapper.setAttribute('aria-hidden', 'true');
      statusCardContainer.style.removeProperty('--status-card-columns');
      if (statusCardAbortController) {
        try {
          statusCardAbortController.abort();
        } catch (err) {
          console.error(err);
        }
        statusCardAbortController = null;
      }
      return;
    }

    statusCardWrapper.style.display = '';
    statusCardWrapper.setAttribute('aria-hidden', 'false');
    statusCardContainer.innerHTML = '';
    const columns = Math.max(1, Math.min(defs.length, 4));
    statusCardContainer.style.setProperty('--status-card-columns', String(columns));

    defs.forEach((def) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'status-card';
      btn.setAttribute('data-status', def.status);
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-busy', 'false');

      const countEl = document.createElement('div');
      countEl.className = 'status-card__count';
      countEl.textContent = '…';

      const labelEl = document.createElement('div');
      labelEl.className = 'status-card__label';
      labelEl.textContent = getStatusCardLabel(def);

      btn.appendChild(countEl);
      btn.appendChild(labelEl);

      btn.addEventListener(
        'click',
        () => handleStatusCardClick(def.status),
        { signal }
      );

      statusCardContainer.appendChild(btn);
      statusCardRefs.set(def.status, { button: btn, countEl, labelEl });
    });

    updateStatusCardLabels();
    updateStatusCardActiveState();
  }

  function updateStatusCardLabels() {
    if (!statusCardDefs.length) return;
    statusCardDefs.forEach((def) => {
      const ref = statusCardRefs.get(def.status);
      if (!ref) return;
      const label = getStatusCardLabel(def);
      ref.labelEl.textContent = label;
      const currentCount = ref.countEl.textContent || '';
      ref.button.setAttribute('aria-label', `${label} ${currentCount}`.trim());
    });
  }

  function updateStatusCardActiveState() {
    if (!statusCardRefs.size) return;
    const value = statusSelect ? statusSelect.value : '';
    const canonical = normalizeStatusValue(value);
    statusCardRefs.forEach((ref, status) => {
      const isActive = Boolean(canonical) && status === canonical;
      ref.button.classList.toggle('active', isActive);
      ref.button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  async function fetchStatusCount(status, signal) {
    const params = new URLSearchParams();
    params.set('status', status);
    params.set('page', '1');
    params.set('page_size', '1');
    const url = `${API_BASE}/api/dn/list/search?${params.toString()}`;
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
    const totalRaw = data?.total ?? data?.count ?? 0;
    const total = Number(totalRaw);
    return Number.isFinite(total) ? total : 0;
  }

  async function refreshStatusHighlightCards() {
    if (!statusCardDefs.length || !statusCardRefs.size) return;
    statusCardRequestId += 1;
    const requestId = statusCardRequestId;

    if (statusCardAbortController) {
      try {
        statusCardAbortController.abort();
      } catch (err) {
        console.error(err);
      }
    }
    const controller = new AbortController();
    statusCardAbortController = controller;
    const { signal: cardSignal } = controller;

    statusCardRefs.forEach((ref) => {
      ref.button.classList.add('loading');
      ref.button.setAttribute('aria-busy', 'true');
      ref.countEl.textContent = '…';
    });

    const tasks = statusCardDefs.map(async (def) => {
      try {
        const count = await fetchStatusCount(def.status, cardSignal);
        if (cardSignal.aborted || requestId !== statusCardRequestId) return;
        const ref = statusCardRefs.get(def.status);
        if (!ref) return;
        const displayCount = Number.isFinite(count) ? count : 0;
        ref.countEl.textContent = String(displayCount);
        ref.button.classList.remove('loading');
        ref.button.setAttribute('aria-busy', 'false');
        const label = getStatusCardLabel(def);
        ref.button.setAttribute('aria-label', `${label} ${displayCount}`.trim());
      } catch (err) {
        if (cardSignal.aborted || requestId !== statusCardRequestId) return;
        if (err?.name !== 'AbortError') {
          console.error(err);
        }
      }
    });

    try {
      await Promise.all(tasks);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error(err);
      }
    }
  }

  function handleStatusCardClick(status) {
    if (!statusSelect) return;
    const canonical = normalizeStatusValue(status);
    const option = Array.from(statusSelect.options).find(
      (opt) => normalizeStatusValue(opt.value) === canonical
    );
    statusSelect.value = option ? option.value : canonical;
    updateStatusCardActiveState();
    q.page = 1;
    fetchList();
  }

  function openViewerWithUrl(url) {
    if (!url) return;
    viewerHost.innerHTML = `<img id="__dn_view" alt="photo" data-src="${url}">`;
    const img = viewerHost.querySelector('#__dn_view');
    cleanupViewer();
    viewer = new Viewer(img, {
      navbar: false,
      title: false,
      toolbar: false,
      fullscreen: false,
      movable: true,
      zoomRatio: 0.4,
      loading: true,
      backdrop: true,
      url(image) {
        return image.getAttribute('data-src');
      },
      hidden() {
        cleanupViewer();
      },
    });
    try {
      viewer.show();
    } catch (err) {
      console.error(err);
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
        `<button type="button" class="icon-btn danger" data-act="del" data-id="${it.id}" aria-label="${safeDeleteLabel}" data-i18n-aria-label="actions.delete" title="${safeDeleteLabel}" data-i18n-title="actions.delete">${getIconMarkup('delete')}</button>`
      );
    }
    if (!buttons.length) return '';
    return `<div class="actions">${buttons.join('')}</div>`;
  }

  function renderRows(items) {
    if (!tbody) return;
    updateActionColumnVisibility();
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
          () => onDelete(id),
          { signal }
        );
      }
    });

    tbody.querySelectorAll('.view-link').forEach((a) => {
      a.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          const url = a.getAttribute('data-url');
          openViewerWithUrl(url);
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

  function buildParamsAuto() {
    const params = new URLSearchParams();
    const tokens = normalizeDnInput({ enforceFormat: false });
    const ps = Number(pageSizeInput?.value) || 20;
    q.page_size = ps;

    if (tokens.length > 1) {
      tokens.forEach((token) => params.append('dn_number', token));
      q.mode = 'batch';
    } else {
      q.mode = 'single';
      const st = statusSelect?.value;
      const rk = (remarkInput?.value || '').trim();
      const hp = hasSelect?.value;
      const df = fromInput?.value;
      const dt = toInput?.value;
      const du = (duFilterInput?.value || '').trim();

      if (tokens.length === 1) params.set('dn_number', tokens[0]);
      if (du) params.set('du_id', du.toUpperCase());
      if (st) params.set('status', st);
      if (rk) params.set('remark', rk);
      if (hp) params.set('has_photo', hp);
      if (df) params.set('date_from', new Date(`${df}T00:00:00`).toISOString());
      if (dt) params.set('date_to', new Date(`${dt}T23:59:59`).toISOString());
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
      refreshStatusHighlightCards();
    }
  }

  function openModalEdit(item) {
    const perms = getCurrentPermissions();
    if (!perms?.canEdit) {
      showToast(i18n ? i18n.t('auth.toast.denied') : '当前角色无权编辑该记录', 'error');
      return;
    }
    editingId = Number(item.id);
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
    if (mDuInput) {
      const currentDu = item.du_id || '';
      mDuInput.value = currentDu;
      mDuInput.dataset.originalValue = currentDu.trim().toUpperCase();
    }
    const canonicalStatus = normalizeStatusValue(item.status);
    populateModalStatusOptions(canonicalStatus);
    updateModalFieldVisibility();
    if (mMsg) mMsg.textContent = '';
    if (mask) mask.style.display = 'flex';
  }

  function closeModal() {
    if (mask) mask.style.display = 'none';
    editingId = 0;
    if (mDuInput) {
      delete mDuInput.dataset.originalValue;
    }
  }

  function buildFormDataForSave() {
    const perms = getCurrentPermissions();
    const form = new FormData();
    const statusVal = mStatus?.value || '';
    const remarkVal = perms?.allowRemark ? (mRemark?.value || '').trim() : '';
    const allowPhoto = perms?.allowPhoto && mPhoto?.files && mPhoto.files[0];
    const rawDu = mDuInput ? (mDuInput.value || '') : '';
    const duVal = rawDu.trim().toUpperCase();
    const originalDu = (mDuInput?.dataset?.originalValue ?? '').trim().toUpperCase();
    const duChanged = mDuInput ? duVal !== originalDu : false;

    if (statusVal) form.set('status', statusVal);
    if (remarkVal) form.set('remark', remarkVal);
    if (allowPhoto) {
      form.set('photo', mPhoto.files[0]);
    }
    if (duChanged) {
      form.set('duId', duVal || '');
    }
    return { form, statusVal, remarkVal, allowPhoto, duChanged, duVal };
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

    if (payload.duChanged && payload.duVal && !DU_RE_FULL.test(payload.duVal)) {
      if (mMsg)
        mMsg.textContent =
          i18n?.t('modal.du.invalid') || '关联 DU ID 需为 DID 开头加 13 位数字。';
      return false;
    }

    if (!payload.statusVal && !payload.remarkVal && !payload.allowPhoto && !payload.duChanged) {
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
      if (!editingId) return;
      const payload = buildFormDataForSave();
      if (!validateBeforeSave(payload)) return;

      if (mMsg) mMsg.textContent = i18n?.t('modal.saving') || '保存中…';
      try {
        const resp = await fetch(`${API_BASE}/api/dn/update/${editingId}`, {
          method: 'PUT',
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

  async function onDelete(id) {
    if (!id) return;
    const perms = getCurrentPermissions();
    if (!perms?.canDelete) {
      showToast(i18n ? i18n.t('auth.toast.denied') : '当前角色无权删除该记录', 'error');
      return;
    }
    if (!window.confirm(`确认要删除记录 #${id} 吗？`)) return;
    if (hint) hint.textContent = `正在删除 #${id} …`;
    try {
      const resp = await fetch(`${API_BASE}/api/dn/update/${id}`, { method: 'DELETE' });
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
      if (hint) hint.textContent = `${i18n?.t('modal.deleteError') || '删除失败'}：${err?.message || err}`;
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

  async function exportAll() {
    if (!hint) return;
    try {
      hint.textContent = i18n?.t('actions.exporting') || '正在导出全部数据，请稍候…';
      const per = q.page_size || 20;

      const p1 = new URLSearchParams(q.lastParams);
      p1.set('page', '1');
      p1.set('page_size', String(per));
      const firstUrl = buildSearchUrl(p1);

      const fResp = await fetch(firstUrl);
      const fRaw = await fResp.text();
      let fData = null;
      try {
        fData = fRaw ? JSON.parse(fRaw) : null;
      } catch (err) {
        console.error(err);
      }
      if (!fResp.ok)
        throw new Error((fData && (fData.detail || fData.message)) || `HTTP ${fResp.status}`);

      const total = fData?.total || 0;
      let items = Array.isArray(fData?.items) ? fData.items.slice() : [];
      const pages = Math.max(1, Math.ceil(total / per));

      for (let p = 2; p <= pages; p++) {
        const params = new URLSearchParams(q.lastParams);
        params.set('page', String(p));
        params.set('page_size', String(per));
        const url = buildSearchUrl(params);
        const r = await fetch(url);
        const raw = await r.text();
        let d = null;
        try {
          d = raw ? JSON.parse(raw) : null;
        } catch (err) {
          console.error(err);
        }
        if (!r.ok)
          throw new Error((d && (d.detail || d.message)) || `HTTP ${r.status}`);
        if (Array.isArray(d?.items)) items = items.concat(d.items);
      }

      if (!items.length) {
        window.alert(i18n?.t('actions.exportNone') || '没有匹配的数据可导出。');
        hint.textContent = total ? '' : i18n?.t('hint.empty') || '没有数据';
        return;
      }
      downloadCSV(toCsvRows(items));
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
    setRole(matched.role.key, matched.user);
    closeAuthModal();
    const roleLabel = getRoleLabel(matched.role);
    showToast(i18n ? i18n.t('auth.toast.success', { role: roleLabel }) : `已切换至 ${roleLabel}`, 'success');
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

  function openDnModal() {
    if (!dnModal) return;
    const perms = getCurrentPermissions();
    if (!perms?.canEdit) {
      showToast(i18n ? i18n.t('dn.toast.denied') : '当前角色无权录入 DN', 'error');
      return;
    }
    dnModal.style.display = 'flex';
    if (dnEntryPreview) {
      dnEntryPreview.innerHTML = '';
    }
    if (dnEntryInput) {
      dnEntryInput.value = '';
      setTimeout(() => {
        try {
          dnEntryInput.focus();
        } catch (err) {
          console.error(err);
        }
      }, 30);
    }
    renderDnEntryPreview();
  }

  function closeDnModal() {
    if (dnModal) dnModal.style.display = 'none';
  }

  function renderDnEntryPreview(tokensOverride) {
    if (!dnEntryPreview || !dnEntryInput) return;
    const tokens = Array.isArray(tokensOverride)
      ? tokensOverride
      : splitDnTokens(dnEntryInput.value);
    if (!tokens.length) {
      const placeholder = i18n ? i18n.t('dn.preview.empty') : '在此查看格式化结果';
      dnEntryPreview.innerHTML = `<div class="placeholder">${escapeHtml(placeholder)}</div>`;
      return;
    }
    dnEntryPreview.innerHTML = tokens
      .map((token) => {
        const valid = isValidDn(token);
        return `<span class="dn-token ${valid ? 'ok' : 'bad'}">${escapeHtml(token)}</span>`;
      })
      .join('');
  }

  function renderDnEntryTokens(tokens) {
    if (!dnEntryInput) return [];
    const list = Array.isArray(tokens) ? tokens : [];
    dnEntryInput.value = list.join('\n');
    renderDnEntryPreview(list);
    return list;
  }

  async function handleDnConfirm() {
    if (!dnEntryInput) return;
    const tokens = splitDnTokens(dnEntryInput.value);
    if (!tokens.length) {
      showToast(i18n ? i18n.t('dn.toast.empty') : '请输入 DN 号', 'error');
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/api/dn/batch_update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dn_numbers: tokens }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error((data && (data.detail || data.message)) || `HTTP ${resp.status}`);
      }
      const success = data?.success_count || 0;
      const failure = data?.failure_count || 0;
      const msg = i18n
        ? i18n.t('dn.toast.successBase', { valid: success }) +
          (failure ? i18n.t('dn.toast.invalidNote', { invalid: failure }) : '')
        : `成功创建 ${success} 条 DN${failure ? `，${failure} 条失败` : ''}`;
      showToast(msg, failure ? 'info' : 'success');
      closeDnModal();
      fetchList();
    } catch (err) {
      showToast(`${i18n?.t('dn.toast.error') || '录入失败'}：${err?.message || err}`, 'error');
    }
  }

  dnBtn?.addEventListener('click', openDnModal, { signal });
  dnClose?.addEventListener('click', () => closeDnModal(), { signal });
  dnCancel?.addEventListener('click', () => closeDnModal(), { signal });
  dnConfirm?.addEventListener('click', () => handleDnConfirm(), { signal });
  dnModal?.addEventListener(
    'click',
    (e) => {
      if (e.target === dnModal) closeDnModal();
    },
    { signal }
  );
  dnEntryInput?.addEventListener('input', () => renderDnEntryPreview(), { signal });
  dnEntryInput?.addEventListener(
    'paste',
    (e) => {
      try {
        const text = (e.clipboardData || window.clipboardData)?.getData('text');
        if (typeof text === 'string') {
          e.preventDefault();
          const current = splitDnTokens(dnEntryInput.value);
          const pasted = splitDnTokens(text);
          const merged = Array.from(new Set(current.concat(pasted)));
          renderDnEntryTokens(merged);
          try {
            dnEntryInput.selectionStart = dnEntryInput.selectionEnd =
              dnEntryInput.value.length;
          } catch (err) {
            console.error(err);
          }
        }
      } catch (err) {
        console.error(err);
      }
    },
    { signal }
  );

  statusSelect?.addEventListener(
    'change',
    () => {
      updateStatusCardActiveState();
    },
    { signal }
  );

  dnInput?.addEventListener(
    'input',
    () => {
      normalizeDnInput({ enforceFormat: false });
    },
    { signal }
  );
  dnInput?.addEventListener(
    'paste',
    (e) => {
      try {
        const text = (e.clipboardData || window.clipboardData)?.getData('text');
        if (typeof text === 'string') {
          e.preventDefault();
          const current = splitDnTokens(dnInput.value);
          const pasted = splitDnTokens(text);
          const merged = Array.from(new Set(current.concat(pasted)));
          renderDnTokens(merged);
          try {
            dnInput.selectionStart = dnInput.selectionEnd = dnInput.value.length;
          } catch (err) {
            console.error(err);
          }
        }
      } catch (err) {
        console.error(err);
      }
    },
    { signal }
  );

  dnInput?.addEventListener(
    'scroll',
    () => {
      if (!dnPreview) return;
      dnPreview.scrollTop = dnInput.scrollTop;
      dnPreview.scrollLeft = dnInput.scrollLeft;
    },
    { signal }
  );

  mDuInput?.addEventListener(
    'input',
    () => {
      const before = mDuInput.value || '';
      const after = before.replace(ZERO_WIDTH_RE, '').toUpperCase();
      if (after === before) return;
      const start = mDuInput.selectionStart;
      const end = mDuInput.selectionEnd;
      mDuInput.value = after;
      if (typeof start === 'number' && typeof end === 'number') {
        const offset = after.length - before.length;
        try {
          const nextStart = Math.max(0, start + offset);
          const nextEnd = Math.max(0, end + offset);
          mDuInput.selectionStart = nextStart;
          mDuInput.selectionEnd = nextEnd;
        } catch (err) {
          console.error(err);
        }
      }
    },
    { signal }
  );

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
      ['f-status', 'f-remark', 'f-has', 'f-from', 'f-to', 'f-ps2', 'f-du'].forEach((id) => {
        const node = el(id);
        if (node) node.value = id === 'f-ps2' ? '20' : '';
      });
      if (dnInput) dnInput.value = '';
      normalizeDnInput({ enforceFormat: false });
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
      updateModalFieldVisibility();
      rerenderTableActions();
      renderStatusHighlightCards();
    }
  }

  function init() {
    normalizeDnInput({ enforceFormat: false });
    if (hint) hint.textContent = i18n?.t('hint.ready') || '输入条件后点击查询。';
    fetchList();
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
    cleanupViewer();
    viewerHost.remove();
  };
}
