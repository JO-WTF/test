import { createApp, h } from 'vue';
import { Tooltip, Input } from 'ant-design-vue';
import {
  STATUS_VALUES,
  DN_SCAN_STATUS_VALUES,
  STATUS_MISMATCH_TOOLTIP_FALLBACK,
  DN_DETAIL_KEYS,
  DETAIL_INPUT_FIELD_SET,
  REGION_FIELD,
  PLAN_MOS_DATE_FIELD,
  ISSUE_REMARK_FIELD,
  STATUS_DELIVERY_FIELD,
  UPDATED_AT_FIELD,
  LSP_FIELD,
  LAT_FIELD,
  LNG_FIELD,
  PHOTO_FIELD,
  SUMMARY_FIELD_KEYS,
  ICON_MARKUP,
  HIDDEN_DETAIL_FIELDS,
  SUMMARY_BASE_COLUMN_COUNT,
  SUMMARY_COLUMN_WITH_ACTIONS_COUNT,
} from './constants.js';
import { escapeHtml } from './utils.js';

function defaultGetIconMarkup(name) {
  return ICON_MARKUP[name] || '';
}

function noop() {}

function defaultNormalizeStatus(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toUpperCase();
}

function defaultNormalizeText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  try {
    return String(value).trim();
  } catch (err) {
    console.error(err);
    return '';
  }
}

