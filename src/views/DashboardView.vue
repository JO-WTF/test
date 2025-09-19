<template>
  <div class="wrap dashboard-view" ref="dashboardRoot">
    <div class="lang-switch" aria-label="Language switch">
      <button
        :class="{ active: currentLang === 'zh' }"
        aria-label="切换为中文"
        @click="() => changeLang('zh')"
      >
        <img src="https://flagcdn.com/w20/cn.png" alt="CN" />中文
      </button>
      <button
        :class="{ active: currentLang === 'en' }"
        aria-label="Switch to English"
        @click="() => changeLang('en')"
      >
        <img src="https://flagcdn.com/w20/gb.png" alt="GB" />English
      </button>
      <button
        :class="{ active: currentLang === 'id' }"
        aria-label="Beralih ke Bahasa Indonesia"
        @click="() => changeLang('id')"
      >
        <img src="https://flagcdn.com/w20/id.png" alt="ID" />Indonesia
      </button>
    </div>

    <header class="header">
      <div>
        <div class="title">
          <span class="big" data-i18n="header.title">Overall Deliveries</span>
        </div>
        <div class="sub" id="meta" data-i18n="header.metaPlaceholder">
          Date：— ・ Total: —
        </div>
      </div>
      <div class="controls">
        <input
          id="q"
          class="input"
          data-i18n-placeholder="controls.filterPlaceholder"
          placeholder="Filter Region/Project…"
        />
        <select id="datePicker" class="select"></select>
        <button id="toggleZero" class="btn primary">Highlight Non-Zero</button>
        <button id="dl" class="btn" data-i18n="actions.exportCsv">Export CSV</button>
      </div>
    </header>

    <section class="grid cols-3" style="margin: 16px 0">
      <div class="infocard">
        <div>
          <div class="k" data-i18n="cards.pod.label">POD</div>
          <div id="podTotal" class="v">—</div>
          <div class="k" data-i18n="cards.pod.desc">Successful Delivery</div>
        </div>
      </div>
      <div class="infocard">
        <div>
          <div class="k" data-i18n="cards.replan.label">Replan</div>
          <div id="replanTotal" class="v">—</div>
          <div class="k" data-i18n="cards.replan.desc">REPLANs made by LSP or Project</div>
        </div>
      </div>
      <div class="infocard">
        <div>
          <div class="k" data-i18n="cards.closed.label">Closed</div>
          <div id="closedTotal" class="v">—</div>
          <div class="k" data-i18n="cards.closed.desc">Closed or cancelled</div>
        </div>
      </div>
    </section>

    <section class="table-section card">
      <div class="table-scroll">
        <table id="tbl">
          <thead>
            <tr id="thead-row"></tr>
          </thead>
          <tbody id="tbody"></tbody>
          <tfoot>
            <tr id="tfoot-row"></tr>
          </tfoot>
        </table>
      </div>
      <div
        class="grid cols-3"
        style="padding: 12px; border-top: 1px solid var(--line); background: #f8fafc"
      >
        <div class="legend">
          <span class="chip" data-i18n="status.pod">POD</span>
          <span class="desc" data-i18n="legend.pod.desc">已交付证明</span>
        </div>
        <div class="legend">
          <span class="chip" data-i18n="status.waitingPic">WAITING PIC FEEDBACK</span
          ><span class="desc" data-i18n="legend.waiting.desc">等待图片反馈</span>
        </div>
        <div class="legend">
          <span class="chip" data-i18n="legend.replan.chip">REPLAN MOS…</span
          ><span class="desc" data-i18n="legend.replan.desc">因项目/LSP 延误需要重排</span>
        </div>
      </div>
    </section>

    <section class="cards-section">
      <div id="cards"></div>
    </section>

    <div id="loading">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { createI18n, resolveInitialLang, setLangPreference } from '../i18n/core';
import { applyI18n } from '../i18n/dom';
import { setupDashboardPage } from './dashboard/setupDashboardPage';
import { useBodyTheme } from '../composables/useBodyTheme';

const dashboardRoot = ref(null);
const currentLang = ref('zh');
let cleanup = () => {};
let refreshTranslations = () => {};
let i18nInstance = null;

useBodyTheme('dashboard-theme');

const applyTranslations = () => {
  if (dashboardRoot.value && i18nInstance) {
    applyI18n(dashboardRoot.value, i18nInstance);
  }
};

const changeLang = async (lang) => {
  if (!i18nInstance) return;
  await i18nInstance.setLang(lang);
  setLangPreference(i18nInstance.state.lang);
};

onMounted(async () => {
  const initialLang = resolveInitialLang('en');
  i18nInstance = createI18n({ namespaces: ['dashboard'], lang: initialLang, fallbackLang: 'en' });
  await i18nInstance.init();
  currentLang.value = i18nInstance.state.lang;
  applyTranslations();
  document.documentElement.setAttribute(
    'lang',
    currentLang.value === 'zh' ? 'zh-CN' : currentLang.value
  );

  const api = setupDashboardPage(dashboardRoot.value, {
    i18n: i18nInstance,
    applyTranslations,
  });

  if (api && typeof api.destroy === 'function') {
    cleanup = api.destroy;
    refreshTranslations = api.refreshTranslations || (() => {});
  } else if (typeof api === 'function') {
    cleanup = api;
    refreshTranslations = api.refreshTranslations || (() => {});
  } else {
    cleanup = () => {};
    refreshTranslations = () => {};
  }

  refreshTranslations();

  i18nInstance.onChange((lang) => {
    setLangPreference(lang);
    currentLang.value = lang;
    applyTranslations();
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : lang);
    refreshTranslations();
  });
});

onBeforeUnmount(() => {
  cleanup?.();
});
</script>

<style src="../assets/css/dashboard.css"></style>
