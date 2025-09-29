<template>
  <div class="admin-page" ref="adminRoot">
    <div class="container admin-container">
      <div class="page-header">
        <LanguageSwitcher v-model="currentLang" @change="changeLang" />
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
            <div class="filters-grid">
              <div class="field filter-field">
                <label data-i18n="planMosDate.label">Plan MOS Date</label>
                <a-select
                  id="f-plan-mos-date"
                  v-model:value="planMosDateSelectValue"
                  :options="planMosDateSelectOptions"
                  :placeholder="planMosDatePlaceholder"
                  :filter-option="filterSelectOption"
                  mode="multiple"
                  max-tag-count="responsive"
                  allow-clear
                  show-search
                  style="width: 100%"
                ></a-select>
              </div>
              <div class="field filter-field">
                <label data-i18n="region.label">Region</label>
                <a-select
                  id="f-region"
                  v-model:value="regionSelectValue"
                  :options="regionSelectOptions"
                  :placeholder="regionSelectPlaceholder"
                  :filter-option="filterSelectOption"
                  mode="multiple"
                  max-tag-count="responsive"
                  allow-clear
                  show-search
                  style="width: 100%"
                ></a-select>
              </div>
              <div class="field filter-field">
                <label data-i18n="lsp.label">LSP</label>
                <a-select
                  id="f-lsp"
                  v-model:value="lspSelectValue"
                  :options="lspSelectOptions"
                  :placeholder="lspSelectPlaceholder"
                  :filter-option="filterSelectOption"
                  mode="multiple"
                  max-tag-count="responsive"
                  allow-clear
                  show-search
                  style="width: 100%"
                ></a-select>
              </div>
              <div class="field filter-field">
                <label data-i18n="subcon.label">分包商</label>
                <a-select
                  id="f-subcon"
                  v-model:value="subconSelectValue"
                  :options="subconSelectOptions"
                  :placeholder="subconSelectPlaceholder"
                  :filter-option="filterSelectOption"
                  mode="multiple"
                  max-tag-count="responsive"
                  allow-clear
                  show-search
                  style="width: 100%"
                ></a-select>
              </div>
              <div class="field filter-field">
                <label data-i18n="status.label">状态</label>
                <a-select
                  id="f-status"
                  v-model:value="statusSelectValue"
                  :options="statusSelectOptions"
                  :placeholder="statusSelectPlaceholder"
                  :filter-option="filterSelectOption"
                  allow-clear
                  show-search
                  style="width: 100%"
                ></a-select>
              </div>
              <div class="field filter-field">
                <label data-i18n="statusWh.label">仓库状态</label>
                <a-select
                  id="f-status-wh"
                  v-model:value="statusWhSelectValue"
                  :options="statusWhSelectOptions"
                  :placeholder="statusWhSelectPlaceholder"
                  :filter-option="filterSelectOption"
                  mode="multiple"
                  max-tag-count="responsive"
                  allow-clear
                  show-search
                  style="width: 100%"
                ></a-select>
              </div>
              <div class="field filter-field">
                <label data-i18n="statusDelivery.label">配送状态</label>
                <a-select
                  id="f-status-delivery"
                  v-model:value="statusDeliverySelectValue"
                  :options="statusDeliverySelectOptions"
                  :placeholder="statusDeliverySelectPlaceholder"
                  :filter-option="filterSelectOption"
                  mode="multiple"
                  max-tag-count="responsive"
                  allow-clear
                  show-search
                  style="width: 100%"
                ></a-select>
              </div>
              <div class="field filter-field" style="display: none" aria-hidden="true">
                <label data-i18n="has.label">是否带附件</label>
                <select id="f-has">
                  <option value="" data-i18n="has.any">（不限）</option>
                  <option value="true" data-i18n="has.true">有附件</option>
                  <option value="false" data-i18n="has.false">无附件</option>
                </select>
              </div>
              <div class="field filter-field">
                <label data-i18n="hasCoord.label">经纬度</label>
                <a-select
                  id="f-has-coordinate"
                  v-model:value="hasCoordinateSelectValue"
                  :options="hasCoordinateSelectOptions"
                  :placeholder="hasCoordinateSelectPlaceholder"
                  :filter-option="filterSelectOption"
                  allow-clear
                  show-search
                  style="width: 100%"
                ></a-select>
              </div>
              <div class="field filter-field">
                <label data-i18n="remark.kw.label">备注关键词</label>
                <a-input
                  id="f-remark"
                  v-model:value="remarkInputValue"
                  :placeholder="remarkInputPlaceholder"
                  allow-clear
                  style="width: 100%"
                />
              </div>
              <div class="field filter-field">
                <label data-i18n="du.filter.label">关联 DU ID</label>
                <a-input
                  id="f-du"
                  v-model:value="duInputValue"
                  :placeholder="duInputPlaceholder"
                  allow-clear
                  style="width: 100%"
                />
              </div>
              <div class="field filter-field">
                <label data-i18n="date.from">开始日期</label>
                <a-date-picker
                  id="f-from"
                  v-model:value="fromDateValue"
                  value-format="YYYY-MM-DD"
                  format="YYYY-MM-DD"
                  :presets="datePresets"
                  allow-clear
                  style="width: 100%"
                />
              </div>
              <div class="field filter-field">
                <label data-i18n="date.to">结束日期</label>
                <a-date-picker
                  id="f-to"
                  v-model:value="toDateValue"
                  value-format="YYYY-MM-DD"
                  format="YYYY-MM-DD"
                  :presets="datePresets"
                  allow-clear
                  style="width: 100%"
                />
              </div>
            </div>

            <div class="filter-actions">
              <div class="field" style="gap: 8px">
                <label style="visibility: hidden" data-i18n="actions.label">操作</label>
                <div style="display: flex; gap: 8px; flex-wrap: wrap">
                  <button class="btn" id="btn-search" data-i18n="actions.query">查询</button>
                  <button class="btn" id="btn-reset" data-i18n="actions.reset">重置</button>
                  <div class="status-switch">
                    <Switch
                      id="status-visibility-switch"
                      v-model:checked="showOnlyNonEmptyStatus"
                      size="small"
                      :checked-children="statusSwitchCheckedLabel"
                      :un-checked-children="statusSwitchUncheckedLabel"
                      :default-checked="true"
                    />
                  </div>
                  <button class="btn" id="btn-export-all" data-i18n="actions.exportAll">
                    导出DN
                  </button>
                  <button
                    class="btn"
                    id="btn-export-records"
                    data-i18n="actions.exportRecords"
                  >
                    导出DN更新记录
                  </button>
                  <button class="btn" id="btn-trust-backend-link" data-i18n="actions.trustBackend">
                    信任后台
                  </button>
                  <button
                    class="btn"
                    id="btn-sync-google-sheet"
                    data-i18n="actions.syncGoogleSheet"
                  >
                    更新Google Sheet数据
                  </button>
                  <button
                    class="btn ghost"
                    id="btn-dn-entry"
                    data-i18n="actions.dnEntry"
                  >
                    DN 录入
                  </button>
                  <button
                    class="btn ghost"
                    id="btn-archive-expired-dn"
                    data-i18n="actions.archiveExpiredDn"
                    disabled
                  >
                    归档过期DN
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div id="hint" class="muted" data-i18n="hint.ready">输入条件后点击查询。</div>
        <div id="lsp-summary-card" class="lsp-summary-card" aria-hidden="true"></div>
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
              max="1000"
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
          <div class="field" id="m-status-delivery-field">
            <label data-i18n="modal.statusDelivery.label">配送状态</label>
            <select id="m-status-delivery">
              <option value="" data-i18n="modal.statusDelivery.keep">（不修改）</option>
            </select>
          </div>
          <div class="field grow" id="m-remark-field">
            <label data-i18n="modal.remark.label">备注</label>
              <input
                id="m-remark"
                data-i18n-placeholder="modal.remark.placeholder"
                placeholder="不修改请留空（可选）"
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Switch } from 'ant-design-vue';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { createI18n } from '../i18n/core';
import { applyI18n } from '../i18n/dom';
import { setupAdminPage } from './admin/setupAdminPage';
import { useAdminFilters, STATUS_NOT_EMPTY_VALUE } from './admin/useAdminFilters';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import 'toastify-js/src/toastify.css';
import { useBodyTheme } from '../composables/useBodyTheme';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/id';

