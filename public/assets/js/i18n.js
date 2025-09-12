// /assets/js/i18n.js  —— 适配全局 Vue + 全局 I18NCore 的 ESM 模块
// 使用方式：<script type="module" src="/assets/js/index.js"></script> 里：
//   import { i18n, state, t, setLang, ready } from "/assets/js/i18n.js";
//   await ready; // 确保词典加载完

// 只用 reactive 即可；createApp 不需要
const { reactive } = Vue;

// 假设 i18n/core.js 已作为 <script> 全局引入（window.I18NCore 已存在）
export const i18n = I18NCore.createI18n({
  namespaces: ["index"],              // ✅ 用 namespaces 数组
  lang: I18NCore.detectLang("zh"),
  fallbackLang: "en"
});

export const state = reactive({
  lang: i18n.state.lang
});

export function t(key, vars) {
  return i18n.t(key, vars);
}

export function tFactory(ns) {
  return function(key, vars) {
    return i18n.t(ns + "." + key, vars);
  };
}

export async function setLang(lang) {
  await i18n.setLang(lang);
  state.lang = lang;        // 驱动 UI 刷新
}

// 导出一个 ready Promise，方便外部 await
export const ready = i18n.init();
