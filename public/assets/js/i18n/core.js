// i18n/core.js — UMD，支持 <script> 直接引入 & CommonJS
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.I18NCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const STORE = {
    cache: new Map(), // key: `${lang}:${ns}` -> object
  };

  function detectLang(defaultLang = "zh") {
    const urlLang = new URLSearchParams(location.search).get("lang");
    if (urlLang) return urlLang;
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("zh")) return "zh";
    if (nav.startsWith("en")) return "en";
    if (nav.startsWith("id")) return "id";
    return defaultLang;
  }

  async function loadNS(lang, ns) {
    const cacheKey = `${lang}:${ns}`;
    if (STORE.cache.has(cacheKey)) return STORE.cache.get(cacheKey);

    const url = `/locales/${lang}/${ns}.json`;
    const resp = await fetch(url);
    if (!resp.ok) {
      // 加载失败返回空对象（允许 fallback 合并）
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
        Object.prototype.toString.call(source[k]) === "[object Object]" &&
        Object.prototype.toString.call(out[k]) === "[object Object]"
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

  function createI18n(opts = {}) {
    const state = {
      lang: opts.lang || detectLang("zh"),
      fallbackLang: opts.fallbackLang || "en",
      namespaces: Array.isArray(opts.namespaces) ? opts.namespaces : ["common"],
      dict: {}, // 合并后的词典
      listeners: new Set(),
    };

    async function loadDict(lang) {
      // 先加载 fallback，再加载主语言，主语言覆盖 fallback
      let merged = {};
      for (const ns of state.namespaces) {
        const fb = state.fallbackLang && state.fallbackLang !== lang
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
      return typeof val === "string" ? template(val, vars) : val;
    }

    async function setLang(newLang) {
      if (!newLang || newLang === state.lang) return;
      state.lang = newLang;
      await loadDict(state.lang);
      state.listeners.forEach((fn) => {
        try { fn(state.lang); } catch {}
      });
    }

    function onChange(fn) {
      if (typeof fn === "function") state.listeners.add(fn);
      return () => state.listeners.delete(fn);
    }

    async function init() {
      await loadDict(state.lang);
      return api;
    }

    const api = { state, t, setLang, onChange, init, detectLang };
    return api;
  }

  return { createI18n, detectLang };
});