export function createTableRenderer(options = {}) {
  const {
    tbody,
    tableEl,
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
    normalizeStatusValue,
    normalizeTextValue,
    i18nStatusDisplay,
    toAbsUrl,
    formatTimestampToJakarta,
    getCurrentRoleKey,
    viewerApi,
    getIconMarkup = defaultGetIconMarkup,
  } = options;

  if (!tbody) {
    return {
      renderRows: noop,
      bindRowActions: noop,
      rerenderTableActions: noop,
      translateStatusCells: noop,
      updateDetailSaveButtonLabels: noop,
      updateActionColumnVisibility: noop,
      hideUpdatedAtColumn: noop,
      cleanup: noop,
    };
  }

  const translate = typeof translateInstant === 'function' ? translateInstant : (_key, fallback = '') => fallback;
  const normalizeStatus = typeof normalizeStatusValue === 'function' ? normalizeStatusValue : defaultNormalizeStatus;
  const normalizeText = typeof normalizeTextValue === 'function' ? normalizeTextValue : defaultNormalizeText;
  const statusDisplay = typeof i18nStatusDisplay === 'function' ? i18nStatusDisplay : (value) => value || '';
  const absoluteUrl = typeof toAbsUrl === 'function' ? toAbsUrl : (value) => (value ? String(value) : '');
  const formatTimestamp = typeof formatTimestampToJakarta === 'function' ? formatTimestampToJakarta : (value) => (value ? String(value) : '');
  const viewerFactory = typeof viewerApi === 'function' ? viewerApi : null;
  const toast = typeof showToast === 'function' ? showToast : noop;
  const getPerms = typeof getCurrentPermissions === 'function' ? getCurrentPermissions : () => ({});
  const isTransportManager = typeof isTransportManagerRole === 'function' ? isTransportManagerRole : () => false;
  const getRoleKey = typeof getCurrentRoleKey === 'function' ? getCurrentRoleKey : () => null;
  const handleOpenUpdateHistory = typeof openUpdateHistoryModal === 'function' ? openUpdateHistoryModal : null;
  const handleOpenEdit = typeof openModalEdit === 'function' ? openModalEdit : null;
  const handleDelete = typeof onDelete === 'function' ? onDelete : null;

  const addListener = (target, type, handler) => {
    if (!target) return;
    if (signal) {
      target.addEventListener(type, handler, { signal });
    } else {
      target.addEventListener(type, handler);
    }
  };

  const state = {
    cachedItems: [],
    detailInputMounts: [],
    statusMismatchTooltips: [],
    expandedRowKeys: new Set(),
    viewerInstance: null,
  };

  function shouldShowActionsColumn() {
    return Boolean(getRoleKey());
  }

  function getSummaryColumnCount(showActions = shouldShowActionsColumn()) {
    return showActions ? SUMMARY_COLUMN_WITH_ACTIONS_COUNT : SUMMARY_BASE_COLUMN_COUNT;
  }

  function updateActionColumnVisibility() {
    const show = shouldShowActionsColumn();
    if (actionsHeader) {
      actionsHeader.style.display = show ? '' : 'none';
      actionsHeader.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
    if (tableEl) {
      tableEl.classList.toggle('has-actions', show);
    }
  }

  function hideUpdatedAtColumn() {
    if (updatedAtHeader) {
      updatedAtHeader.style.display = 'none';
      updatedAtHeader.setAttribute('aria-hidden', 'true');
    }
    tbody.querySelectorAll('td[data-column="updatedAt"]').forEach((cell) => {
      cell.style.display = 'none';
      cell.setAttribute('aria-hidden', 'true');
    });
  }

  function cleanupViewer() {
    if (!state.viewerInstance) return;
    const instance = state.viewerInstance;
    state.viewerInstance = null;
    try {
      instance.destroy();
    } catch (err) {
      console.error(err);
    }
  }

  async function copyTextToClipboard(text) {
    const value = typeof text === 'string' ? text : String(text || '');
    if (!value) return false;

    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
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
      const originalRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

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

  function shouldShowStatusMismatch(statusDeliveryRaw, statusRaw) {
    const delivery = normalizeStatus(statusDeliveryRaw);
    const status = normalizeStatus(statusRaw);
    if (!delivery) return false;

    const arrivedStatus = DN_SCAN_STATUS_VALUES.ARRIVED_AT_SITE;
    const podStatus = DN_SCAN_STATUS_VALUES.POD || 'POD';

    if (delivery === STATUS_VALUES.ON_THE_WAY) {
      const allowedTransportStatuses = [
        DN_SCAN_STATUS_VALUES.TRANSPORTING_FROM_WH,
        DN_SCAN_STATUS_VALUES.TRANSPORTING_FROM_XD_PM,
      ]
        .map((value) => normalizeStatus(value))
        .filter(Boolean);
      const isAllowedTransportStatus = allowedTransportStatuses.includes(status);
      return !isAllowedTransportStatus;
    }
    if (delivery === STATUS_VALUES.ON_SITE) {
      return status !== arrivedStatus && status !== podStatus;
    }
    if (delivery === STATUS_VALUES.POD) {
      return status !== podStatus && status !== arrivedStatus;
    }
    return false;
  }

  function getStatusMismatchTooltipMessage() {
    return translate('table.statusMismatchTooltip', STATUS_MISMATCH_TOOLTIP_FALLBACK);
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

  function getRowKey(item, index) {
    if (item && typeof item === 'object') {
      if (item.id !== undefined && item.id !== null) return `id:${item.id}`;
      if (item.dn_id !== undefined && item.dn_id !== null) return `dnid:${item.dn_id}`;
      if (item.uuid) return `uuid:${item.uuid}`;
      if (item.dn_number) return `dn:${item.dn_number}`;
    }
    return `idx:${index}`;
  }

  function getNormalizedField(item, field) {
    if (!item || typeof item !== 'object' || !field) return '';
    if (!Object.prototype.hasOwnProperty.call(item, field)) return '';
    return normalizeText(item[field]);
  }

  function getLspDisplay(item) {
    const raw = getNormalizedField(item, LSP_FIELD);
    if (!raw) return '';
    // 提取 HTM. 和 -IDN 之间的内容
    const match = raw.match(/HTM\.\s*(.*?)\s*-IDN/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return raw;
  }

  function getRegionDisplay(item) {
    return getNormalizedField(item, REGION_FIELD);
  }

  function getPlanMosDateDisplay(item) {
    return getNormalizedField(item, PLAN_MOS_DATE_FIELD);
  }

  function getIssueRemarkDisplay(item) {
    return getNormalizedField(item, ISSUE_REMARK_FIELD);
  }

  function getStatusDeliveryCanonicalValue(item) {
    const raw = getNormalizedField(item, STATUS_DELIVERY_FIELD);
    return normalizeStatus(raw);
  }

  function getStatusDeliveryDisplay(item) {
    return getNormalizedField(item, STATUS_DELIVERY_FIELD);
  }

  function getUpdatedAtDisplay(item) {
    return getNormalizedField(item, UPDATED_AT_FIELD);
  }

  function getCoordinateParts(item) {
    const lat = getNormalizedField(item, LAT_FIELD);
    const lng = getNormalizedField(item, LNG_FIELD);
    return [lat, lng];
  }

  function getPhotoUrl(item) {
    return getNormalizedField(item, PHOTO_FIELD);
  }

  function buildLocationCell(item) {
    const [lat, lng] = getCoordinateParts(item);
    if (lat && lng) {
      const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;
      const safeUrl = escapeHtml(mapUrl);
      const label = translate('table.mapIconLabel', 'Open in Google Maps') || 'Open in Google Maps';
      const safeLabel = escapeHtml(label);
      const icon = getIconMarkup('map');
      return `<div class="coord-cell"><a href="${safeUrl}" target="_blank" rel="noopener" class="icon-link map-link" aria-label="${safeLabel}" data-i18n-aria-label="table.mapIconLabel" title="${safeLabel}" data-i18n-title="table.mapIconLabel">${icon}</a></div>`;
    }
    return '<span class="muted">-</span>';
  }

  function buildPhotoCell(item) {
    const photo = getPhotoUrl(item);
    if (!photo) {
      return '<span class="muted">-</span>';
    }
    const safeUrl = escapeHtml(absoluteUrl(photo));
    const label = translate('table.photoIconLabel', 'View photo') || 'View photo';
    const safeLabel = escapeHtml(label);
    return `<button type="button" class="icon-link view-link" data-url="${safeUrl}" aria-label="${safeLabel}" data-i18n-aria-label="table.photoIconLabel" title="${safeLabel}" data-i18n-title="table.photoIconLabel">${getIconMarkup('photo')}</button>`;
  }

  function collectDetailEntries(item) {
    if (!item || typeof item !== 'object') return [];

    const latValue = item?.lat ?? item?.latitude;
    const lngValue = item?.lng ?? item?.longitude;
    const hasCoordinates =
      latValue !== undefined &&
      latValue !== null &&
      lngValue !== undefined &&
      lngValue !== null;

    const itemWithLonlat = { ...item };
    if (hasCoordinates && !itemWithLonlat.lonlat) {
      itemWithLonlat.lonlat = `${lngValue},${latValue}`;
    }

    const entries = [];
    DN_DETAIL_KEYS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(itemWithLonlat, key)) return;
      const value = itemWithLonlat[key];
      if (value === undefined || value === null || value === '') return;
      entries.push([key, value]);
    });

    return entries;
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
    const text = normalizeText(value);
    if (!text) return '<span class="muted">-</span>';
    const lowerKey = key.toLowerCase();

    if (/timestamp|_at$|date|time/.test(lowerKey) && !/photo|image|picture|attachment|url/.test(lowerKey)) {
      const formattedTime = formatTimestamp(value);
      if (formattedTime) {
        return escapeHtml(formattedTime);
      }
    }

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
      const safeUrl = escapeHtml(absoluteUrl(text));
      const viewLabel = translate('table.view', '查看') || '查看';
      const safeLabel = escapeHtml(viewLabel);
      return `<div class="detail-links"><button type="button" class="view-link" data-url="${safeUrl}" data-i18n="table.view">${safeLabel}</button></div>`;
    }

    if (/url/.test(lowerKey)) {
      const safeUrl = escapeHtml(absoluteUrl(text));
      return `<a href="${safeUrl}" target="_blank" rel="noopener">${safeUrl}</a>`;
    }

    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function getLspAbbreviation(lspName) {
    if (!lspName) return '';
    const map = {
      'HTM.SCHENKER-IDN': 'SCK',
      'HTM.KAMADJAJA-IDN': 'KAMA',
      'HTM.XPRESINDO-IDN': 'XP',
      'HTM.SINOTRANS-IDN': 'SINO',
    };
    return map[lspName] || lspName;
  }

  function formatPlanMosDateForMobile(dateString) {
    if (!dateString) return '';
    try {
      const ddMmmYyMatch = dateString.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+\d{2}$/);
      if (ddMmmYyMatch) {
        return `${ddMmmYyMatch[2]} ${ddMmmYyMatch[1]}`;
      }

      const isoMatch = dateString.match(/^\d{4}-(\d{2})-(\d{2})$/);
      if (isoMatch) {
        const month = parseInt(isoMatch[1], 10);
        const day = parseInt(isoMatch[2], 10);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[month - 1]} ${day}`;
      }

      const usMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/\d{4}$/);
      if (usMatch) {
        const month = parseInt(usMatch[1], 10);
        const day = parseInt(usMatch[2], 10);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[month - 1]} ${day}`;
      }

      if (dateString.match(/^[A-Za-z]{3}\s+\d{1,2}$/)) {
        return dateString;
      }

      return dateString;
    } catch (err) {
      console.error('Error formatting date for mobile:', err);
      return dateString;
    }
  }

  function buildDetailContent(item, entries) {
    const title = '<div class="detail-title" data-i18n="details.title">全部字段</div>';
    if (!entries || !entries.length) {
      return `<div class="detail-content">${title}<div class="muted" data-i18n="details.empty">暂无更多字段。</div></div>`;
    }

    const rows = entries
      .filter(([key]) => !HIDDEN_DETAIL_FIELDS.has(String(key)))
      .map(([key, value]) => {
        const keyString = String(key);
        const safeKey = escapeHtml(keyString);
        if (shouldRenderDetailInput(keyString)) {
          const textValue = normalizeText(value);
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

      const saveLabel = translate('details.save', '保存') || '保存';
      const saveButtonHtml = `<div class="detail-actions"><button type="button" class="btn detail-save-btn" disabled aria-disabled="true" data-i18n="details.save">${escapeHtml(saveLabel)}</button></div>`;
      return `<div class="detail-content">${title}<div class="detail-grid">${rows}</div>${saveButtonHtml}</div>`;
    }

    function buildActionCell(item, remark) {
      const perms = getPerms() || {};
      if (!perms.canEdit && !perms.canDelete) return '';

      const buttons = [];
      const canonicalStatus = normalizeStatus(item.status);
      const statusAttr = escapeHtml(canonicalStatus || item.status || '');
      const dnAttr = escapeHtml(item.dn_number || '');
      const duAttr = escapeHtml(item.du_id || '');
      const remarkAttr = escapeHtml(remark || '');

      if (perms.canEdit && handleOpenEdit) {
        const editLabel = translate('actions.edit', 'Edit') || 'Edit';
        const safeEditLabel = escapeHtml(editLabel);
        buttons.push(
          `<button type="button" class="icon-btn" data-act="edit" data-id="${item.id}" data-dn="${dnAttr}" data-status="${statusAttr}" data-remark="${remarkAttr}" data-du="${duAttr}" aria-label="${safeEditLabel}" data-i18n-aria-label="actions.edit" title="${safeEditLabel}" data-i18n-title="actions.edit">${getIconMarkup('edit')}</button>`
        );
      }

      if (perms.canDelete && handleDelete) {
        const deleteLabel = translate('actions.delete', 'Delete') || 'Delete';
        const safeDeleteLabel = escapeHtml(deleteLabel);
        buttons.push(
          `<button type="button" class="icon-btn danger" data-act="del" data-id="${item.id}" data-dn="${dnAttr}" aria-label="${safeDeleteLabel}" data-i18n-aria-label="actions.delete" title="${safeDeleteLabel}" data-i18n-title="actions.delete">${getIconMarkup('delete')}</button>`
        );
      }

      if (!buttons.length) return '';
      return `<div class="actions">${buttons.join('')}</div>`;
    }

    function buildSummaryRow(item, detailEntries, { rowKey, expanded, hasDetails, showActions }) {
      const detailAvailable =
        typeof hasDetails === 'boolean'
          ? hasDetails && detailEntries.length > 0
          : detailEntries.length > 0 && detailEntries.some(([key]) => !SUMMARY_FIELD_KEYS.has(String(key)));

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
      const remarkText = normalizeText(item?.remark);
      const remarkDisplay = remarkText ? escapeHtml(remarkText).replace(/\n/g, '。') : '<span class="muted">-</span>';
      const statusValue = normalizeStatus(item?.status);
      const statusRaw = statusValue || item?.status || '';

      const transportManager = isTransportManager();
      const updateCount = item?.update_count || 0;
      const updateCountBadge = transportManager && updateCount > 0
        ? `<button type="button" class="update-count-badge" data-dn-number="${escapeHtml(rawDnNumber)}" title="点击查看更新记录 (${updateCount} 次)">${updateCount}</button>`
        : '';

      const statusCell = `<td data-raw-status="${escapeHtml(statusRaw)}" data-status-delivery="${escapeHtml(statusDeliveryCanonical || '')}"><div class="status-cell-wrapper">${statusDisplay(statusRaw)}${updateCountBadge}</div></td>`;
  // 合并照片和位置为打卡列
  const photoCell = buildPhotoCell(item);
  const locationCell = buildLocationCell(item);
  const checkinCell = `<div class="checkin-cell">${photoCell}${locationCell}</div>`;
      const lspCell = lsp ? escapeHtml(lsp) : '<span class="muted">-</span>';
      const regionLine = region
        ? `<span class="region-plan-cell__region">${escapeHtml(region)}</span>`
        : '<span class="region-plan-cell__region muted">-</span>';
      const planLine = planMos
        ? `<span class="region-plan-cell__plan">${escapeHtml(planMos)}</span>`
        : '<span class="region-plan-cell__plan muted">-</span>';
      const planMosMobile = planMos ? formatPlanMosDateForMobile(planMos) : '';
      const issueRemarkCell = issueRemark ? escapeHtml(issueRemark).replace(/\n/g, '<br>') : '<span class="muted">-</span>';
      const statusDeliveryCell = statusDelivery ? escapeHtml(statusDelivery).replace(/\n/g, '<br>') : '<span class="muted">-</span>';
      const updatedCell = updatedAt ? escapeHtml(updatedAt) : '<span class="muted">-</span>';
      const duIdRaw = normalizeText(item?.du_id);
      const duIdLabel = translate('table.duIdLabel', 'DU ID') || 'DU ID';
      const duIdMarkup = duIdRaw
        ? `<button type="button" class="summary-du-id-value" data-du-id="${escapeHtml(duIdRaw)}" title="${escapeHtml(duIdLabel)}" aria-label="${escapeHtml(duIdLabel)}">${escapeHtml(duIdRaw)}</button>`
        : '<span class="muted">-</span>';
      const hint = `<div class="summary-hint summary-du-id">${duIdMarkup}</div>`;
      const actionsContent = showActions ? buildActionCell(item, remarkText || '') : '';

      const lspAbbrev = lsp ? getLspAbbreviation(lsp) : '';
      const firstCell = `      <td>
          <div class="summary-cell">
            <span class="row-toggle" aria-hidden="true"></span>
            <div class="summary-primary" data-dn-number="${safeDnNumber}">${dnNumberDisplay}</div>
          </div>
          ${hint}
        </td>`;

      const cells = [
        firstCell,
        `      <td class="summary-region-plan-cell" data-mobile-value="${escapeHtml(planMosMobile)}">
          ${regionLine}
          ${planLine}
        </td>`,
        `      <td data-mobile-value="${escapeHtml(lspAbbrev)}">${lspCell}</td>`,
        `      <td>${statusDeliveryCell}</td>`,
        `      ${statusCell}`,
        `      <td>${issueRemarkCell}</td>`,
        `      <td>${remarkDisplay}</td>`,
  `      <td class="summary-checkin-cell">${checkinCell}</td>`,
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

    function buildDetailRow(item, detailEntries, { rowKey, expanded, hasDetails, summaryColumnCount }) {
      const detailAvailable =
        typeof hasDetails === 'boolean'
          ? hasDetails && detailEntries.length > 0
          : detailEntries.length > 0 && detailEntries.some(([key]) => !SUMMARY_FIELD_KEYS.has(String(key)));
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
      state.expandedRowKeys.add(rowKey);
    } else {
      detail.style.display = 'none';
      detail.classList.remove('expanded');
      state.expandedRowKeys.delete(rowKey);
    }
  }

  function cleanupStatusMismatchTooltips() {
    if (!state.statusMismatchTooltips.length) return;
    state.statusMismatchTooltips.forEach(({ app, mountEl }) => {
      try {
        app.unmount();
      } catch (err) {
        console.error(err);
      }
      if (mountEl && mountEl.parentNode) {
        mountEl.parentNode.removeChild(mountEl);
      }
    });
    state.statusMismatchTooltips = [];
  }

  function setupStatusMismatchTooltips() {
    const tooltipTargets = tbody.querySelectorAll('.status-mismatch[data-status-mismatch="true"]');
    if (!tooltipTargets.length) return;
    tooltipTargets.forEach((target) => {
      const message = target.getAttribute('data-tooltip-message') || getStatusMismatchTooltipMessage();
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
      state.statusMismatchTooltips.push({ app, mountEl });
      app.mount(mountEl);
    });
  }

  function translateStatusCells() {
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
      const canonical = normalizeStatus(raw);
      const value = canonical || raw;
      const display = statusDisplay(value);

      const existingWrapper = td.querySelector('.status-cell-wrapper');
      const existingBadge = existingWrapper ? existingWrapper.querySelector('.update-count-badge') : null;
      const badgeData = existingBadge
        ? {
            dnNumber: existingBadge.getAttribute('data-dn-number'),
            count: existingBadge.textContent,
            title: existingBadge.getAttribute('title'),
          }
        : null;

      td.innerHTML = '';

      const wrapper = document.createElement('div');
      wrapper.className = 'status-cell-wrapper';

      const textSpan = document.createElement('span');
      textSpan.className = 'status-text';
      textSpan.textContent = display || '';
      wrapper.appendChild(textSpan);

      if (badgeData && badgeData.dnNumber) {
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'update-count-badge';
        badge.setAttribute('data-dn-number', badgeData.dnNumber);
        if (badgeData.title) {
          badge.setAttribute('title', badgeData.title);
        }
        badge.textContent = badgeData.count || '';
        addListener(badge, 'click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (badgeData.dnNumber && handleOpenUpdateHistory) {
            handleOpenUpdateHistory(badgeData.dnNumber);
          }
        });
        wrapper.appendChild(badge);
      }

      td.appendChild(wrapper);

      const statusDeliveryValue = td.getAttribute('data-status-delivery') || '';
      if (shouldShowStatusMismatch(statusDeliveryValue, raw)) {
        const indicator = document.createElement('span');
        indicator.className = 'status-mismatch';
        indicator.setAttribute('data-status-mismatch', 'true');
        indicator.setAttribute('data-tooltip-message', tooltipMessage);
        wrapper.appendChild(indicator);
        if (summaryRow) {
          summaryRow.classList.add('status-mismatch-row');
          summaryRow.setAttribute('data-status-mismatch', 'true');
        }
      }
    });
    setupStatusMismatchTooltips();
  }

  function openViewerWithUrl(url) {
    if (!url || !viewerFactory) return;

    cleanupViewer();

    try {
      state.viewerInstance = viewerFactory({
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

  function setupDetailInputs() {
    const targets = tbody.querySelectorAll('.detail-value[data-input-key]');
    if (!targets.length) return;

    targets.forEach((target) => {
      const encodedValue = target.getAttribute('data-input-value') || '';
      const initialValue = decodeDetailInputValue(encodedValue);
      const app = createApp({
        data() {
          return { currentValue: initialValue };
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
      state.detailInputMounts.push({ app, mountEl: target });
      app.mount(target);
    });
  }

  function cleanupDetailInputs() {
    if (!state.detailInputMounts.length) return;
    state.detailInputMounts.forEach(({ app, mountEl }) => {
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
    state.detailInputMounts = [];
  }

  function updateDetailSaveButtonLabels() {
    const label = translate('details.save', '保存') || '保存';
    tbody.querySelectorAll('.detail-save-btn').forEach((btn) => {
      btn.textContent = label;
    });
  }

  function renderRows(items) {
    updateActionColumnVisibility();
    cleanupStatusMismatchTooltips();
    cleanupDetailInputs();

    state.cachedItems = Array.isArray(items) ? items.slice() : [];
    const currentKeys = new Set();
    const showActions = shouldShowActionsColumn();
    const summaryColumnCount = getSummaryColumnCount(showActions);

    tbody.innerHTML = state.cachedItems
      .map((item, index) => {
        const rowKey = getRowKey(item, index);
        currentKeys.add(rowKey);
        const detailEntries = collectDetailEntries(item);
        const hasDetails = detailEntries.length > 0 && detailEntries.some(([key]) => !SUMMARY_FIELD_KEYS.has(String(key)));
        const isExpanded = hasDetails && state.expandedRowKeys.has(rowKey);
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
          state.expandedRowKeys.delete(rowKey);
        }
        return summaryHtml + (detailHtml || '');
      })
      .join('');

    setupDetailInputs();
    hideUpdatedAtColumn();

    Array.from(state.expandedRowKeys).forEach((key) => {
      if (!currentKeys.has(key)) {
        state.expandedRowKeys.delete(key);
      }
    });
  }

  function rerenderTableActions() {
    renderRows(state.cachedItems);
    bindRowActions();
  }

  function bindRowActions() {
    tbody.querySelectorAll('button[data-act]').forEach((btn) => {
      const act = btn.getAttribute('data-act');
      const id = Number(btn.getAttribute('data-id'));
      if (act === 'edit' && handleOpenEdit) {
        addListener(btn, 'click', () => {
          const item = state.cachedItems.find((it) => it.id === id);
          if (item) handleOpenEdit(item);
        });
      } else if (act === 'del' && handleDelete) {
        addListener(btn, 'click', () => {
          const item = state.cachedItems.find((it) => it.id === id);
          if (item) {
            handleDelete(item);
            return;
          }
          const dnAttr = btn.getAttribute('data-dn') || '';
          handleDelete({ id, dn_number: dnAttr });
        });
      }
    });

    tbody.querySelectorAll('.view-link').forEach((trigger) => {
      addListener(trigger, 'click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const url = trigger.getAttribute('data-url');
        if (typeof trigger.blur === 'function') {
          trigger.blur();
        }
        openViewerWithUrl(url);
      });
    });

    tbody.querySelectorAll('.update-count-badge').forEach((badge) => {
      addListener(badge, 'click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const dnNumber = badge.getAttribute('data-dn-number');
        if (dnNumber && handleOpenUpdateHistory) {
          handleOpenUpdateHistory(dnNumber);
        }
      });
    });

    tbody.querySelectorAll('.summary-primary').forEach((primary) => {
      addListener(primary, 'click', async (event) => {
        event.stopPropagation();
        const dnValue = (primary.getAttribute('data-dn-number') || '').trim();
        if (!dnValue) return;
        const copied = await copyTextToClipboard(dnValue);
        toast(copied ? '已复制DN Number' : '复制 DN Number 失败', copied ? 'success' : 'error');
      });
    });

    tbody.querySelectorAll('.summary-du-id-value').forEach((duButton) => {
      addListener(duButton, 'click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof duButton.blur === 'function') {
          duButton.blur();
        }
        const duValue = (duButton.getAttribute('data-du-id') || '').trim();
        if (!duValue) return;
        const copied = await copyTextToClipboard(duValue);
        const successMsg = translate('toast.copyDuIdSuccess', '已复制 DU ID') || '已复制 DU ID';
        const failMsg = translate('toast.copyDuIdFail', '复制 DU ID 失败') || '复制 DU ID 失败';
        toast(copied ? successMsg : failMsg, copied ? 'success' : 'error');
      });
    });

    tbody.querySelectorAll('tr.summary-row.expandable').forEach((row) => {
      const rowKey = row.getAttribute('data-row-key');
      if (!rowKey) return;
      addListener(row, 'click', (event) => {
        if (!row.classList.contains('expandable')) return;
        const target = event.target;
        if (target && (target.closest('button') || target.closest('a'))) return;
        toggleRow(rowKey);
      });
      addListener(row, 'keydown', (event) => {
        if (!row.classList.contains('expandable')) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const target = event.target;
        if (target && target !== row && target.closest('button, a')) {
          return;
        }
        event.preventDefault();
        toggleRow(rowKey);
      });
    });
  }

  function cleanup() {
    cleanupStatusMismatchTooltips();
    cleanupDetailInputs();
    cleanupViewer();
    state.expandedRowKeys.clear();
    state.cachedItems = [];
  }

  function closeViewer() {
    cleanupViewer();
  }

  return {
    renderRows,
    bindRowActions,
    rerenderTableActions,
    translateStatusCells,
    updateDetailSaveButtonLabels,
    updateActionColumnVisibility,
    hideUpdatedAtColumn,
    cleanup,
    openViewerWithUrl,
    closeViewer,
    cleanupViewer
  };

}
