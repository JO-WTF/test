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
                  <button class="btn ghost" id="btn-reset" data-i18n="actions.reset">重置</button>
                  <button class="btn ghost" id="btn-show-all" data-i18n="actions.showAll">
                    显示全部 DN
                  </button>
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
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { createI18n } from '../i18n/core';
import { applyI18n } from '../i18n/dom';
import { setupDnAdminPage } from './dn-admin/setupDnAdminPage';
import 'viewerjs/dist/viewer.css';
import 'toastify-js/src/toastify.css';
import { useBodyTheme } from '../composables/useBodyTheme';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/id';

dayjs.extend(customParseFormat);

const adminRoot = ref(null);
const currentLang = ref('zh');
let cleanup = () => {};
let i18nInstance = null;

const DEFAULT_SELECT_PLACEHOLDER = 'Type or select';
const DATE_PICKER_VALUE_FORMAT = 'YYYY-MM-DD';
const DATE_PRESET_DEFS = [
  { key: 'yesterday', offset: -1 },
  { key: 'today', offset: 0 },
  { key: 'tomorrow', offset: 1 },
];
const DATE_PRESET_FALLBACK_LABELS = {
  yesterday: 'Yesterday',
  today: 'Today',
  tomorrow: 'Tomorrow',
};

const filterSelectOption = (input, option) => {
  const text = `${option?.label ?? option?.value ?? ''}`.toLowerCase();
  return text.includes((input || '').toLowerCase());
};

const normalizeSelectValues = (raw) => {
  const queue = Array.isArray(raw)
    ? raw.slice()
    : typeof raw === 'string'
    ? raw.split(/\r?\n/)
    : raw === undefined || raw === null
    ? []
    : [raw];
  const seen = new Set();
  const result = [];
  for (let i = 0; i < queue.length; i += 1) {
    const value = queue[i];
    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }
    if (value === undefined || value === null) continue;
    const str = typeof value === 'string' ? value : String(value);
    str
      .split(',')
      .map((part) => part.trim())
      .forEach((part) => {
        if (!part || seen.has(part)) return;
        seen.add(part);
        result.push(part);
      });
  }
  return result;
};

const selectValuesEqual = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const normalizeSelectOptions = (options) => {
  if (!Array.isArray(options)) return [];
  const seen = new Set();
  const mapped = [];
  options.forEach((option) => {
    if (option === undefined || option === null) return;
    if (typeof option === 'object' && option !== null) {
      const rawValue =
        'value' in option && option.value !== undefined
          ? option.value
          : option.label ?? '';
      const value =
        typeof rawValue === 'string' ? rawValue.trim() : String(rawValue || '').trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      const label =
        'label' in option && option.label !== undefined
          ? String(option.label ?? '').trim() || value
          : value;
      mapped.push({ label, value });
      return;
    }
    const raw = typeof option === 'string' ? option : String(option);
    const value = raw.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    mapped.push({ label: value, value });
  });
  return mapped;
};

