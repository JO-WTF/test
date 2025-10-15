import { createI18n } from './core';

let _instance = null;

export async function useI18n(opts = {}) {
  // default namespaces: core + index
  const cfg = Object.assign({ namespaces: ['core', 'index'], fallbackLang: 'en' }, opts);

  // If we already have a cached instance, ensure requested namespaces are loaded.
  if (_instance) {
    try {
      const requested = Array.isArray(cfg.namespaces) ? cfg.namespaces : [];
      const current = Array.isArray(_instance.state.namespaces) ? _instance.state.namespaces : [];
      const missing = requested.filter((ns) => !current.includes(ns));
      if (missing.length) {
        // merge and re-init to load the missing namespaces for the current language
        _instance.state.namespaces = Array.from(new Set([...current, ...requested]));
        if (typeof _instance.init === 'function') {
          await _instance.init();
        }
      }
    } catch (err) {
      // If merging fails, fall back to returning the existing instance
      console.warn('Failed to merge i18n namespaces:', err);
    }
    return _instance;
  }

  const i18n = createI18n(cfg);
  await i18n.init();
  _instance = i18n;
  return _instance;
}
