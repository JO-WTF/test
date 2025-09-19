const STORE = {
  cache: new Map(),
};

function safeGetLocalStorage(key) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ? window.localStorage.getItem(key) : null;
  } catch (err) {
    console.warn('Failed to read language from localStorage:', err);
    return null;
  }
}

function safeSetLocalStorage(key, value) {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch (err) {
    console.warn('Failed to persist language to localStorage:', err);
  }
}

export function detectLang(defaultLang = 'zh', storageKey = 'lang') {
  if (typeof window === 'undefined') return defaultLang;
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  if (urlLang) return urlLang;
  if (storageKey) {
    const saved = safeGetLocalStorage(storageKey);
    if (saved) return saved;
  }
  const nav = (navigator.language || '').toLowerCase();
  if (nav.startsWith('zh')) return 'zh';
  if (nav.startsWith('en')) return 'en';
  if (nav.startsWith('id')) return 'id';
  return defaultLang;
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
    storageKey: opts.storageKey === null ? null : opts.storageKey || 'lang',
    defaultLang: opts.defaultLang || 'zh',
    lang:
      opts.lang ||
      detectLang(opts.defaultLang || 'zh', opts.storageKey === null ? null : opts.storageKey || 'lang'),
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
    if (!newLang || newLang === state.lang) return;
    state.lang = newLang;
    await loadDict(state.lang);
    if (state.storageKey) safeSetLocalStorage(state.storageKey, state.lang);
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
