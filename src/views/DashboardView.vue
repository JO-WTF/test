<template>
  <div class="wrap dashboard-view" ref="dashboardRoot">
    <LanguageSwitcher v-model="currentLang" @change="changeLang" />

    <header class="header">
      <div>
        <div class="title"><span class="big" data-i18n="title">Overall Deliveries</span></div>
        <div class="sub" id="meta" data-i18n="metaPlaceholder">Date：— ・ Total: —</div>
      </div>
      <div class="controls">
        <input
          id="q"
          class="input"
          placeholder="Filter Region/Project…"
          data-i18n-placeholder="filterPlaceholder"
        />
        <select id="datePicker" class="select"></select>
        <button
          id="toggleZero"
          class="btn primary"
          title="切换是否弱化为 0 的单元格"
          data-i18n="controls.highlightNonZero"
          data-i18n-title="controls.toggleZeroTitle"
        >
          Highlight Non-Zero
        </button>
        <button id="dl" class="btn" data-i18n="controls.exportCsv">Export CSV</button>
      </div>
    </header>

    <section class="grid cols-3" style="margin: 8px 0">
      <div class="infocard">
        <div>
          <div class="k" data-i18n="infocard.pod.title">POD</div>
          <div id="podTotal" class="v">—</div>
          <div class="k" data-i18n="infocard.pod.desc">Successful Delivery</div>
        </div>
      </div>
      <div class="infocard">
        <div>
          <div class="k" data-i18n="infocard.replan.title">Replan</div>
          <div id="replanTotal" class="v">—</div>
          <div class="k" data-i18n="infocard.replan.desc">REPLANs made by LSP or Project</div>
        </div>
      </div>
      <div class="infocard">
        <div>
          <div class="k" data-i18n="infocard.closed.title">Closed</div>
          <div id="closedTotal" class="v">—</div>
          <div class="k" data-i18n="infocard.closed.desc">Closed or cancelled</div>
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
          <span class="chip" data-i18n="legend.pod">POD</span
          ><span class="desc" data-i18n="legend.pod.desc">已交付证明</span>
        </div>
        <div class="legend">
          <span class="chip" data-i18n="legend.waitingPic">WAITING PHOTO FEEDBACK</span
          ><span class="desc" data-i18n="legend.waitingPic.desc">等待图片反馈</span>
        </div>
        <div class="legend">
          <span class="chip" data-i18n="legend.replan">REPLAN MOS…</span
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
import { createI18n } from '../i18n/core';
import { applyI18n } from '../i18n/dom';
import { setupDashboardPage } from './dashboard/setupDashboardPage';
import { useBodyTheme } from '../composables/useBodyTheme';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';

const dashboardRoot = ref(null);
const currentLang = ref('en');
let pageController = null;
let i18nInstance = null;

useBodyTheme('dashboard-theme');

const applyTranslations = () => {
  if (dashboardRoot.value && i18nInstance) {
    applyI18n(dashboardRoot.value, i18nInstance);
  }
};

const changeLang = async (lang) => {
  if (!i18nInstance || !lang) return;
  await i18nInstance.setLang(lang);
};

onMounted(async () => {
  i18nInstance = createI18n({
    namespaces: ['dashboard'],
    fallbackLang: 'en',
    defaultLang: 'en',
  });
  await i18nInstance.init();
  currentLang.value = i18nInstance.state.lang;
  applyTranslations();
  document.documentElement.setAttribute(
    'lang',
    currentLang.value === 'zh' ? 'zh-CN' : currentLang.value
  );

  const translator = (key, vars) => i18nInstance.t(key, vars);
  pageController = setupDashboardPage(dashboardRoot.value, { t: translator });

  i18nInstance.onChange((lang) => {
    currentLang.value = lang;
    applyTranslations();
    // document.documentElement.lang 现在由 i18n 核心模块自动更新
    pageController?.updateI18n?.({ t: translator });
  });
});

onBeforeUnmount(() => {
  pageController?.destroy?.();
});
</script>

<style src="../assets/css/dashboard.css"></style>
