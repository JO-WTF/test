<template>
  <div class="admin-page" ref="adminRoot">
    <div class="container admin-container">
      <div class="page-header">
        <LanguageSwitcher v-model="currentLang" @change="changeLang" />
        <div class="auth-area">
          <span id="auth-role-tag" class="role-tag" data-i18n="auth.current"></span>
          <button
            v-if="showMapViewButton"
            type="button"
            class="btn ghost"
            @click="openLspStatsView"
          >
            LSP统计
          </button>
          <button
            v-if="showMapViewButton"
            type="button"
            class="btn ghost"
            @click="openMapView"
          >
            地图视图
          </button>
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
                class="admin-textarea"
                data-i18n-placeholder="dn.placeholder"
                placeholder="示例：&#10;DN123..."
              ></textarea>
            </div>
            <div class="muted" style="margin-top: 6px" data-i18n="dn.tip">
              提示：DN 号支持字母数字与短横线。
            </div>
          </div>

          <div class="rhs">
            <div class="filters-grid" id="filters-grid" :class="{ collapsed: !showFilters }" :aria-hidden="String(!showFilters)">
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
                <label>Area</label>
                <a-select
                  id="f-area"
                  v-model:value="areaSelectValue"
                  :options="areaSelectOptions"
                  :placeholder="areaSelectPlaceholder"
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
                <label data-i18n="statusDelivery.label">配送状态</label>
                <a-select
                  id="f-status-delivery"
                  v-model:value="statusDeliverySelectValue"
                  :options="statusDeliverySelectOptions"
                  :placeholder="statusDeliverySelectPlaceholder"
                  :filter-option="filterSelectOption"
                  allow-clear
                  show-search
                  style="width: 100%"
                ></a-select>
              </div>
              <div class="field filter-field">
                <label data-i18n="statusSiteLabel">站点状态</label>
                <a-select
                  id="f-status-site"
                  v-model:value="statusSiteSelectValue"
                  :options="statusSiteSelectOptions"
                  :placeholder="statusSiteSelectPlaceholder"
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
                <label data-i18n="date.from">最近修改于(开始)</label>
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
                <label data-i18n="date.to">最近修改于(结束)</label>
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
                  <button
                    class="btn"
                    id="btn-reset"
                    data-i18n="actions.reset"
                    @click="handleResetClick"
                  >
                    重置
                  </button>
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
            <button
              type="button"
              id="filters-toggle"
              class="filters-toggle-btn"
              aria-controls="filters-grid"
              :aria-expanded="String(!!showFilters)"
              @click.prevent="showFilters = !showFilters"
            >
              {{ showFilters ? translate('filters.toggle.hide') || '隐藏筛选器' : translate('filters.toggle.show') || '显示筛选器' }}
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div
          id="lsp-summary-card-wrapper"
          class="lsp-summary-card-section"
          style="display: none"
          role="group"
          aria-hidden="true"
        >
          <div id="lsp-summary-card-container" class="lsp-summary-card-container"></div>
        </div>
        <div class="table-toggle-row">
          <div class="status-switch">
            <label class="status-switch__label" for="status-visibility-switch">
              <span>{{ statusSwitchLabel }}</span>
              <Switch
                id="status-visibility-switch"
                v-model:checked="showOnlyNonEmptyStatus"
                size="small"
                :default-checked="false"
              />
            </label>
          </div>
          <div class="status-switch">
            <label class="status-switch__label" for="show-missing-dn-switch">
              <span>{{ showMissingInGsLabel }}</span>
              <Switch
                id="show-missing-dn-switch"
                v-model:checked="showMissingInGs"
                size="small"
              />
            </label>
          </div>
        </div>
        <div id="hint" class="muted" data-i18n="hint.ready">输入条件后点击查询。</div>
        <a-table
          class="admin-table"
          :data-source="tableRows"
          :columns="tableColumns"
          :loading="tableLoading"
          :pagination="tablePaginationConfig"
          :row-key="resolveRowKey"
          :row-class-name="resolveRowClassName"
          v-model:expandedRowKeys="expandedRowKeys"
          :expandable="tableExpandableConfig"
          bordered
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'dn'">
              <div class="summary-cell">
                <button
                  type="button"
                  class="summary-primary"
                  :data-dn-number="record.dnNumber"
                  @click="copyDnNumber(record)"
                >
                  {{ record.dnNumber || '-' }}
                </button>
                <div class="summary-hint summary-du-id">
                  <template v-if="record.duId">
                    <button
                      type="button"
                      class="summary-du-id-value"
                      :data-du-id="record.duId"
                      :title="record.duId"
                      @click="copyDuId(record)"
                    >
                      {{ record.duId }}
                    </button>
                  </template>
                  <span v-else class="muted">-</span>
                </div>
              </div>
            </template>
            <template v-else-if="column.key === 'regionPlan'">
              <div class="region-plan-cell">
                <span class="region-plan-cell__region">{{ record.region || '-' }}</span>
                <span class="region-plan-cell__plan">{{ record.planMosDate || '-' }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'lsp'">
              <span class="summary-lsp-text">{{ record.lsp || '-' }}</span>
            </template>
            <template v-else-if="column.key === 'statusDelivery'">
              <div class="status-cell-wrapper">
                <span class="status-text">{{ record.statusDeliveryDisplay || '-' }}</span>
                <template v-if="record.statusMismatch">
                  <Tooltip :title="record.statusMismatchTooltip">
                    <span class="status-mismatch" role="img" aria-hidden="false">!</span>
                  </Tooltip>
                </template>
              </div>
            </template>
            <template v-else-if="column.key === 'statusSite'">
              <span>{{ record.statusSiteDisplay || '-' }}</span>
            </template>
            <template v-else-if="column.key === 'remark'">
              <!-- Inject data-label so CSS can display column name via ::before on mobile -->
              <span
                class="summary-remark-text"
                :data-label="translate('table.remark', '备注') || '备注'"
              >
                {{ record.remark || '-' }}
              </span>
            </template>
            <template v-else-if="column.key === 'latestRecordCreatedAt'">
              <div class="latest-record-wrapper">
                <!-- add data-label so mobile pseudo-element can show the column name inline -->
                <span
                  class="latest-record-text"
                  :data-label="translate('table.latestRecordCreatedAt', '更新时间') || '更新时间'"
                >
                  {{ record.latestRecordCreatedAt || '-' }}
                </span>
                <template v-if="record.hasUpdateBadge">
                  <button
                    type="button"
                    class="update-count-badge"
                    :data-dn-number="record.dnNumber"
                    @click.stop.prevent="handleViewHistory(record)"
                    title="显示更新记录"
                  >
                    {{ record.updateCount }}
                  </button>
                </template>
              </div>
            </template>
            <template v-else-if="column.key === 'checkin'">
              <div class="checkin-cell">
                <template v-if="record.hasPhoto">
                  <Tooltip :title="translate('table.photoIconLabel') || 'View photo'">
                    <button
                      type="button"
                      class="icon-link view-link"
                      v-html="iconMarkup.photo"
                      @click="handleOpenPhoto(record)"
                    ></button>
                  </Tooltip>
                </template>
                <template v-if="record.hasLocation">
                  <Tooltip :title="translate('table.mapIconLabel') || 'Open in Google Maps'">
                    <a
                      :href="record.mapUrl"
                      class="icon-link map-link"
                      target="_blank"
                      rel="noopener"
                      v-html="iconMarkup.map"
                    ></a>
                  </Tooltip>
                </template>
                <span v-if="!record.hasPhoto && !record.hasLocation" class="muted">-</span>
              </div>
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="actions">
                <template v-if="canEdit">
                  <button type="button" class="icon-btn" @click="handleEditRecord(record)">
                    <span v-html="iconMarkup.edit"></span>
                  </button>
                </template>
                <template v-if="canDelete">
                  <button
                    type="button"
                    class="icon-btn danger"
                    @click="handleDeleteRecord(record)"
                  >
                    <span v-html="iconMarkup.delete"></span>
                  </button>
                </template>
                <span v-if="!canEdit && !canDelete" class="muted">-</span>
              </div>
            </template>
          </template>
          <template #expandedRowRender="{ record }">
            <div class="detail-row">
              <div class="detail-content">
                <div class="detail-title">{{ detailTitle }}</div>
                <div v-if="!record.detailEntries.length" class="muted">
                  {{ detailEmpty }}
                </div>
                <div v-else class="detail-grid">
                  <div
                    v-for="entry in record.detailEntries"
                    :key="entry.key"
                    class="detail-item"
                  >
                    <div class="detail-key">{{ entry.key }}</div>
                    <div class="detail-value">
                      <template v-if="entry.type === 'link'">
                        <a :href="entry.href" target="_blank" rel="noopener">{{ entry.display }}</a>
                      </template>
                      <template v-else-if="entry.type === 'json'">
                        <pre class="detail-json">{{ entry.display }}</pre>
                      </template>
                      <template v-else>
                        {{ entry.display }}
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
  </a-table>
      </div>
    </div>

    <a-modal
      v-model:open="editModalOpen"
      :footer="null"
      :closable="false"
      :maskClosable="true"
      :force-render="true"
      :centered="true"
      width="600px"
      wrap-class-name="admin-modal-wrap admin-edit-modal-wrap"
    >
      <div class="modal edit-modal">
        <h3>
          <span data-i18n="modal.title">编辑记录</span>
          <span id="modal-id" class="tag"></span>
        </h3>
        <div class="row-line">
          <div class="field">
            <label data-i18n="modal.status_delivery.label">配送状态</label>
            <select id="m-status-delivery">
              <option value="" data-i18n="modal.status_delivery.keep">（不修改）</option>
            </select>
          </div>
          <div class="field" id="m-status-site-field">
            <label data-i18n="modal.status_site.label">站点状态</label>
            <select id="m-status-site">
              <option value="" data-i18n="modal.status_site.keep">（不修改）</option>
            </select>
          </div>
          <div class="field grow" id="m-remark-field">
            <label data-i18n="modal.remark.label">备注</label>
            <textarea
              id="m-remark"
              rows="4"
              class="admin-textarea"
              data-i18n-placeholder="modal.remark.placeholder"
              placeholder="不修改请留空（可选）"
            ></textarea>
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
    </a-modal>

    <a-modal
      v-model:open="authModalOpen"
      :footer="null"
      :closable="false"
      :maskClosable="true"
      :force-render="true"
      :centered="true"
      width="400px"
      wrap-class-name="admin-modal-wrap admin-auth-modal-wrap"
    >
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
    </a-modal>

    <a-modal
      v-model:open="dnModalOpen"
      :footer="null"
      :closable="false"
      :maskClosable="true"
      :force-render="true"
      :centered="true"
      width="800px"
      wrap-class-name="admin-modal-wrap admin-dn-modal-wrap"
    >
      <div class="dn-modal">
        <div class="dn-modal__header">
          <h3 data-i18n="dn.title">DN 录入</h3>
        </div>
        <div class="dn-modal__body">
          <textarea
            id="dn-input"
            class="admin-textarea"
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
    </a-modal>

    <a-modal
      v-model:open="updateHistoryModalOpen"
      :footer="null"
      :closable="false"
      :maskClosable="true"
      :force-render="true"
      :centered="true"
      width="1000px"
      wrap-class-name="admin-modal-wrap admin-history-modal-wrap"
    >
      <div class="modal large">
        <div class="modal-header">
          <h3>
            <span data-i18n="updateHistory.title">DN 更新记录</span>
            <span id="history-dn-number" class="tag"></span>
          </h3>
        </div>
        <div id="history-content" class="modal-body">
          <div class="loading-state" data-i18n="updateHistory.loading">加载中...</div>
        </div>
        <div class="foot">
          <button class="btn" id="history-ok" data-i18n="updateHistory.close">关闭</button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { Switch, Tooltip } from 'ant-design-vue';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useRouter } from 'vue-router';
