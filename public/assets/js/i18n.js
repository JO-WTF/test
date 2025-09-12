// /assets/js/i18n.js
import { createApp, reactive } from "vue";

// 假设 i18n/core.js 已经用 <script> 引入为全局 I18NCore
// 如果要 ESM，可以改成 import I18NCore from '/assets/js/i18n/core.js';

export const i18n = I18NCore.createI18n({
  ns: "index",              // 首页用 index.json
  lang: I18NCore.detectLang("zh"),
  fallbackLang: "en"
});

export const state = reactive({
  lang: i18n.state.lang
});

export function t(key, vars) {
  return i18n.t(key, vars);
}

export async function setLang(lang) {
  await i18n.setLang(lang);
  state.lang = lang;        // 让 Vue 响应式刷新按钮状态
}

// 初始化
await i18n.init();