dayjs.extend(customParseFormat);

const adminRoot = ref(null);
const currentLang = ref('zh');
let pageCleanup = () => {};
let i18nInstance = null;

const {
  planMosDateSelectOptions,
  planMosDateSelectValue,
  planMosDatePlaceholder,
  planMosDateSelectBridge,
  regionSelectOptions,
  regionSelectValue,
  regionSelectPlaceholder,
  regionSelectBridge,
  lspSelectOptions,
  lspSelectValue,
  lspSelectPlaceholder,
  subconSelectOptions,
  subconSelectValue,
  subconSelectPlaceholder,
  statusWhSelectOptions,
  statusWhSelectValue,
  statusWhSelectPlaceholder,
  statusDeliverySelectOptions,
  statusDeliverySelectValue,
  statusDeliverySelectPlaceholder,
  statusSelectOptions,
  statusSelectValue,
  statusSelectPlaceholder,
  hasCoordinateSelectOptions,
  hasCoordinateSelectValue,
  hasCoordinateSelectPlaceholder,
  remarkInputValue,
  remarkInputPlaceholder,
  duInputValue,
  duInputPlaceholder,
  fromDateValue,
  toDateValue,
  datePresets,
  filterSelectBridges,
  filterInputBridges,
  updatePlaceholders,
  updateStatusSelectOptions,
  updateHasCoordinateSelectOptions,
  refreshDatePresets,
} = useAdminFilters();