import { createI18n } from '../i18n/core';
import { applyI18n } from '../i18n/dom';
import { setupAdminPage } from './admin/setupAdminPage';
import { useAdminFilters } from './admin/useAdminFilters';
import {
  TRANSPORT_MANAGER_ROLE_KEY,
  STATUS_DELIVERY_VALUES,
  STATUS_DELIVERY_MISMATCH_TOOLTIP_FALLBACK,
  DN_DETAIL_KEYS,
  SUMMARY_FIELD_KEYS,
  HIDDEN_DETAIL_FIELDS,
  LSP_FIELD,
  REGION_FIELD,
  PLAN_MOS_DATE_FIELD,
  STATUS_SITE_FIELD,
  LATEST_RECORD_CREATED_AT_FIELD,
  LAT_FIELD,
  LNG_FIELD,
  PHOTO_FIELD,
  ICON_MARKUP,
} from './admin/constants';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import 'toastify-js/src/toastify.css';
import { useBodyTheme } from '../composables/useBodyTheme';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/id';
import { normalizeTextValue, showToast, isTimestampKey } from './admin/utils.js';

dayjs.extend(customParseFormat);

const adminRoot = ref(null);
const currentLang = ref('zh');
const currentRoleKey = ref('');
const router = useRouter();
const showMapViewButton = computed(
  () => currentRoleKey.value === TRANSPORT_MANAGER_ROLE_KEY
);
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
  areaSelectOptions,
  areaSelectValue,
  areaSelectPlaceholder,
  lspSelectOptions,
  lspSelectValue,
  lspSelectPlaceholder,
  subconSelectOptions,
  subconSelectValue,
  subconSelectPlaceholder,
  statusSiteSelectOptions,
  statusSiteSelectValue,
  statusSiteSelectPlaceholder,
  statusDeliverySelectOptions,
  statusDeliverySelectValue: statusDeliverySelectValue,
  statusDeliverySelectPlaceholder,
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

