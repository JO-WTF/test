const SCROLL_LOCK_CLASS = 'admin-scroll-locked';
let scrollLockCount = 0;

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

function applyScrollLockClass(target, action) {
  if (!target || typeof target.classList?.[action] !== 'function') return;
  try {
    target.classList[action](SCROLL_LOCK_CLASS);
  } catch (err) {
    console.error(err);
  }
}

function setScrollLockClasses(action) {
  if (typeof document === 'undefined') return;
  applyScrollLockClass(document.body, action);
  applyScrollLockClass(document.documentElement, action);
}

export function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  scrollLockCount += 1;
  if (scrollLockCount === 1) {
    setScrollLockClasses('add');
  }
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (scrollLockCount > 0) {
    scrollLockCount -= 1;
  }
  if (scrollLockCount === 0) {
    setScrollLockClasses('remove');
  }
}

export function resetBodyScrollLock() {
  scrollLockCount = 0;
  setScrollLockClasses('remove');
}
