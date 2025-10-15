import Toastify from 'toastify-js';

export function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function setFormControlValue(control, value) {
  if (!control) return;
  const tagName = control.tagName ? control.tagName.toLowerCase() : '';
  try {
    if (tagName === 'select') {
      control.value = value;
      if (value === '') {
        if (control.value !== '') {
          control.selectedIndex = -1;
        }
      } else if (control.value !== value) {
        const options = Array.from(control.options || []);
        const matched = options.find((opt) => opt.value === value);
        if (matched) {
          control.value = matched.value;
        } else {
          control.selectedIndex = -1;
        }
      }
      return;
    }
    if (tagName === 'input' && (control.type === 'checkbox' || control.type === 'radio')) {
      control.checked = Boolean(value);
      return;
    }
    control.value = value;
  } catch (err) {
    console.error(err);
  }
}

export function normalizeDateControlValue(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const normalized = normalizeDateControlValue(value[i]);
      if (normalized) return normalized;
    }
    return '';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return normalizeDateControlValue(new Date(value));
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const year = String(value.getFullYear()).padStart(4, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (value && typeof value === 'object' && typeof value.format === 'function') {
    try {
      const formatted = value.format('YYYY-MM-DD');
      return typeof formatted === 'string' ? normalizeDateControlValue(formatted) : '';
    } catch (err) {
      console.error(err);
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    const genericMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (genericMatch) {
      const year = genericMatch[1].padStart(4, '0');
      const month = genericMatch[2].padStart(2, '0');
      const day = genericMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return '';
  }
  try {
    const str = String(value).trim();
    if (!str) return '';
    return normalizeDateControlValue(str);
  } catch (err) {
    console.error(err);
  }
  return '';
}

export function showToast(text, type = 'info') {
  let backgroundColor = '#0f172a';
  if (type === 'success') backgroundColor = '#16a34a';
  else if (type === 'error') backgroundColor = '#dc2626';
  Toastify({
    text,
    duration: 3000,
    gravity: 'bottom',
    position: 'center',
    stopOnFocus: true,
    style: { background: backgroundColor },
  }).showToast();
}

export function normalizeTextValue(value) {
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

export function extractResponseMessage(payload, fallbackText = '') {
  if (payload && typeof payload === 'object') {
    for (const key of ['message', 'msg', 'detail', 'error']) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
  }
  return typeof fallbackText === 'string' && fallbackText.trim() ? fallbackText : '';
}

export async function fetchWithPayload(url, options = {}) {
  const resp = await fetch(url, options);
  let text = '';
  try {
    text = await resp.text();
  } catch (err) {
    console.error(err);
  }

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error(err);
    }
  }

  const message = extractResponseMessage(data, text);
  return { resp, data, text, message };
}

export function bindAsyncButtonClick(button, handler, { onFinally, signal } = {}) {
  if (!button || typeof handler !== 'function') return;
  const options = {};
  if (signal) options.signal = signal;
  button.addEventListener(
    'click',
    async () => {
      if (button.disabled) return;
      button.disabled = true;
      try {
        await handler();
      } catch (err) {
        console.error(err);
      } finally {
        if (typeof onFinally === 'function') {
          onFinally();
        } else {
          button.disabled = false;
        }
      }
    },
    options
  );
}

function toDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const millis = value < 1e12 ? value * 1000 : value;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && trimmed.length <= 12) {
      const millis = numeric < 1e12 ? numeric * 1000 : numeric;
      const date = new Date(millis);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function formatDateFallback(dateString, { referenceHour = 12 } = {}) {
  const suffix = `T${String(referenceHour).padStart(2, '0')}:00:00`;
  const value = new Date(`${dateString}${suffix}`);
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  return value.toISOString();
}

export function convertDateToOffsetIso(
  dateString,
  {
    offsetMinutes = 0,
    referenceHour = 12,
    referenceMinute = 0,
    referenceSecond = 0,
    referenceMillisecond = 0,
  } = {}
) {
  if (!dateString) return '';

  const parts = String(dateString).split('-');
  if (parts.length < 3) {
    return formatDateFallback(dateString, { referenceHour });
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
    return formatDateFallback(dateString, { referenceHour });
  }

  const offset = Number.isFinite(offsetMinutes) ? offsetMinutes : 0;

  const utcTimestamp =
    Date.UTC(
      year,
      monthIndex,
      day,
      referenceHour,
      referenceMinute,
      referenceSecond,
      referenceMillisecond
    ) -
    offset * 60 * 1000;

  return new Date(utcTimestamp).toISOString();
}

const DEFAULT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatTimestampWithOffset(
  timestamp,
  {
    offsetMinutes = 0,
    monthNames = DEFAULT_MONTH_NAMES,
    dateSeparator = ' ',
    timeSeparator = ':',
    dateTimeSeparator = ' \n ',
  } = {}
) {
  if (!timestamp && timestamp !== 0) return '';
  const sourceDate = toDate(timestamp);
  if (!sourceDate) return '';
  const offset = Number.isFinite(offsetMinutes) ? offsetMinutes : 0;
  const target = new Date(sourceDate.getTime() + offset * 60 * 1000);

  const monthIndex = target.getUTCMonth();
  const monthLabel = monthNames[monthIndex] || String(monthIndex + 1).padStart(2, '0');
  const day = String(target.getUTCDate()).padStart(2, '0');
  const hours = String(target.getUTCHours()).padStart(2, '0');
  const minutes = String(target.getUTCMinutes()).padStart(2, '0');
  const seconds = String(target.getUTCSeconds()).padStart(2, '0');

  const datePart = [day, monthLabel].join(dateSeparator);
  const timePart = [hours, minutes, seconds].join(timeSeparator);
  return `${datePart}${dateTimeSeparator}${timePart}`;
}

export function formatTimestampForExport(value, { offsetMinutes = 0 } = {}) {
  if (value === null || value === undefined || value === '') return '';

  const sourceDate = toDate(value);
  if (!sourceDate) return '';

  const offset = Number.isFinite(offsetMinutes) ? offsetMinutes : 0;
  const target = new Date(sourceDate.getTime() + offset * 60 * 1000);

  const year = target.getUTCFullYear();
  const month = String(target.getUTCMonth() + 1).padStart(2, '0');
  const day = String(target.getUTCDate()).padStart(2, '0');
  const hours = String(target.getUTCHours()).padStart(2, '0');
  const minutes = String(target.getUTCMinutes()).padStart(2, '0');
  const seconds = String(target.getUTCSeconds()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

const DEFAULT_TIMESTAMP_KEY_PATTERN = /(timestamp|_at|_time|time$|createdat|updatedat|createdtime|updatedtime|latestrecordcreatedat)/;

export function isTimestampKey(key, pattern = DEFAULT_TIMESTAMP_KEY_PATTERN) {
  if (!key) return false;
  return pattern.test(key);
}

function appendSearchParamValues(params, key, values, { dedupe = true } = {}) {
  if (!Array.isArray(values) || !values.length) return;

  const normalizedValues = [];
  const seen = dedupe ? new Set() : null;

  values.forEach((value) => {
    const normalized = normalizeTextValue(value);
    if (!normalized) return;
    if (seen) {
      if (seen.has(normalized)) return;
      seen.add(normalized);
    }
    normalizedValues.push(normalized);
  });

  if (!normalizedValues.length) return;

  if (normalizedValues.length === 1) {
    params.set(key, normalizedValues[0]);
    return;
  }

  normalizedValues.forEach((value) => params.append(key, value));
}

export function setSearchParamValues(params, entries, { dedupe = true } = {}) {
  if (!params || typeof params.append !== 'function') return;
  if (!entries || typeof entries !== 'object') return;

  Object.entries(entries).forEach(([key, values]) => {
    if (!key) return;
    appendSearchParamValues(params, key, Array.isArray(values) ? values : [values], {
      dedupe,
    });
  });
}

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCSV(rows, filename = 'dn_all_results.csv') {
  if (!Array.isArray(rows) || !rows.length) return;
  const csvContent = rows
    .map((row) => (Array.isArray(row) ? row : [row]).map((cell) => csvEscape(cell)).join(','))
    .join('\n');

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export function extractItemsFromResponse(payload) {
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
