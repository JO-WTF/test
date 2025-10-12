import { ref, watch } from 'vue';
import dayjs from 'dayjs';
import { STATUS_DELIVERY_ITEMS } from '../../config.js';

export const DATE_PICKER_VALUE_FORMAT = 'YYYY-MM-DD';
const DEFAULT_SELECT_PLACEHOLDER = 'Type or select';
const translateWithFallback = (translator, key, fallback) => {
  if (typeof translator === 'function') {
    try {
      const translated = translator(key);
      if (translated && translated !== key) {
        return translated;
      }
    } catch (err) {
      console.error(err);
    }
  }
  if (fallback !== undefined && fallback !== null) {
    const str = String(fallback);
    if (str) return str;
  }
  return key;
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

export function useAdminFilters() {
  const planMosDate = createSelectState();
  const region = createSelectState();
  const area = createSelectState();
  const lsp = createSelectState();
  const subcon = createSelectState();
  const statusSite = createSelectState();
  const statusDelivery = createSingleSelectState('Any');
  const hasCoordinate = createSingleSelectState('Any');
  const remark = createTextInputState('模糊匹配');
  const du = createTextInputState('精确匹配');
  const fromDate = createDatePickerState();
  const toDate = createDatePickerState();

  const datePresets = ref([]);

  const filterSelectBridges = {
    plan_mos_date: planMosDate.bridge,
    region: region.bridge,
    area: area.bridge,
    lsp: lsp.bridge,
    subcon: subcon.bridge,
    status_site: statusSite.bridge,
    status_delivery: statusDelivery.bridge,
    has_coordinate: hasCoordinate.bridge,
    date_from: fromDate.bridge,
    date_to: toDate.bridge,
  };

  const filterInputBridges = {
    remark: remark.bridge,
    du: du.bridge,
  };

  const selectPlaceholderBindings = [
    { placeholderRef: planMosDate.placeholder, translationKey: 'planMosDate.placeholder' },
    { placeholderRef: region.placeholder, translationKey: 'region.placeholder' },
    { placeholderRef: area.placeholder, translationKey: 'area.placeholder' },
    { placeholderRef: lsp.placeholder, translationKey: 'lsp.placeholder' },
    { placeholderRef: subcon.placeholder, translationKey: 'subcon.placeholder' },
    {
      placeholderRef: statusSite.placeholder,
      translationKey: 'statusSitePlaceholder',
    },
    {
      placeholderRef: statusDelivery.placeholder,
      translationKey: 'statusDelivery.filter.any',
      fallback: 'Any',
    },
    {
      placeholderRef: hasCoordinate.placeholder,
      translationKey: 'hasCoord.any',
      fallback: '（不限）',
    },
  ];

  const inputPlaceholderBindings = [
    {
      placeholderRef: remark.placeholder,
      translationKey: 'remark.kw.placeholder',
      fallback: '模糊匹配',
    },
    {
      placeholderRef: du.placeholder,
      translationKey: 'du.filter.placeholder',
      fallback: '精确匹配',
    },
  ];

  const updatePlaceholders = (translator) => {
    selectPlaceholderBindings.forEach(({ placeholderRef, translationKey, fallback }) => {
      placeholderRef.value = translateWithFallback(translator, translationKey, fallback);
    });
    inputPlaceholderBindings.forEach(({ placeholderRef, translationKey, fallback }) => {
      placeholderRef.value = translateWithFallback(translator, translationKey, fallback);
    });
  };

  const updateStatusSelectOptions = (translator) => {
    const statusFilterDefs = [
      { value: '', translationKey: 'statusDelivery.filter.any', fallback: '任意' },
      {
        value: '__NOT_EMPTY__',
        translationKey: 'statusDelivery.filter.notEmpty',
        fallback: '任意非空',
      },
      ...STATUS_DELIVERY_ITEMS.map(({ value, filterLabelKey }) => ({
        value,
        translationKey: filterLabelKey,
        fallback: value,
      })),
    ];
    const options = statusFilterDefs.map(({ value, translationKey, fallback }) => ({
      value,
      label: translateWithFallback(translator, translationKey, fallback),
    }));
    try {
      statusDelivery.bridge.setOptions(options);
    } catch (err) {
      console.error(err);
    }
  };

  const updateHasCoordinateSelectOptions = (translator) => {
    const coordinateOptionDefs = [
      { value: '', translationKey: 'hasCoord.any', fallback: '（不限）' },
      { value: 'true', translationKey: 'hasCoord.true', fallback: '有经纬度' },
      { value: 'false', translationKey: 'hasCoord.false', fallback: '无经纬度' },
    ];
    const options = coordinateOptionDefs.map(({ value, translationKey, fallback }) => ({
      value,
      label: translateWithFallback(translator, translationKey, fallback),
    }));
    try {
      hasCoordinate.bridge.setOptions(options);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshDatePresets = (translator) => {
    const base = dayjs();
    const presetDefs = [
      { key: 'yesterday', offset: -1 },
      { key: 'today', offset: 0 },
      { key: 'tomorrow', offset: 1 },
    ];
    const presetFallbackLabels = {
      yesterday: 'Yesterday',
      today: 'Today',
      tomorrow: 'Tomorrow',
    };
    datePresets.value = presetDefs.map(({ key, offset }) => ({
      label: translateWithFallback(
        translator,
        `date.presets.${key}`,
        presetFallbackLabels[key] || key
      ),
      value: base.add(offset, 'day'),
    }));
  };

  const setDefaultStatusFilter = () => {
    try {
      statusDelivery.bridge.setValue('');
    } catch (err) {
      console.error(err);
    }
  };

  setDefaultStatusFilter();

  return {
    planMosDateSelectOptions: planMosDate.options,
    planMosDateSelectValue: planMosDate.value,
    planMosDatePlaceholder: planMosDate.placeholder,
    planMosDateSelectBridge: planMosDate.bridge,
    regionSelectOptions: region.options,
    regionSelectValue: region.value,
    regionSelectPlaceholder: region.placeholder,
    areaSelectOptions: area.options,
    areaSelectValue: area.value,
    areaSelectPlaceholder: area.placeholder,
    areaSelectBridge: area.bridge,
    lspSelectOptions: lsp.options,
    lspSelectValue: lsp.value,
    lspSelectPlaceholder: lsp.placeholder,
    lspSelectBridge: lsp.bridge,
    subconSelectOptions: subcon.options,
    subconSelectValue: subcon.value,
    subconSelectPlaceholder: subcon.placeholder,
    subconSelectBridge: subcon.bridge,
    statusSiteSelectOptions: statusSite.options,
    statusSiteSelectValue: statusSite.value,
    statusSiteSelectPlaceholder: statusSite.placeholder,
    statusSiteSelectBridge: statusSite.bridge,
    statusDeliverySelectOptions: statusDelivery.options,
    statusDeliverySelectValue: statusDelivery.value,
    statusDeliverySelectPlaceholder: statusDelivery.placeholder,
    statusSelectBridge: statusDelivery.bridge,
    hasCoordinateSelectOptions: hasCoordinate.options,
    hasCoordinateSelectValue: hasCoordinate.value,
    hasCoordinateSelectPlaceholder: hasCoordinate.placeholder,
    hasCoordinateSelectBridge: hasCoordinate.bridge,
    remarkInputValue: remark.value,
    remarkInputPlaceholder: remark.placeholder,
    remarkInputBridge: remark.bridge,
    duInputValue: du.value,
    duInputPlaceholder: du.placeholder,
    duInputBridge: du.bridge,
    fromDateValue: fromDate.value,
    fromDateBridge: fromDate.bridge,
    toDateValue: toDate.value,
    toDateBridge: toDate.bridge,
    datePresets,
    filterSelectBridges,
    filterInputBridges,
    updatePlaceholders,
    updateStatusSelectOptions,
    updateHasCoordinateSelectOptions,
    refreshDatePresets,
    setDefaultStatusFilter,
  };
}
