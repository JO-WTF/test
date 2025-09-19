<template>
  <div class="admin-page" ref="adminRoot">
    <div class="container">
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

      <h2 data-i18n="title">DU 提交记录管理</h2>

      <div class="card">
        <div class="grid-2col">
          <div class="du-col">
            <label data-i18n="du.label"
              >DU ID（支持多行/逗号/空格分隔；多于1个则批量查询）</label
            >
            <div class="du-wrap">
              <div id="du-hilite" class="du-hilite" aria-hidden="true"></div>
              <textarea
                id="f-du"
                data-i18n-placeholder="du.placeholder"
                placeholder="示例：&#10;DID123...&#10;DID456...&#10;或：DID123..., DID456..."
              ></textarea>
            </div>
            <div class="muted" style="margin-top: 6px" data-i18n="du.tip">
              提示：合法格式为 DID + 13位数字 可只输入数字。
            </div>
          </div>

          <div class="rhs">
            <div class="row-line">
              <div class="field">
                <label data-i18n="status.label">状态</label>
                <select id="f-status">
                  <option value="" data-i18n="status.all">（全部）</option>
                  <option value="运输中" data-i18n="status.inTransit">运输中</option>
                  <option value="过夜" data-i18n="status.overnight">过夜</option>
                  <option value="已到达" data-i18n="status.arrived">已到达</option>
                </select>
              </div>

              <div class="field grow">
                <label data-i18n="remark.kw.label">备注关键词</label>
                <input
                  id="f-remark"
                  data-i18n-placeholder="remark.kw.placeholder"
                  placeholder="模糊匹配"
                />
              </div>

              <div class="field">
                <label data-i18n="has.label">是否带附件</label>
                <select id="f-has">
                  <option value="" data-i18n="has.any">（不限）</option>
                  <option value="true" data-i18n="has.true">有附件</option>
                  <option value="false" data-i18n="has.false">无附件</option>
                </select>
              </div>

              <div class="field">
                <label data-i18n="perPage.label">每页数量</label>
                <input
                  id="f-ps2"
                  type="number"
                  min="1"
                  max="100"
                  value="20"
                  class="w120"
                  data-i18n-placeholder="perPage.placeholder"
                  placeholder="请输入数量"
                />
              </div>
            </div>

            <div class="row-line">
              <div class="field">
                <label data-i18n="date.from">开始日期</label>
                <input id="f-from" type="date" />
              </div>
              <div class="field">
                <label data-i18n="date.to">结束日期</label>
                <input id="f-to" type="date" />
              </div>
            </div>

            <div class="row-line">
              <div class="field" style="gap: 8px; flex: 1">
                <label style="visibility: hidden" data-i18n="actions.label">操作</label>
                <div style="display: flex; gap: 8px; flex-wrap: wrap">
                  <button class="btn" id="btn-search" data-i18n="actions.query">查询</button>
                  <button class="btn ghost" id="btn-reset" data-i18n="actions.reset">重置</button>
                  <button class="btn ghost" id="btn-export-all" data-i18n="actions.exportAll">
                    导出全部
                  </button>
                  <button class="btn ghost" id="btn-trust-backend-link" data-i18n="actions.trustBackend">
                    信任后台
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div id="hint" class="muted" data-i18n="hint.ready">输入条件后点击查询。</div>
        <table id="tbl" style="display: none">
          <thead>
            <tr>
              <th data-i18n="table.id">ID</th>
              <th data-i18n="table.du">DU ID</th>
              <th data-i18n="table.status">状态</th>
              <th data-i18n="table.remark">备注</th>
              <th data-i18n="table.photo">照片</th>
              <th data-i18n="table.location">位置</th>
              <th data-i18n="table.time">时间</th>
              <th data-i18n="table.actions">操作</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <div class="pager" id="pager" style="display: none">
          <button class="ghost" id="prev" data-i18n="pager.prev">上一页</button>
          <span id="pginfo" class="muted"></span>
          <button class="ghost" id="next" data-i18n="pager.next">下一页</button>
        </div>
      </div>
    </div>

    <div id="modal-mask" class="modal-mask">
      <div class="modal">
        <h3>
          <span data-i18n="modal.title">编辑记录</span>
          <span id="modal-id" class="tag"></span>
        </h3>
        <div class="row-line">
          <div class="field">
            <label data-i18n="modal.status.label">状态</label>
            <select id="m-status">
              <option value="" data-i18n="modal.status.keep">（不修改）</option>
              <option value="运输中" data-i18n="status.inTransit">运输中</option>
              <option value="过夜" data-i18n="status.overnight">过夜</option>
              <option value="已到达" data-i18n="status.arrived">已到达</option>
            </select>
          </div>
          <div class="field grow">
            <label data-i18n="modal.remark.label">备注</label>
            <input
              id="m-remark"
              data-i18n-placeholder="modal.remark.placeholder"
              placeholder="不修改请留空"
            />
          </div>
          <div class="field grow">
            <label data-i18n="modal.photo.label">替换照片（可选）</label>
            <input id="m-photo" type="file" accept="image/*" />
          </div>
        </div>
        <div class="foot">
          <button class="btn ghost" id="m-cancel" data-i18n="modal.cancel">取消</button>
          <button class="btn" id="m-save" data-i18n="modal.save">保存</button>
        </div>
        <div class="muted" id="m-msg" style="margin-top: 6px"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { createI18n, resolveInitialLang, setLangPreference } from '../i18n/core';
import { applyI18n } from '../i18n/dom';
import { setupAdminPage } from './admin/setupAdminPage';
import 'viewerjs/dist/viewer.css';
import { useBodyTheme } from '../composables/useBodyTheme';

const adminRoot = ref(null);
const currentLang = ref('zh');
let cleanup = () => {};
let i18nInstance = null;

useBodyTheme('admin-theme');

const applyTranslations = () => {
  if (adminRoot.value && i18nInstance) {
    applyI18n(adminRoot.value, i18nInstance);
  }
};

const changeLang = async (lang) => {
  if (!i18nInstance) return;
  await i18nInstance.setLang(lang);
  setLangPreference(i18nInstance.state.lang);
  currentLang.value = i18nInstance.state.lang;
  applyTranslations();
  document.documentElement.setAttribute(
    'lang',
    currentLang.value === 'zh' ? 'zh-CN' : currentLang.value
  );
};

onMounted(async () => {
  const initialLang = resolveInitialLang('zh');
  i18nInstance = createI18n({ namespaces: ['admin'], lang: initialLang, fallbackLang: 'en' });
  await i18nInstance.init();
  currentLang.value = i18nInstance.state.lang;
  applyTranslations();
  document.documentElement.setAttribute(
    'lang',
    currentLang.value === 'zh' ? 'zh-CN' : currentLang.value
  );

  cleanup = setupAdminPage(adminRoot.value, {
    i18n: i18nInstance,
    applyTranslations,
  });

  i18nInstance.onChange((lang) => {
    setLangPreference(lang);
    currentLang.value = lang;
    applyTranslations();
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : lang);
  });
});

onBeforeUnmount(() => {
  cleanup?.();
});
</script>

<style src="../assets/css/admin.css"></style>
