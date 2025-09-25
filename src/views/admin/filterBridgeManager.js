export function createFilterBridgeManager({
  filterSelects = {},
  filterInputs = {},
  planMosDateSelect = null,
} = {}) {
  const selectBridgeByKey = new Map();
  const inputBridgeByKey = new Map();
  const selectBridgeUnsubscribers = [];

  const registerBridgeEntries = (entries, targetMap) => {
    if (!entries || typeof entries !== 'object') return;
    Object.entries(entries).forEach(([key, bridge]) => {
      if (!key || !bridge || typeof bridge !== 'object') return;
      targetMap.set(key, bridge);
    });
  };

  registerBridgeEntries(filterSelects, selectBridgeByKey);
  registerBridgeEntries(filterInputs, inputBridgeByKey);

  if (planMosDateSelect && typeof planMosDateSelect === 'object') {
    selectBridgeByKey.set('plan_mos_date', planMosDateSelect);
  }

  const toArray = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw
        .map((item) =>
          item === undefined || item === null
            ? ''
            : typeof item === 'string'
            ? item.trim()
            : String(item).trim()
        )
        .filter(Boolean);
    }
    if (typeof raw === 'string') {
      return raw
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    try {
      const str = String(raw).trim();
      return str ? [str] : [];
    } catch (err) {
      console.error(err);
    }
    return [];
  };

  const getSelectBridge = (key) => selectBridgeByKey.get(key) || null;
  const getInputBridge = (key) => inputBridgeByKey.get(key) || null;

  const getFilterValues = (key) => {
    const bridge = getSelectBridge(key);
    if (!bridge || typeof bridge.getValue !== 'function') {
      return [];
    }
    try {
      return toArray(bridge.getValue());
    } catch (err) {
      console.error(err);
    }
    return [];
  };

  const getSingleFilterValue = (key) => {
    const values = getFilterValues(key);
    return values.length ? values[0] : '';
  };

  const getDateFilterValue = (key) => {
    const value = getSingleFilterValue(key);
    return value || '';
  };

  const setFilterDropdownOptions = (key, options) => {
    const bridge = getSelectBridge(key);
    if (!bridge || typeof bridge.setOptions !== 'function') {
      return;
    }
    try {
      bridge.setOptions(options || []);
    } catch (err) {
      console.error(err);
    }
  };

  const setFilterValue = (key, value) => {
    const bridge = getSelectBridge(key);
    if (bridge && typeof bridge.setValue === 'function') {
      try {
        bridge.setValue(value);
        return;
      } catch (err) {
        console.error(err);
      }
    }
    const inputBridge = getInputBridge(key);
    if (inputBridge && typeof inputBridge.setValue === 'function') {
      try {
        inputBridge.setValue(value ?? '');
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getInputValue = (key) => {
    const bridge = getInputBridge(key);
    if (!bridge || typeof bridge.getValue !== 'function') {
      return '';
    }
    try {
      const raw = bridge.getValue();
      if (raw === undefined || raw === null) return '';
      return typeof raw === 'string' ? raw : String(raw);
    } catch (err) {
      console.error(err);
    }
    return '';
  };

  const setInputValue = (key, value) => {
    const bridge = getInputBridge(key);
    if (!bridge || typeof bridge.setValue !== 'function') {
      return;
    }
    try {
      bridge.setValue(value ?? '');
    } catch (err) {
      console.error(err);
    }
  };

  const subscribeToFilterChange = (key, listener) => {
    const bridge = getSelectBridge(key) || getInputBridge(key);
    if (!bridge || typeof bridge.onChange !== 'function' || typeof listener !== 'function') {
      return () => {};
    }
    try {
      const unsubscribe = bridge.onChange(listener);
      if (typeof unsubscribe === 'function') {
        selectBridgeUnsubscribers.push(unsubscribe);
        return () => {
          unsubscribe();
        };
      }
    } catch (err) {
      console.error(err);
    }
    return () => {};
  };

  const cleanupSubscriptions = () => {
    selectBridgeUnsubscribers.forEach((unsubscribe) => {
      if (typeof unsubscribe !== 'function') return;
      try {
        unsubscribe();
      } catch (err) {
        console.error(err);
      }
    });
    selectBridgeUnsubscribers.length = 0;
  };

  return {
    getFilterValues,
    getSingleFilterValue,
    getDateFilterValue,
    setFilterDropdownOptions,
    setFilterValue,
    getInputValue,
    setInputValue,
    subscribeToFilterChange,
    cleanupSubscriptions,
  };
}