const tableLoading = ref(false);
const rawTableItems = ref([]);
const tablePaginationState = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
});
const expandedRowKeys = ref([]);
const transportManagerMode = ref(false);
const currentPermissionsState = ref({});
const normalizeStatusFn = shallowRef((value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  try {
    return String(value || '').trim();
  } catch (err) {
    console.error(err);
  }
  return '';
});
const statusDisplayFn = shallowRef((value) => {
  if (value === null || value === undefined) return '';
  try {
    return String(value);
  } catch (err) {
    console.error(err);
  }
  return '';
});
const toAbsUrlFn = shallowRef((value) => (value ? String(value) : ''));
const formatTimestampFn = shallowRef((value) => (value ? String(value) : ''));
const translationVersion = ref(0);

const actionHandlers = reactive({
  onEdit: null,
  onDelete: null,
  onViewHistory: null,
  onOpenPhoto: null,
});

const paginationHandlers = reactive({
  onPageChange: null,
});

const iconMarkup = ICON_MARKUP;

const defaultNormalizeStatus = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  try {
    return String(value || '').trim();
  } catch (err) {
    console.error(err);
    return '';
  }
};

const getRowKey = (item, index) => {
  if (item && typeof item === 'object') {
    if (item.id !== undefined && item.id !== null) return `id:${item.id}`;
    if (item.dn_id !== undefined && item.dn_id !== null) return `dnid:${item.dn_id}`;
    if (item.uuid) return `uuid:${item.uuid}`;
    if (item.dn_number) return `dn:${item.dn_number}`;
  }
  return `idx:${index}`;
};

