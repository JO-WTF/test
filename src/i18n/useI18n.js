import { createI18n } from './core';

let _instance = null;

export async function useI18n(opts = {}) {
  if (_instance) return _instance;
  // default namespaces: core + index
  const cfg = Object.assign({ namespaces: ['core', 'index'], fallbackLang: 'en' }, opts);
  const i18n = createI18n(cfg);
  await i18n.init();
  _instance = i18n;
  return _instance;
}