const createSelectState = (fallbackPlaceholder = DEFAULT_SELECT_PLACEHOLDER) => {
  const options = ref([]);
  const value = ref([]);
  const placeholder = ref(fallbackPlaceholder);
  const listeners = new Set();

  const setOptions = (next) => {
    options.value = normalizeSelectOptions(next);
  };

  const setValue = (next) => {
    const normalized = normalizeSelectValues(next);
    if (!selectValuesEqual(value.value, normalized)) {
      value.value = normalized;
    }
  };

  watch(
    value,
    (val) => {
      const normalized = normalizeSelectValues(val);
      if (!selectValuesEqual(val, normalized)) {
        value.value = normalized;
        return;
      }
      listeners.forEach((listener) => {
        try {
          listener([...normalized]);
        } catch (err) {
          console.error(err);
        }
      });
    },
    { deep: true }
  );

  return {
    options,
    value,
    placeholder,
    bridge: {
      setOptions,
      setValue,
      getValue() {
        return normalizeSelectValues(value.value);
      },
      onChange(listener) {
        if (typeof listener !== 'function') return () => {};
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  };
};

const createSingleSelectState = (fallbackPlaceholder = DEFAULT_SELECT_PLACEHOLDER) => {
  const options = ref([]);
  const value = ref('');
  const placeholder = ref(fallbackPlaceholder);
  const listeners = new Set();

  const normalizeOptions = (source) => {
    if (!Array.isArray(source)) return [];
    const seen = new Set();
    const normalized = [];
    source.forEach((option) => {
      if (option === undefined || option === null) return;
      if (typeof option === 'object' && option !== null) {
        const rawValue =
          Object.prototype.hasOwnProperty.call(option, 'value') && option.value !== undefined
            ? option.value
            : option.label ?? '';
        const rawLabel =
          Object.prototype.hasOwnProperty.call(option, 'label') && option.label !== undefined
            ? option.label
            : rawValue;
        const valueStr =
          rawValue === undefined || rawValue === null
            ? ''
            : typeof rawValue === 'string'
            ? rawValue.trim()
            : String(rawValue).trim();
        const dedupeKey = valueStr;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        const labelStr =
          rawLabel === undefined || rawLabel === null
            ? ''
            : typeof rawLabel === 'string'
            ? rawLabel
            : String(rawLabel);
        normalized.push({
          label: labelStr || valueStr,
          value: valueStr,
        });
        return;
      }
      const raw = typeof option === 'string' ? option : String(option);
      const trimmed = raw.trim();
      if (seen.has(trimmed)) return;
      seen.add(trimmed);
      normalized.push({ label: trimmed || raw, value: trimmed });
    });
    return normalized;
  };

  const toSingleValue = (input) => {
    if (Array.isArray(input)) {
      for (let i = 0; i < input.length; i += 1) {
        const candidate = input[i];
        if (candidate === undefined || candidate === null) continue;
        return typeof candidate === 'string' ? candidate : String(candidate);
      }
      return '';
    }
    if (input === undefined || input === null) return '';
    return typeof input === 'string' ? input : String(input);
  };

  const setOptions = (next) => {
    options.value = normalizeOptions(next);
  };

  const setValue = (next) => {
    const normalized = toSingleValue(next);
    if (value.value !== normalized) {
      value.value = normalized;
    }
  };

  watch(value, (val) => {
    const normalized = toSingleValue(val);
    if (val !== normalized) {
      value.value = normalized;
      return;
    }
    const payload = normalized ? [normalized] : [];
    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error(err);
      }
    });
  });

  return {
    options,
    value,
    placeholder,
    bridge: {
      setOptions,
      setValue,
      getValue() {
        const normalized = toSingleValue(value.value);
        return normalized ? [normalized] : [];
      },
      onChange(listener) {
        if (typeof listener !== 'function') return () => {};
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  };
};

const createTextInputState = (fallbackPlaceholder = '') => {
  const value = ref('');
  const placeholder = ref(fallbackPlaceholder);
  const listeners = new Set();

  const toStringValue = (input) => {
    if (Array.isArray(input)) {
      for (let i = 0; i < input.length; i += 1) {
        const candidate = input[i];
        if (candidate === undefined || candidate === null) continue;
        return typeof candidate === 'string' ? candidate : String(candidate);
      }
      return '';
    }
    if (input === undefined || input === null) return '';
    return typeof input === 'string' ? input : String(input);
  };

  const setValue = (next) => {
    const normalized = toStringValue(next);
    if (value.value !== normalized) {
      value.value = normalized;
    }
  };

  watch(value, (val) => {
    const normalized = toStringValue(val);
    if (val !== normalized) {
      value.value = normalized;
      return;
    }
    listeners.forEach((listener) => {
      try {
        listener(normalized);
      } catch (err) {
        console.error(err);
      }
    });
  });

  return {
    value,
    placeholder,
    bridge: {
      setValue,
      getValue() {
        return toStringValue(value.value);
      },
      onChange(listener) {
        if (typeof listener !== 'function') return () => {};
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  };
};

const normalizeDatePickerValue = (value) => {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const normalized = normalizeDatePickerValue(value[i]);
      if (normalized) return normalized;
    }
    return '';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format(DATE_PICKER_VALUE_FORMAT) : '';
  }
  if (value instanceof Date) {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format(DATE_PICKER_VALUE_FORMAT) : '';
  }
  if (dayjs.isDayjs(value)) {
    return value.isValid() ? value.format(DATE_PICKER_VALUE_FORMAT) : '';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    let parsed = dayjs(trimmed, DATE_PICKER_VALUE_FORMAT, true);
    if (!parsed.isValid()) {
      parsed = dayjs(trimmed);
    }
    return parsed.isValid() ? parsed.format(DATE_PICKER_VALUE_FORMAT) : '';
  }
  try {
    const str = String(value).trim();
    if (!str) return '';
    return normalizeDatePickerValue(str);
  } catch (err) {
    console.error(err);
  }
  return '';
};

const createDatePickerState = () => {
  const value = ref('');
  const listeners = new Set();

  const setValue = (next) => {
    const normalized = normalizeDatePickerValue(next);
    if (value.value !== normalized) {
      value.value = normalized;
    }
  };

  watch(value, (val) => {
    const normalized = normalizeDatePickerValue(val);
    if (val !== normalized) {
      value.value = normalized;
      return;
    }
    listeners.forEach((listener) => {
      try {
        listener(normalized);
      } catch (err) {
        console.error(err);
      }
    });
  });

  return {
    value,
    bridge: {
      setValue,
      getValue() {
        return normalizeDatePickerValue(value.value);
      },
      onChange(listener) {
        if (typeof listener !== 'function') return () => {};
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  };
};

const planMosDateState = createSelectState();
const planMosDateSelectOptions = planMosDateState.options;
const planMosDateSelectValue = planMosDateState.value;
const planMosDatePlaceholder = planMosDateState.placeholder;
const planMosDateSelectBridge = planMosDateState.bridge;

const statusSelectState = createSingleSelectState('Any');
const statusSelectOptions = statusSelectState.options;
const statusSelectValue = statusSelectState.value;
const statusSelectPlaceholder = statusSelectState.placeholder;
const statusSelectBridge = statusSelectState.bridge;

const hasCoordinateSelectState = createSingleSelectState('Any');
const hasCoordinateSelectOptions = hasCoordinateSelectState.options;
const hasCoordinateSelectValue = hasCoordinateSelectState.value;
const hasCoordinateSelectPlaceholder = hasCoordinateSelectState.placeholder;
const hasCoordinateSelectBridge = hasCoordinateSelectState.bridge;

const remarkInputState = createTextInputState('模糊匹配');
const remarkInputValue = remarkInputState.value;
const remarkInputPlaceholder = remarkInputState.placeholder;
const remarkInputBridge = remarkInputState.bridge;

const duInputState = createTextInputState('精确匹配');
const duInputValue = duInputState.value;
const duInputPlaceholder = duInputState.placeholder;
const duInputBridge = duInputState.bridge;

const fromDateState = createDatePickerState();
const fromDateValue = fromDateState.value;
const fromDateBridge = fromDateState.bridge;

const toDateState = createDatePickerState();
const toDateValue = toDateState.value;
const toDateBridge = toDateState.bridge;

const regionSelectState = createSelectState();
const regionSelectOptions = regionSelectState.options;
const regionSelectValue = regionSelectState.value;
const regionSelectPlaceholder = regionSelectState.placeholder;
const regionSelectBridge = regionSelectState.bridge;

const lspSelectState = createSelectState();
const lspSelectOptions = lspSelectState.options;
const lspSelectValue = lspSelectState.value;
const lspSelectPlaceholder = lspSelectState.placeholder;
const lspSelectBridge = lspSelectState.bridge;

const subconSelectState = createSelectState();
const subconSelectOptions = subconSelectState.options;
const subconSelectValue = subconSelectState.value;
const subconSelectPlaceholder = subconSelectState.placeholder;
const subconSelectBridge = subconSelectState.bridge;

const statusWhSelectState = createSelectState();
const statusWhSelectOptions = statusWhSelectState.options;
const statusWhSelectValue = statusWhSelectState.value;
const statusWhSelectPlaceholder = statusWhSelectState.placeholder;
const statusWhSelectBridge = statusWhSelectState.bridge;

const statusDeliverySelectState = createSelectState();
const statusDeliverySelectOptions = statusDeliverySelectState.options;
const statusDeliverySelectValue = statusDeliverySelectState.value;
const statusDeliverySelectPlaceholder = statusDeliverySelectState.placeholder;
const statusDeliverySelectBridge = statusDeliverySelectState.bridge;

const filterSelectBridges = {
  plan_mos_date: planMosDateSelectBridge,
  region: regionSelectBridge,
  lsp: lspSelectBridge,
  subcon: subconSelectBridge,
  status_wh: statusWhSelectBridge,
  status_delivery: statusDeliverySelectBridge,
  status: statusSelectBridge,
  has_coordinate: hasCoordinateSelectBridge,
  date_from: fromDateBridge,
  date_to: toDateBridge,
};

const filterInputBridges = {
  remark: remarkInputBridge,
  du: duInputBridge,
};

const datePresets = ref([]);

const selectPlaceholderConfigs = [
  {
    placeholderRef: planMosDatePlaceholder,
    translationKey: 'planMosDate.placeholder',
  },
  { placeholderRef: regionSelectPlaceholder, translationKey: 'region.placeholder' },
  { placeholderRef: lspSelectPlaceholder, translationKey: 'lsp.placeholder' },
  { placeholderRef: subconSelectPlaceholder, translationKey: 'subcon.placeholder' },
  { placeholderRef: statusWhSelectPlaceholder, translationKey: 'statusWh.placeholder' },
  {
    placeholderRef: statusDeliverySelectPlaceholder,
    translationKey: 'statusDelivery.placeholder',
  },
  {
    placeholderRef: statusSelectPlaceholder,
    translationKey: 'status.filter.any',
    fallback: 'Any',
  },
  {
    placeholderRef: hasCoordinateSelectPlaceholder,
    translationKey: 'hasCoord.any',
    fallback: '（不限）',
  },
];

const inputPlaceholderConfigs = [
  {
    placeholderRef: remarkInputPlaceholder,
    translationKey: 'remark.kw.placeholder',
    fallback: '模糊匹配',
  },
  {
    placeholderRef: duInputPlaceholder,
    translationKey: 'du.filter.placeholder',
    fallback: '精确匹配',
  },
];

const updateSelectPlaceholder = (
  placeholderRef,
  translationKey,
  fallback = DEFAULT_SELECT_PLACEHOLDER
) => {
  if (!placeholderRef) return;
  if (!i18nInstance) {
    placeholderRef.value = fallback;
    return;
  }
  try {
    const translated = i18nInstance.t(translationKey);
    placeholderRef.value =
      translated && translated !== translationKey ? translated : fallback;
  } catch (err) {
    console.error(err);
    placeholderRef.value = fallback;
  }
};

const updateAllSelectPlaceholders = () => {
  selectPlaceholderConfigs.forEach(({ placeholderRef, translationKey, fallback }) => {
    updateSelectPlaceholder(placeholderRef, translationKey, fallback);
  });
};

const updateAllInputPlaceholders = () => {
  inputPlaceholderConfigs.forEach(({ placeholderRef, translationKey, fallback }) => {
    updateSelectPlaceholder(placeholderRef, translationKey, fallback ?? '');
  });
};

const translateDatePresetLabel = (key) => {
  const translationKey = `date.presets.${key}`;
  if (i18nInstance) {
    try {
      const translated = i18nInstance.t(translationKey);
      if (translated && translated !== translationKey) return translated;
    } catch (err) {
      console.error(err);
    }
  }
  return DATE_PRESET_FALLBACK_LABELS[key] || key;
};

const translateOptionLabel = (translationKey, fallback) => {
  if (translationKey && i18nInstance) {
    try {
      const translated = i18nInstance.t(translationKey);
      if (translated && translated !== translationKey) return translated;
    } catch (err) {
      console.error(err);
    }
  }
  if (fallback !== undefined && fallback !== null) {
    const str = String(fallback);
    if (str) return str;
  }
  return translationKey || '';
};

const refreshDatePresets = () => {
  const base = dayjs();
  datePresets.value = DATE_PRESET_DEFS.map(({ key, offset }) => ({
    label: translateDatePresetLabel(key),
    value: base.add(offset, 'day'),
  }));
};

const updateDayjsLocale = (lang) => {
  const map = { zh: 'zh-cn', id: 'id', en: 'en' };
  dayjs.locale(map[lang] || map.en);
  refreshDatePresets();
};

const STATUS_NOT_EMPTY_VALUE = '__NOT_EMPTY__';

const HAS_COORDINATE_OPTION_DEFS = [
  { value: '', translationKey: 'hasCoord.any', fallback: '（不限）' },
  { value: 'true', translationKey: 'hasCoord.true', fallback: '有经纬度' },
  { value: 'false', translationKey: 'hasCoord.false', fallback: '无经纬度' },
];

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

const updateStatusSelectOptions = () => {
  const options = statusFilterOptions.map(({ value, i18nKey, fallback }) => ({
    value,
    label: translateOptionLabel(i18nKey, fallback),
  }));
  try {
    statusSelectBridge.setOptions(options);
  } catch (err) {
    console.error(err);
  }
};

const updateHasCoordinateSelectOptions = () => {
  const options = HAS_COORDINATE_OPTION_DEFS.map(
    ({ value, translationKey, fallback }) => ({
      value,
      label: translateOptionLabel(translationKey, fallback),
    })
  );
  try {
    hasCoordinateSelectBridge.setOptions(options);
  } catch (err) {
    console.error(err);
  }
};

updateStatusSelectOptions();
updateHasCoordinateSelectOptions();

useBodyTheme('admin-theme');

const applyTranslations = () => {
  if (adminRoot.value && i18nInstance) {
    applyI18n(adminRoot.value, i18nInstance);
  }
  updateAllSelectPlaceholders();
  updateAllInputPlaceholders();
  updateStatusSelectOptions();
  updateHasCoordinateSelectOptions();
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
  updateDayjsLocale(currentLang.value);
  applyTranslations();
  document.documentElement.setAttribute(
    'lang',
    currentLang.value === 'zh' ? 'zh-CN' : currentLang.value
  );

  cleanup = setupDnAdminPage(adminRoot.value, {
    i18n: i18nInstance,
    applyTranslations,
    planMosDateSelect: planMosDateSelectBridge,
    filterSelects: filterSelectBridges,
    filterInputs: filterInputBridges,
  });

  i18nInstance.onChange((lang) => {
    currentLang.value = lang;
    applyTranslations();
    updateDayjsLocale(lang);
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : lang);
  });
});

onBeforeUnmount(() => {
  cleanup?.();
});
</script>

<style src="../assets/css/admin.css"></style>