const getLspDisplay = (item) => {
  const raw = normalizeTextValue(item?.[LSP_FIELD] ?? item?.lsp);
  if (!raw) return '';
  const match = raw.match(/HTM\.\s*(.*?)\s*-IDN/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return raw;
};

const getLspAbbreviation = (lspName) => {
  if (!lspName) return '';
  const map = {
    'HTM.SCHENKER-IDN': 'SCK',
    'HTM.KAMADJAJA-IDN': 'KAMA',
    'HTM.XPRESINDO-IDN': 'XP',
    'HTM.SINOTRANS-IDN': 'SINO',
  };
  return map[lspName] || lspName;
};

const formatPlanMosDateForMobile = (dateString) => {
  if (!dateString) return '';
  try {
    const ddMmmYyMatch = dateString.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+\d{2}$/);
    if (ddMmmYyMatch) {
      return `${ddMmmYyMatch[2]} ${ddMmmYyMatch[1]}`;
    }
    const isoMatch = dateString.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const month = parseInt(isoMatch[1], 10);
      const day = parseInt(isoMatch[2], 10);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[month - 1]} ${day}`;
    }
    const usMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/\d{4}$/);
    if (usMatch) {
      const month = parseInt(usMatch[1], 10);
      const day = parseInt(usMatch[2], 10);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[month - 1]} ${day}`;
    }
    if (dateString.match(/^[A-Za-z]{3}\s+\d{1,2}$/)) {
      return dateString;
    }
    return dateString;
  } catch (err) {
    console.error('Error formatting date for mobile:', err);
    return dateString;
  }
};

const createGoogleMapsLink = (lat, lng) =>
  `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;

const createGoogleMapsLinkFromString = (value) => {
  if (!value) return '';
  const parts = String(value).split(',');
  if (parts.length >= 2) {
    const lng = parts[0].trim();
    const lat = parts[1].trim();
    return createGoogleMapsLink(lat, lng);
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(value)}`;
};

const collectDetailEntries = (item) => {
  if (!item || typeof item !== 'object') return [];

  const latValue = item?.lat ?? item?.latitude;
  const lngValue = item?.lng ?? item?.longitude;
  const hasCoordinates =
    latValue !== undefined &&
    latValue !== null &&
    lngValue !== undefined &&
    lngValue !== null;

  const itemWithLonlat = { ...item };
  if (hasCoordinates && !itemWithLonlat.lonlat) {
    itemWithLonlat.lonlat = `${lngValue},${latValue}`;
  }

  const entries = [];
  DN_DETAIL_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(itemWithLonlat, key)) return;
    const value = itemWithLonlat[key];
    if (value === undefined || value === null || value === '') return;
    entries.push([key, value]);
  });
  return entries;
};

const formatDetailEntry = (key, value) => {
  const entry = {
    key: String(key),
    type: 'text',
    display: '',
  };
  if (value === undefined || value === null || value === '') {
    entry.display = '-';
    return entry;
  }
  if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof Date))) {
    entry.type = 'json';
    try {
      entry.display = JSON.stringify(value, null, 2);
    } catch (err) {
      console.error(err);
      entry.display = String(value);
    }
    return entry;
  }
  const text = normalizeTextValue(value);
  if (!text) {
    entry.display = '-';
    return entry;
  }
  const lowerKey = entry.key.toLowerCase();
  if (isTimestampKey(lowerKey)) {
    const formatted = formatTimestampFn.value(text);
    entry.display = formatted || text;
    return entry;
  }
  if (/(photo|image|picture|attachment)/.test(lowerKey) || /url/.test(lowerKey)) {
    const href = toAbsUrlFn.value(text);
    entry.type = 'link';
    entry.href = href;
    entry.display = href;
    return entry;
  }
  if (lowerKey.includes('lonlat')) {
    const href = createGoogleMapsLinkFromString(text);
    entry.type = 'link';
    entry.href = href;
    entry.display = href;
    return entry;
  }
  entry.display = text;
  return entry;
};

