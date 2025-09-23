<template>
  <div class="admin-page" ref="adminRoot">
    <div class="container dn-admin-container">
      <div class="page-header">
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
        <div class="auth-area">
          <span id="auth-role-tag" class="role-tag" data-i18n="auth.current"></span>
          <button class="btn ghost accent" id="btn-auth" data-i18n="auth.trigger">
            授权
          </button>
        </div>
      </div>

      <h2 data-i18n="title">DN 提交记录管理</h2>

      <div class="card">
        <div
          id="status-card-wrapper"
          class="status-card-section"
          style="display: none"
          role="group"
        >
          <div class="status-card-grid" id="status-card-container"></div>
        </div>
        <div class="grid-2col">
          <div class="du-col">
            <label data-i18n="dn.label"
              >DN 号（支持多行/逗号/空格分隔；多于1个则批量查询）</label
            >
            <div class="du-wrap">
              <div id="dn-preview" class="du-hilite" aria-hidden="true"></div>
              <textarea
                id="f-dn"
                data-i18n-placeholder="dn.placeholder"
                placeholder="示例：&#10;DN123...&#10;DN456..."
              ></textarea>
            </div>
            <div class="muted" style="margin-top: 6px" data-i18n="dn.tip">
              提示：DN 号支持字母数字与短横线。
            </div>
          </div>

          <div class="rhs">
            <div class="row-line">
              <div class="field">
                <label data-i18n="planMosDate.label">Plan MOS Date</label>
                <input
                  id="f-plan-mos-date"
                  list="f-plan-mos-date-options"
                  data-i18n-placeholder="planMosDate.placeholder"
                  placeholder="输入或选择"
                />
                <datalist id="f-plan-mos-date-options"></datalist>
              </div>
              <div class="field">
                <label data-i18n="region.label">Region</label>
                <input
                  id="f-region"
                  list="f-region-options"
                  data-i18n-placeholder="region.placeholder"
                  placeholder="输入或选择"
                />
                <datalist id="f-region-options"></datalist>
              </div>
              <div class="field">
                <label data-i18n="lsp.label">LSP</label>
                <input
                  id="f-lsp"
                  list="f-lsp-options"
                  data-i18n-placeholder="lsp.placeholder"
                  placeholder="输入或选择"
                />
                <datalist id="f-lsp-options"></datalist>
              </div>
              <div class="field">
                <label data-i18n="subcon.label">分包商</label>
                <input
                  id="f-subcon"
                  list="f-subcon-options"
                  data-i18n-placeholder="subcon.placeholder"
                  placeholder="输入或选择"
                />
                <datalist id="f-subcon-options"></datalist>
              </div>
            </div>

            <div class="row-line">
              <div class="field">
                <label data-i18n="status.label">状态</label>
                <select id="f-status">
                  <option
                    v-for="option in statusFilterOptions"
                    :key="option.value"
                    :value="option.value"
                    :data-i18n="option.i18nKey || null"
                  >
                    {{ option.fallback }}
                  </option>
                </select>
              </div>
              <div class="field">
                <label data-i18n="statusWh.label">仓库状态</label>
                <input
                  id="f-status-wh"
                  list="f-status-wh-options"
                  data-i18n-placeholder="statusWh.placeholder"
                  placeholder="输入或选择"
                />
                <datalist id="f-status-wh-options"></datalist>
              </div>
              <div class="field">
                <label data-i18n="statusDelivery.label">配送状态</label>
                <input
                  id="f-status-delivery"
                  list="f-status-delivery-options"
                  data-i18n-placeholder="statusDelivery.placeholder"
                  placeholder="输入或选择"
                />
                <datalist id="f-status-delivery-options"></datalist>
              </div>
            </div>

            <div class="row-line">
              <div class="field" style="display: none" aria-hidden="true">
                <label data-i18n="has.label">是否带附件</label>
                <select id="f-has">
                  <option value="" data-i18n="has.any">（不限）</option>
                  <option value="true" data-i18n="has.true">有附件</option>
                  <option value="false" data-i18n="has.false">无附件</option>
                </select>
              </div>
              <div class="field">
                <label data-i18n="hasCoord.label">经纬度</label>
                <select id="f-has-coordinate">
                  <option value="" data-i18n="hasCoord.any">（不限）</option>
                  <option value="true" data-i18n="hasCoord.true">有经纬度</option>
                  <option value="false" data-i18n="hasCoord.false">无经纬度</option>
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
                <label data-i18n="du.filter.label">关联 DU ID</label>
                <input
                  id="f-du"
                  data-i18n-placeholder="du.filter.placeholder"
                  placeholder="精确匹配"
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
                  <button
                    class="btn ghost"
                    id="btn-export-records"
                    data-i18n="actions.exportRecords"
                  >
                    导出DN更新记录
                  </button>
                  <button class="btn ghost" id="btn-trust-backend-link" data-i18n="actions.trustBackend">
                    信任后台
                  </button>
                  <button
                    class="btn ghost"
                    id="btn-sync-google-sheet"
                    data-i18n="actions.syncGoogleSheet"
                  >
                    更新Google Sheet数据
                  </button>
                  <button
                    class="btn ghost"
                    id="btn-dn-entry"
                    style="display: none"
                    data-i18n="actions.dnEntry"
                  >
                    DN 录入
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
              <th data-i18n="table.dn">DN 号</th>
              <th data-i18n="table.region">区域</th>
              <th data-i18n="table.planMosDate">PLAN MOS DATE</th>
              <th data-i18n="table.lsp">LSP</th>
              <th data-i18n="table.issueRemark">ISSUE REMARK</th>
              <th data-i18n="table.statusDelivery">STATUS DELIVERY</th>
              <th data-i18n="table.status">状态</th>
              <th data-i18n="table.remark">备注</th>
              <th data-i18n="table.photo">照片</th>
              <th data-i18n="table.location">位置</th>
              <th
                data-i18n="table.updatedAt"
                data-column="updatedAt"
                style="display: none"
                aria-hidden="true"
              >
                更新时间
              </th>
              <th data-i18n="table.actions" data-column="actions">操作</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <div class="pager" id="pager" style="display: none">
          <label class="pager__page-size">
            <span data-i18n="perPage.label">每页数量</span>
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
          </label>
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
            </select>
          </div>
          <div class="field grow" id="m-remark-field">
            <label data-i18n="modal.remark.label">备注</label>
            <input
              id="m-remark"
              data-i18n-placeholder="modal.remark.placeholder"
              placeholder="不修改请留空"
            />
          </div>
          <div class="field grow" id="m-photo-field">
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

    <div id="auth-modal" class="modal-mask">
      <div class="modal small">
        <h3 data-i18n="auth.modal.title">授权登录</h3>
        <div class="field" style="margin-top: 12px">
          <label for="auth-password" data-i18n="auth.modal.label">请输入对应用户组密码</label>
          <input
            id="auth-password"
            type="password"
            autocomplete="current-password"
            data-i18n-placeholder="auth.modal.placeholder"
            placeholder="输入密码"
          />
        </div>
        <div class="foot" style="margin-top: 16px">
          <button class="btn ghost" id="auth-cancel" data-i18n="auth.modal.cancel">取消</button>
          <button class="btn" id="auth-confirm" data-i18n="auth.modal.confirm">确认</button>
        </div>
        <div class="muted" id="auth-msg" aria-live="polite"></div>
      </div>
    </div>

    <div id="dn-modal" class="modal-mask">
      <div class="dn-modal">
        <div class="dn-modal__header">
          <h3 data-i18n="dn.title">DN 录入</h3>
          <button class="ghost" id="dn-close" aria-label="关闭">
            ✕
          </button>
        </div>
        <div class="dn-modal__body">
          <textarea
            id="dn-input"
            data-i18n-placeholder="dn.placeholder"
            placeholder="请输入或粘贴 DN 号"
          ></textarea>
          <div id="dn-preview-modal" class="dn-preview" aria-live="polite"></div>
        </div>
        <div class="foot dn-modal__foot">
          <button class="btn ghost" id="dn-cancel" data-i18n="dn.cancel">取消</button>
          <button class="btn" id="dn-confirm" data-i18n="dn.confirm">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { createI18n } from '../i18n/core';