useBodyTheme('admin-theme');

const filterSelectOption = (input, option) => {
  const text = `${option?.label ?? option?.value ?? ''}`.toLowerCase();
  return text.includes((input || '').toLowerCase());
};

const showOnlyNonEmptyStatus = ref(true);
let syncingFromStatusSelect = false;
let syncingFromSwitch = false;

const statusSwitchCheckedLabel = computed(() => {
  // ensure reactivity on language change
  currentLang.value;
  return translate('actions.statusSwitch.checked') ?? '仅显示已更新DN';
});

const statusSwitchUncheckedLabel = computed(() => {
  currentLang.value;
  return translate('actions.statusSwitch.unchecked') ?? '显示所有DN';
});

const translate = (key, vars) => {
  if (!i18nInstance) return undefined;
  try {
    return i18nInstance.t(key, vars);
  } catch (err) {
    console.error(err);
    return undefined;
  }
};

const applyTranslations = () => {
  if (adminRoot.value && i18nInstance) {
    applyI18n(adminRoot.value, i18nInstance);
  }
  const translator = (key) => translate(key);
  updatePlaceholders(translator);
  updateStatusSelectOptions(translator);
  updateHasCoordinateSelectOptions(translator);
  refreshDatePresets(translator);
};

const normalizeStatusSelection = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((item) => typeof item === 'string' && item);
  if (typeof raw === 'string' && raw) return [raw];
  return [];
};

watch(
  statusSelectValue,
  (val) => {
    const normalized = normalizeStatusSelection(val);
    const nextChecked =
      normalized.length === 1 && normalized[0] === STATUS_NOT_EMPTY_VALUE;
    if (syncingFromSwitch) {
      syncingFromSwitch = false;
      if (showOnlyNonEmptyStatus.value !== nextChecked) {
        syncingFromStatusSelect = true;
        showOnlyNonEmptyStatus.value = nextChecked;
      }
      return;
    }
    if (showOnlyNonEmptyStatus.value !== nextChecked) {
      syncingFromStatusSelect = true;
      showOnlyNonEmptyStatus.value = nextChecked;
    }
  },
  { deep: true, immediate: true }
);

watch(showOnlyNonEmptyStatus, (checked) => {
  if (syncingFromStatusSelect) {
    syncingFromStatusSelect = false;
    return;
  }
  syncingFromSwitch = true;
  const event = new CustomEvent('admin:status-switch-change', {
    detail: { showOnlyNonEmpty: checked },
  });
  adminRoot.value?.dispatchEvent(event);
});

const updateDayjsLocale = (lang) => {
  const map = { zh: 'zh-cn', id: 'id', en: 'en' };
  dayjs.locale(map[lang] || map.en);
};

const changeLang = async (lang) => {
  if (!i18nInstance || !lang) return;
  await i18nInstance.setLang(lang);
};

onMounted(async () => {
  i18nInstance = createI18n({
    namespaces: ['admin'],
    fallbackLang: 'en',
    defaultLang: 'zh',
  });
  await i18nInstance.init();
  currentLang.value = i18nInstance.state.lang;
  updateDayjsLocale(currentLang.value);
  applyTranslations();
  document.documentElement.setAttribute(
    'lang',
    currentLang.value === 'zh' ? 'zh-CN' : currentLang.value
  );

  pageCleanup = setupAdminPage(adminRoot.value, {
    i18n: i18nInstance,
    applyTranslations,
    planMosDateSelect: planMosDateSelectBridge,
    filterSelects: filterSelectBridges,
    filterInputs: filterInputBridges,
  });

  i18nInstance.onChange((lang) => {
    currentLang.value = lang;
    updateDayjsLocale(lang);
    applyTranslations();
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : lang);
  });
});

onBeforeUnmount(() => {
  pageCleanup?.();
});
</script>


<style src="../assets/css/admin.css"></style>