const shouldShowStatusDeliveryMismatch = (statusSiteRaw, statusDeliveryRaw, normalize) => {
  const normalizeFn = typeof normalize === 'function' ? normalize : defaultNormalizeStatus;
  const site = normalizeFn(statusSiteRaw);
  const statusDelivery = normalizeFn(statusDeliveryRaw);
  if (!site) return false;

  const arrivedStatusDelivery = normalizeFn(STATUS_DELIVERY_VALUES.ARRIVED_AT_SITE);
  const podStatusDelivery = normalizeFn(STATUS_DELIVERY_VALUES.POD || 'POD');

  if (site === STATUS_DELIVERY_VALUES.ON_THE_WAY) {
    const allowedTransportStatusDelivery = [
      STATUS_DELIVERY_VALUES.DEPARTED_FROM_WH,
      STATUS_DELIVERY_VALUES.TRANSPORTING_FROM_XD_PM,
    ]
      .map((value) => normalizeFn(value))
      .filter(Boolean);
    const isAllowed = allowedTransportStatusDelivery.includes(statusDelivery);
    return !isAllowed;
  }
  if (site === STATUS_DELIVERY_VALUES.ON_SITE) {
    return statusDelivery !== arrivedStatusDelivery && statusDelivery !== podStatusDelivery;
  }
  if (site === STATUS_DELIVERY_VALUES.POD) {
    return statusDelivery !== podStatusDelivery && statusDelivery !== arrivedStatusDelivery;
  }
  return false;
};