import { applyI18n } from '../i18n/dom';
import { setupDnAdminPage } from './dn-admin/setupDnAdminPage';
import 'viewerjs/dist/viewer.css';
import 'toastify-js/src/toastify.css';
import { useBodyTheme } from '../composables/useBodyTheme';

const adminRoot = ref(null);
const currentLang = ref('zh');
let cleanup = () => {};
let i18nInstance = null;

const STATUS_NOT_EMPTY_VALUE = '__NOT_EMPTY__';

const statusFilterOptions = [
  {
    value: '',
    i18nKey: 'status.filter.any',
    fallback: '任意',
  },
  {
    value: STATUS_NOT_EMPTY_VALUE,
    i18nKey: 'status.filter.notEmpty',
    fallback: '任意非空',
  },
  {
    value: 'ARRIVED AT WH',
    i18nKey: 'status.filter.arrivedAtWh',
    fallback: '到达仓库',
  },
  {
    value: 'TRANSPORTING FROM WH',
    i18nKey: 'status.filter.transportingFromWh',
    fallback: '从仓库发出',
  },
  {
    value: 'ARRIVED AT XD/PM',
    i18nKey: 'status.filter.arrivedAtXdPm',
    fallback: '到达XD/PM',
  },
  {
    value: 'TRANSPORTING FROM XD/PM',
    i18nKey: 'status.filter.transportingFromXdPm',
    fallback: '从XD/PM发出',
  },
  {
    value: 'ARRIVED AT SITE',
    i18nKey: 'status.filter.arrivedAtSite',
    fallback: '到达站点',
  },
];

useBodyTheme('admin-theme');

const applyTranslations = () => {
  if (adminRoot.value && i18nInstance) {
    applyI18n(adminRoot.value, i18nInstance);
  }
};

const changeLang = async (lang) => {
  if (!i18nInstance) return;
  await i18nInstance.setLang(lang);
};

onMounted(async () => {
  i18nInstance = createI18n({
    namespaces: ['dn-admin'],
    fallbackLang: 'en',
    defaultLang: 'zh',
  });
  await i18nInstance.init();
  currentLang.value = i18nInstance.state.lang;
  applyTranslations();
  document.documentElement.setAttribute(
    'lang',
    currentLang.value === 'zh' ? 'zh-CN' : currentLang.value
  );

  cleanup = setupDnAdminPage(adminRoot.value, {
    i18n: i18nInstance,
    applyTranslations,
  });

  i18nInstance.onChange((lang) => {
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
