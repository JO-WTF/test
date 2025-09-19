const STORE = {
  cache: new Map(),
};

const PRIMARY_LANG_STORAGE_KEY = 'lang';
const ALT_LANG_STORAGE_KEYS = ['preferredLanguage', 'preferredLang'];

function normalizeLang(raw) {
  if (typeof raw !== 'string') return '';
  const value = raw.trim().toLowerCase();
  if (!value) return '';
  if (value.startsWith('zh')) return 'zh';
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('id')) return 'id';
  if (value === 'zh' || value === 'en' || value === 'id') return value;
  return '';
}

function safeLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || null;
  } catch (err) {
    console.warn('Unable to access localStorage', err);
    return null;
  }
}

function readLangFromUrl() {
  if (typeof window === 'undefined') return '';
  try {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    return normalizeLang(urlLang || '');
  } catch {
    return '';
  }
}

function pickNavigatorLang(defaultLang = 'zh') {
  const normalizedDefault = normalizeLang(defaultLang) || 'zh';
  if (typeof navigator === 'undefined') return normalizedDefault;
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  for (const cand of candidates) {
    const normalized = normalizeLang(cand);
    if (normalized) return normalized;
  }
  return normalizedDefault;
}

export function getLangPreference() {
  const storage = safeLocalStorage();
  if (!storage) return '';
  const keys = [PRIMARY_LANG_STORAGE_KEY, ...ALT_LANG_STORAGE_KEYS];
  for (const key of keys) {
    try {
      const raw = storage.getItem(key);
      const normalized = normalizeLang(raw || '');
      if (normalized) return normalized;
    } catch {
      continue;
    }
  }
  return '';
}

export function setLangPreference(lang) {
  const storage = safeLocalStorage();
  if (!storage) return;
  const normalized = normalizeLang(lang);
  if (!normalized) return;
  try {
    storage.setItem(PRIMARY_LANG_STORAGE_KEY, normalized);
  } catch (err) {
    console.warn('Unable to persist language preference', err);
  }
}

export function detectLang(defaultLang = 'zh') {
  if (typeof window === 'undefined') return normalizeLang(defaultLang) || 'zh';
  const urlLang = readLangFromUrl();
  if (urlLang) return urlLang;
  return pickNavigatorLang(defaultLang);
}

export function resolveInitialLang(defaultLang = 'zh') {
  if (typeof window === 'undefined') return normalizeLang(defaultLang) || 'zh';
  const urlLang = readLangFromUrl();
  if (urlLang) return urlLang;
  const stored = getLangPreference();
  if (stored) return stored;
  return pickNavigatorLang(defaultLang);
}

async function loadNS(lang, ns) {
  const cacheKey = `${lang}:${ns}`;
  if (STORE.cache.has(cacheKey)) return STORE.cache.get(cacheKey);

  const url = `/locales/${lang}/${ns}.json`;
  const resp = await fetch(url);
  if (!resp.ok) {
    STORE.cache.set(cacheKey, {});
    return {};
  }
  const data = await resp.json();
  STORE.cache.set(cacheKey, data || {});
  return data || {};
}

function deepMerge(target, source) {
  const out = { ...(target || {}) };
  for (const k in source || {}) {
    if (
      Object.prototype.toString.call(source[k]) === '[object Object]' &&
      Object.prototype.toString.call(out[k]) === '[object Object]'
    ) {
      out[k] = deepMerge(out[k], source[k]);
    } else {
      out[k] = source[k];
    }
  }
  return out;
}

function template(str, vars) {
  if (!vars) return str;
  return String(str).replace(/\{(\w+)\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`
  );
}

export function createI18n(opts = {}) {
  const state = {
    lang: normalizeLang(opts.lang) || detectLang(opts.defaultLang || 'zh'),
    fallbackLang: opts.fallbackLang || 'en',
    namespaces: Array.isArray(opts.namespaces) ? opts.namespaces : ['common'],
    dict: {},
    listeners: new Set(),
  };

  async function loadDict(lang) {
    let merged = {};
    for (const ns of state.namespaces) {
      const fb =
        state.fallbackLang && state.fallbackLang !== lang
          ? await loadNS(state.fallbackLang, ns)
          : {};
      const main = await loadNS(lang, ns);
      merged = deepMerge(merged, deepMerge(fb, main));
    }
    state.dict = merged;
  }

  function t(key, vars) {
    const val = state.dict && state.dict[key];
    if (val == null) return key;
    return typeof val === 'string' ? template(val, vars) : val;
  }

  async function setLang(newLang) {
    const normalized = normalizeLang(newLang);
    if (!normalized || normalized === state.lang) return;
    state.lang = normalized;
    await loadDict(state.lang);
    state.listeners.forEach((fn) => {
      try {
        fn(state.lang);
      } catch (err) {
        console.error(err);
      }
    });
  }

  function onChange(fn) {
    if (typeof fn === 'function') state.listeners.add(fn);
    return () => state.listeners.delete(fn);
  }

  async function init() {
    await loadDict(state.lang);
    return api;
  }

  const api = { state, t, setLang, onChange, init };
  return api;
}