const tablePaginationConfig = computed(() => ({
  current: tablePaginationState.current,
  pageSize: tablePaginationState.pageSize,
  total: tablePaginationState.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100', '200'],
  showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}`,
}));

const tableExpandableConfig = computed(() => ({
  expandRowByClick: true,
  rowExpandable: (record) => Boolean(record?.hasDetails),
}));

const adminTableBridge = {
  setLoading(value) {
    tableLoading.value = !!value;
  },
  setItems(items, meta = {}) {
    rawTableItems.value = Array.isArray(items) ? items : [];
    const total = Number(meta.total ?? rawTableItems.value.length);
    tablePaginationState.total = Number.isFinite(total) && total >= 0 ? total : rawTableItems.value.length;
    const nextPage = Number(meta.page ?? tablePaginationState.current);
    tablePaginationState.current = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1;
    const nextSize = Number(meta.pageSize ?? tablePaginationState.pageSize);
    tablePaginationState.pageSize =
      Number.isFinite(nextSize) && nextSize > 0 ? nextSize : tablePaginationState.pageSize;
    expandedRowKeys.value = [];
  },
  setTransportManager(value) {
    transportManagerMode.value = !!value;
  },
  setPermissions(perms) {
    currentPermissionsState.value = perms || {};
  },
  setNormalizeStatusDelivery(fn) {
    normalizeStatusFn.value = typeof fn === 'function' ? fn : defaultNormalizeStatus;
    translationVersion.value += 1;
  },
  setStatusDisplay(fn) {
    statusDisplayFn.value = typeof fn === 'function' ? fn : ((value) => (value === null || value === undefined ? '' : String(value)));
    translationVersion.value += 1;
  },
  setUtilities({ toAbsUrl, formatTimestampToJakarta } = {}) {
    toAbsUrlFn.value = typeof toAbsUrl === 'function' ? toAbsUrl : (value) => (value ? String(value) : '');
    formatTimestampFn.value =
      typeof formatTimestampToJakarta === 'function'
        ? formatTimestampToJakarta
        : (value) => (value ? String(value) : '');
    translationVersion.value += 1;
  },
  notifyTranslations() {
    translationVersion.value += 1;
  },
  registerActionHandlers(handlers = {}) {
    if (typeof handlers.onEdit === 'function') actionHandlers.onEdit = handlers.onEdit;
    if (typeof handlers.onDelete === 'function') actionHandlers.onDelete = handlers.onDelete;
    if (typeof handlers.onViewHistory === 'function') actionHandlers.onViewHistory = handlers.onViewHistory;
    if (typeof handlers.onOpenPhoto === 'function') actionHandlers.onOpenPhoto = handlers.onOpenPhoto;
  },
  registerPaginationHandlers(handlers = {}) {
    if (typeof handlers.onPageChange === 'function') {
      paginationHandlers.onPageChange = handlers.onPageChange;
    }
  },
  clear() {
    rawTableItems.value = [];
    tablePaginationState.total = 0;
    expandedRowKeys.value = [];
  },
};

const handleTableChange = (paginationInfo) => {
  const nextPage = Number(paginationInfo?.current) || tablePaginationState.current;
  const nextPageSize = Number(paginationInfo?.pageSize) || tablePaginationState.pageSize;
  tablePaginationState.current = nextPage;
  tablePaginationState.pageSize = nextPageSize;
  if (paginationHandlers.onPageChange) {
    paginationHandlers.onPageChange(nextPage, nextPageSize);
  }
};

const resolveRowKey = (record) => record?.rowKey || record?.key;

const resolveRowClassName = (record, index) => {
  if (!record) return '';
  const key = record.rowKey || record.key || getRowKey(record.original, index);
  const classes = ['summary-row'];
  if (record.hasDetails) {
    classes.push('expandable');
  }
  if (record.statusMismatch) {
    classes.push('status-mismatch-row');
  }
  if (expandedRowKeys.value.includes(key)) {
    classes.push('expanded');
  }
  return classes.join(' ');
};

const copyTextToClipboard = async (text) => {
  const value = typeof text === 'string' ? text : String(text || '');
  if (!value) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (err) {
      console.error('Clipboard API copy failed', err);
    }
  }

  if (typeof document === 'undefined' || !document.body) {
    return false;
  }

  let textarea = null;
  try {
    textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);

    const selection = document.getSelection();
    const originalRange =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

    textarea.select();
    const copied = document.execCommand('copy');

    if (selection) {
      selection.removeAllRanges();
      if (originalRange) {
        selection.addRange(originalRange);
      }
    }
    return copied;
  } catch (err) {
    console.error('Fallback clipboard copy failed', err);
    return false;
  } finally {
    if (textarea && textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }
  }
};

const copyDnNumber = async (record) => {
  if (!record?.dnNumber) return;
  const copied = await copyTextToClipboard(record.dnNumber);
  const successMsg = translate('toast.copyDnSuccess', '已复制 DN Number') || '已复制 DN Number';
  const failMsg = translate('toast.copyDnFail', '复制 DN Number 失败') || '复制 DN Number 失败';
  showToast(copied ? successMsg : failMsg, copied ? 'success' : 'error');
};

const copyDuId = async (record) => {
  if (!record?.duId) return;
  const copied = await copyTextToClipboard(record.duId);
  const successMsg = translate('toast.copyDuIdSuccess', '已复制 DU ID') || '已复制 DU ID';
  const failMsg = translate('toast.copyDuIdFail', '复制 DU ID 失败') || '复制 DU ID 失败';
  showToast(copied ? successMsg : failMsg, copied ? 'success' : 'error');
};

const handleEditRecord = (record) => {
  if (typeof actionHandlers.onEdit === 'function' && record?.original) {
    actionHandlers.onEdit(record.original);
  }
};

const handleDeleteRecord = (record) => {
  if (typeof actionHandlers.onDelete === 'function' && record?.original) {
    actionHandlers.onDelete(record.original);
  }
};

const handleViewHistory = (record) => {
  if (typeof actionHandlers.onViewHistory === 'function' && record?.dnNumber) {
    actionHandlers.onViewHistory(record.dnNumber);
  }
};

const handleOpenPhoto = (record) => {
  if (typeof actionHandlers.onOpenPhoto === 'function' && record?.absolutePhotoUrl) {
    actionHandlers.onOpenPhoto(record.absolutePhotoUrl);
  }
};

const tableRows = computed(() => {
  translationVersion.value;
  const mismatchTooltip = translate('table.statusMismatchTooltip') || STATUS_DELIVERY_MISMATCH_TOOLTIP_FALLBACK;
  const normalize = normalizeStatusFn.value || defaultNormalizeStatus;
  const statusDisplay = statusDisplayFn.value || ((val) => (val === null || val === undefined ? '' : String(val)));
  return rawTableItems.value.map((item, index) => {
    const rowKey = getRowKey(item, index);
    const dnNumber = normalizeTextValue(item?.dn_number ?? item?.dnNumber);
    const duId = normalizeTextValue(item?.du_id);
    const region = normalizeTextValue(item?.[REGION_FIELD] ?? item?.region);
    const planMos = normalizeTextValue(item?.[PLAN_MOS_DATE_FIELD] ?? item?.plan_mos_date);
    const lsp = getLspDisplay(item);
    const statusDeliveryRaw = item?.status_delivery ?? item?.status ?? '';
    const statusDeliveryDisplay =
      statusDisplay(statusDeliveryRaw) || statusDisplay(normalize(statusDeliveryRaw));
    const statusSiteRaw = item?.[STATUS_SITE_FIELD] ?? item?.status_site ?? item?.statusSite ?? '';
    const statusSiteDisplay = normalizeTextValue(statusSiteRaw);
    const remark = normalizeTextValue(item?.remark);
    const latestRecordRaw = normalizeTextValue(
      item?.[LATEST_RECORD_CREATED_AT_FIELD] ?? item?.latest_record_created_at
    );
    // Use the project's formatter (may include date and time separated by newline).
    // Take the first line as the short date display.
    const latestRecordFormatted = (function (raw) {
      try {
        const formatted = formatTimestampFn.value(raw || '');
        if (!formatted) return raw || '';
        // Normalize formatter output: replace newline with space
        let s = String(formatted).replace(/\r?\n/, ' ').trim();
        // Convert "DD MMM" -> "DD-MMM" (e.g. "5 Oct" -> "5-Oct") so final becomes "DD-MMM HH:MM:SS"
        s = s.replace(/(\b\d{1,2})\s+([A-Za-z]{3}\b)/, '$1-$2');
        return s;
      } catch (err) {
        return raw || '';
      }
    })(latestRecordRaw);
    const photoRaw = item?.[PHOTO_FIELD] ?? item?.photo_url;
    const photoUrl = normalizeTextValue(photoRaw);
    const lat = normalizeTextValue(item?.[LAT_FIELD] ?? item?.lat ?? item?.latitude);
    const lng = normalizeTextValue(item?.[LNG_FIELD] ?? item?.lng ?? item?.longitude);
    const mapUrl = lat && lng ? createGoogleMapsLink(lat, lng) : '';
    const detailEntries = collectDetailEntries(item)
      .filter(([key]) => !HIDDEN_DETAIL_FIELDS.has(String(key)))
      .map(([key, value]) => formatDetailEntry(key, value));
    const hasDetails =
      detailEntries.length > 0 &&
      detailEntries.some((entry) => !SUMMARY_FIELD_KEYS.has(String(entry.key)));
    const updateCount = Number(item?.update_count) || 0;
    const hasUpdateBadge = transportManagerMode.value && updateCount > 0;

    return {
      key: rowKey,
      rowKey,
      dnNumber,
      duId,
      region,
      planMosDate: planMos,
      planMosDateMobile: formatPlanMosDateForMobile(planMos),
      lsp,
      lspAbbrev: getLspAbbreviation(item?.[LSP_FIELD] ?? item?.lsp),
      statusDeliveryDisplay,
      statusDeliveryRaw,
      statusSiteDisplay,
  remark,
  latestRecordCreatedAt: latestRecordFormatted,
      statusMismatch: shouldShowStatusDeliveryMismatch(statusSiteRaw, statusDeliveryRaw, normalize),
      statusMismatchTooltip: mismatchTooltip,
      hasPhoto: Boolean(photoUrl),
      photoUrl,
      absolutePhotoUrl: photoUrl ? toAbsUrlFn.value(photoUrl) : '',
      hasLocation: Boolean(mapUrl),
      mapUrl,
      detailEntries,
      hasDetails,
      updateCount,
      hasUpdateBadge,
      original: item,
    };
  });
});

const showActionColumn = computed(() => {
  const perms = currentPermissionsState.value || {};
  return Boolean(perms.canEdit || perms.canDelete);
});

const canEdit = computed(() => Boolean(currentPermissionsState.value?.canEdit));
const canDelete = computed(() => Boolean(currentPermissionsState.value?.canDelete));

const tableColumns = computed(() => {
  translationVersion.value;
  const columns = [
    {
      title: translate('table.dn', 'DN 号') || 'DN 号',
      dataIndex: 'dnNumber',
      key: 'dn',
      width: 150,
    },
    {
      title: translate('table.regionPlan', '区域/MOS 计划') || '区域/MOS 计划',
      dataIndex: 'region',
      key: 'regionPlan',
      width: 120,
    },
    {
      title: translate('table.lsp', 'LSP') || 'LSP',
      dataIndex: 'lsp',
      key: 'lsp',
      width: 100,
    },
    {
      title: translate('table.statusDelivery', '配送状态') || '配送状态',
      dataIndex: 'statusDeliveryDisplay',
      key: 'statusDelivery',
      width: 100,
    },
    {
      title: translate('table.statusSite', '站点状态') || '站点状态',
      dataIndex: 'statusSiteDisplay',
      key: 'statusSite',
      width: 100,
    },
    {
      title: translate('table.remark', '备注') || '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 220,
    },
    {
      title: translate('table.latestRecordCreatedAt', '更新时间') || '更新时间',
      dataIndex: 'latestRecordCreatedAt',
      key: 'latestRecordCreatedAt',
      width: 60,
    },
    {
      title: translate('table.checkin', '打卡') || '打卡',
      dataIndex: 'checkin',
      key: 'checkin',
      className: 'col-checkin',
      width: 60,
      align: 'center',
    },
  ];
  if (showActionColumn.value) {
    columns.push({
      title: translate('table.actions', '操作') || '操作',
      dataIndex: 'actions',
      key: 'actions',
      className: 'col-actions',
      width: 60,
      align: 'center',
    });
  }
  return columns;
});

const detailTitle = computed(() => translate('details.title', '全部字段') || '全部字段');
const detailEmpty = computed(() => translate('details.empty', '暂无更多字段。') || '暂无更多字段。');

const openMapView = () => {
  const resolved = router.resolve({ name: 'map' });
  const href = resolved?.href || resolved?.fullPath || '/map';
  if (typeof window !== 'undefined') {
    window.open(href, '_blank', 'noopener');
  }
};

const openLspStatsView = () => {
  router.push({ name: 'lsp-stats' });
};

const filterSelectOption = (input, option) => {
  const text = `${option?.label ?? option?.value ?? ''}`.toLowerCase();
  return text.includes((input || '').toLowerCase());
};

const showOnlyNonEmptyStatus = ref(false);
const showMissingInGs = ref(false);
  // Controls visibility of the filters grid on small screens (default hidden)
  const showFilters = ref(false);
let syncingFromStatusDeliverySelect = false;
let syncingFromSwitch = false;

const editModalOpen = ref(false);
const authModalOpen = ref(false);
const dnModalOpen = ref(false);
const updateHistoryModalOpen = ref(false);

const modalControllers = {
  edit: {
    open: () => {
      editModalOpen.value = true;
    },
    close: () => {
      editModalOpen.value = false;
    },
    isOpen: () => editModalOpen.value,
  },
  auth: {
    open: () => {
      authModalOpen.value = true;
    },
    close: () => {
      authModalOpen.value = false;
    },
    isOpen: () => authModalOpen.value,
  },
  dn: {
    open: () => {
      dnModalOpen.value = true;
    },
    close: () => {
      dnModalOpen.value = false;
    },
    isOpen: () => dnModalOpen.value,
  },
  updateHistory: {
    open: () => {
      updateHistoryModalOpen.value = true;
    },
    close: () => {
      updateHistoryModalOpen.value = false;
    },
    isOpen: () => updateHistoryModalOpen.value,
  },
};

const statusSwitchCheckedLabel = computed(() => {
  // ensure reactivity on language change
  currentLang.value;
  return translate('actions.statusSwitch.checked') ?? '仅显示已更新DN';
});

const statusSwitchUncheckedLabel = computed(() => {
  currentLang.value;
  return translate('actions.statusSwitch.unchecked') ?? '显示所有DN';
});

const statusSwitchLabel = computed(() =>
  showOnlyNonEmptyStatus.value
    ? statusSwitchCheckedLabel.value
    : statusSwitchUncheckedLabel.value
);

const showMissingInGsLabel = computed(() => {
  currentLang.value;
  return translate('actions.showMissingInGs') ?? '显示 GS 中不存在的 DN';
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
  adminTableBridge.notifyTranslations?.();
};

const normalizeStatusSelection = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((item) => typeof item === 'string' && item);
  if (typeof raw === 'string' && raw) return [raw];
  return [];
};

watch(
  statusDeliverySelectValue,
  (val) => {
    const normalized = normalizeStatusSelection(val);
    const nextChecked =
      normalized.length === 1 && normalized[0] === '__NOT_EMPTY__';
    if (syncingFromSwitch) {
      syncingFromSwitch = false;
      if (showOnlyNonEmptyStatus.value !== nextChecked) {
        syncingFromStatusDeliverySelect = true;
        showOnlyNonEmptyStatus.value = nextChecked;
      }
      return;
    }
    if (showOnlyNonEmptyStatus.value !== nextChecked) {
      syncingFromStatusDeliverySelect = true;
      showOnlyNonEmptyStatus.value = nextChecked;
    }
  },
  { deep: true, immediate: true }
);

watch(showOnlyNonEmptyStatus, (checked) => {
  if (syncingFromStatusDeliverySelect) {
    syncingFromStatusDeliverySelect = false;
    return;
  }
  syncingFromSwitch = true;
  const event = new CustomEvent('admin:status-switch-change', {
    detail: { showOnlyNonEmpty: checked },
  });
  adminRoot.value?.dispatchEvent(event);
});

watch(showMissingInGs, (checked) => {
  const event = new CustomEvent('admin:show-deleted-switch-change', {
    detail: { showDeleted: checked },
  });
  adminRoot.value?.dispatchEvent(event);
});

const handleResetClick = () => {
  if (showMissingInGs.value) {
    showMissingInGs.value = false;
  }
};

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
    namespaces: ['core', 'admin'],
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
    onRoleChange: (roleKey) => {
      currentRoleKey.value = roleKey || '';
    },
    modalControllers,
    tableBridge: adminTableBridge,
  });

  // 列 className 已在 tableColumns 中声明，交由 CSS 控制宽度与省略

  i18nInstance.onChange((lang) => {
    currentLang.value = lang;
    updateDayjsLocale(lang);
    applyTranslations();
    // document.documentElement.lang 现在由 i18n 核心模块自动更新
  });
});

onBeforeUnmount(() => {
  pageCleanup?.();
  adminTableBridge.clear?.();
});
</script>


<style src="../assets/css/admin.css"></style>
<style src="../assets/css/admin-mobile.css"></style>
