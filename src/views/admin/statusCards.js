import { STATUS_DELIVERY_VALUES } from '../../config.js';
import {
  TRANSPORT_MANAGER_STATUS_DELIVERY_CARDS,
  TRANSPORT_MANAGER_ROLE_KEY,
} from './constants.js';

const STATUS_DELIVERY_CARD_MAX_COLUMNS = 13;
const STATUS_DELIVERY_CARD_TOTAL_KEY = '__TOTAL__';

export function createStatusDeliveryCardManager({
  container,
  wrapper,
  signal,
  API_BASE,
  i18n,
  getCurrentRole,
  normalizeStatusDeliveryValue,
  i18nStatusDeliveryDisplay,
  getStatusSiteValues,
  getStatusDeliveryFilterValue,
  onApplyFilter,
  transportManagerDeliveryCards = TRANSPORT_MANAGER_STATUS_DELIVERY_CARDS,
  onStatsFetched,
  onLoadingChange,
}) {
  let defs = [];
  const refs = new Map();
  let abortController = null;
  let requestId = 0;

  function getStatusDeliveryCardLabel(def) {
    if (!def) return '';
    if (def.labelKey && i18n) {
      try {
        const translated = i18n.t(def.labelKey);
        if (translated && translated !== def.labelKey) return translated;
      } catch (err) {
        console.error(err);
      }
    }
    if (def.label) return def.label;
  return i18nStatusDeliveryDisplay(def.status_delivery);
  }

  function getRoleStatusDeliveryHighlights(role) {
    if (!role) return [];
    const highlights = Array.isArray(role.statusDeliveryHighlights)
      ? role.statusDeliveryHighlights
      : [];
    const seen = new Set();
    const list = [];
    highlights.forEach((item) => {
      if (!item) return;
      let statusDelivery = '';
      let label = '';
      let labelKey = '';
      if (typeof item === 'string') {
        statusDelivery = normalizeStatusDeliveryValue(item) || item;
      } else if (typeof item === 'object') {
        const target = item.status_delivery ?? item.value ?? item.key;
        statusDelivery = normalizeStatusDeliveryValue(target) || target || '';
        if (typeof item.label === 'string') label = item.label;
        if (typeof item.labelKey === 'string') labelKey = item.labelKey;
      }
      if (!statusDelivery || seen.has(statusDelivery)) return;
      seen.add(statusDelivery);
      list.push({ status_delivery: statusDelivery, label, labelKey });
    });
    return list;
  }

  function attachCardHandler(button, def) {
    button.addEventListener(
      'click',
      () => {
        if (!def || (def.type !== 'status' && def.type !== 'total')) return;
        const canonical =
          def.type === 'status'
            ? normalizeStatusDeliveryValue(def.status_delivery) || def.status_delivery || ''
            : '';
        if (def.type === 'status' && !canonical) return;
        onApplyFilter?.(def, canonical);
        updateActiveState();
      },
      { signal }
    );
  }

  function render() {
    if (!container || !wrapper) return;
    const role = getCurrentRole();
    let list = [];

    if (role?.key === 'lsp') {
      list = [];
    } else {
      if (role?.key === TRANSPORT_MANAGER_ROLE_KEY) {
        list = transportManagerDeliveryCards.map((card) => ({
          status_delivery: card.status_delivery,
          label: card.label,
        }));
      } else {
        list = getRoleStatusDeliveryHighlights(role);
      }

      list = list.map((defItem, index) => {
        const canonical = normalizeStatusDeliveryValue(defItem.status_delivery);
        const status_delivery = canonical || defItem.status_delivery || '';
        const key =
          status_delivery ||
          (typeof defItem.labelKey === 'string' && defItem.labelKey
            ? `label:${defItem.labelKey}`
            : `status_delivery:${index}`);
        return {
          ...defItem,
          status_delivery,
          key,
          type: 'status',
        };
      });

      list = list.filter((defItem) => defItem.type !== 'status' || defItem.status_delivery);

      if (role?.key === TRANSPORT_MANAGER_ROLE_KEY && list.length) {
        list = [
          {
            status_delivery: '',
            label: 'Total',
            key: STATUS_DELIVERY_CARD_TOTAL_KEY,
            type: 'total',
          },
          ...list,
        ];
      }
    }

    defs = list;
    refs.clear();

    if (!list.length) {
      container.innerHTML = '';
      wrapper.style.display = 'none';
      wrapper.setAttribute('aria-hidden', 'true');
      if (abortController) {
        try {
          abortController.abort();
        } catch (err) {
          console.error(err);
        }
        abortController = null;
      }
      return;
    }

    wrapper.style.display = '';
    wrapper.setAttribute('aria-hidden', 'false');
    container.innerHTML = '';
    const columns = Math.max(1, Math.min(list.length, STATUS_DELIVERY_CARD_MAX_COLUMNS));

    list.forEach((defItem) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'status-card';
      btn.setAttribute('data-status_delivery', defItem.type === 'status' ? defItem.status_delivery : '');
      btn.setAttribute('data-card-key', defItem.key);
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-busy', 'false');

      const countEl = document.createElement('div');
      countEl.className = 'status-card__count';
      countEl.textContent = '…';

      const labelEl = document.createElement('div');
      labelEl.className = 'status-card__label';
      labelEl.textContent = getStatusDeliveryCardLabel(defItem);

      btn.appendChild(countEl);
      btn.appendChild(labelEl);

      attachCardHandler(btn, defItem);

      container.appendChild(btn);
      refs.set(defItem.key, { def: defItem, button: btn, countEl, labelEl });
    });

    updateLabels();
    updateActiveState();
  }

  function updateLabels() {
    if (!defs.length) return;
    defs.forEach((defItem) => {
      const ref = refs.get(defItem.key);
      if (!ref) return;
      ref.def = defItem;
      const label = getStatusDeliveryCardLabel(defItem);
      ref.labelEl.textContent = label;
      const currentCount = ref.countEl.textContent || '';
      ref.button.setAttribute('aria-label', `${label} ${currentCount}`.trim());
    });
  }

  function updateActiveState() {
    if (!refs.size) return;
    const siteTokens = getStatusSiteValues();
    const siteValue = siteTokens.length ? siteTokens[0] : '';
    const canonicalSite = normalizeStatusDeliveryValue(siteValue);
    const statusValue = getStatusDeliveryFilterValue();
    const canonicalStatus = normalizeStatusDeliveryValue(statusValue);
    const canonical = canonicalSite || canonicalStatus;
    const hasStatus = Boolean(canonical);
    refs.forEach((ref) => {
      const defItem = ref.def;
      if (!defItem) return;
      const isActive =
        defItem.type === 'status'
          ? hasStatus && defItem.status === canonical
          : defItem.type === 'total'
          ? !hasStatus
          : false;
      ref.button.classList.toggle('active', isActive);
      ref.button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  async function fetchStatusDeliveryCardStats(signal) {
    const url = `${API_BASE}/api/dn/status-delivery/stats`;
    const resp = await fetch(url, { signal });
    const text = await resp.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (err) {
      console.error(err);
    }
    if (!resp.ok) {
      throw new Error((data && (data.detail || data.message)) || `HTTP ${resp.status}`);
    }
    const list = Array.isArray(data?.data) ? data.data : [];
    const counts = Object.create(null);
    list.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const statusDeliveryRaw = item.status_delivery ?? '';
      const status_delivery = normalizeStatusDeliveryValue(statusDeliveryRaw);
      if (!status_delivery) return;
      const countRaw = Number(
        item.count ?? item.total ?? 0
      );
      const countValue = Number.isFinite(countRaw) ? countRaw : 0;
      const existing = Number.isFinite(counts[status_delivery]) ? counts[status_delivery] : 0;
      counts[status_delivery] = existing + countValue;
    });
    const totalRaw = Number(data?.total ?? data?.count);
    const total = Number.isFinite(totalRaw) ? totalRaw : null;
    const lspSummary = Array.isArray(data?.lsp_summary) ? data.lsp_summary : [];
    return { counts, total, lspSummary };
  }

  async function refreshCounts() {
    const currentRole = typeof getCurrentRole === 'function' ? getCurrentRole() : null;
    if (!currentRole) {
      return;
    }
    const shouldFetchStats =
      (defs.length && refs.size) || typeof onStatsFetched === 'function';
    if (!shouldFetchStats) return;
    requestId += 1;
    const currentRequestId = requestId;

    if (abortController) {
      try {
        abortController.abort();
      } catch (err) {
        console.error(err);
      }
    }
    const controller = new AbortController();
    abortController = controller;
    const { signal: cardSignal } = controller;

    if (refs.size) {
      refs.forEach((ref) => {
        ref.button.classList.add('loading');
        ref.button.setAttribute('aria-busy', 'true');
        ref.countEl.textContent = '…';
      });
    }

    if (typeof onLoadingChange === 'function') {
      try {
        onLoadingChange(true);
      } catch (err) {
        console.error(err);
      }
    }

    let stats = null;
    try {
      stats = await fetchStatusDeliveryCardStats(cardSignal);
    } catch (err) {
      if (cardSignal.aborted || currentRequestId !== requestId) return;
      if (err?.name !== 'AbortError') {
        console.error(err);
      }
    }

    if (cardSignal.aborted || currentRequestId !== requestId) {
      if (typeof onLoadingChange === 'function') {
        try {
          onLoadingChange(false);
        } catch (err) {
          console.error(err);
        }
      }
      return;
    }

    if (typeof onLoadingChange === 'function') {
      try {
        onLoadingChange(false);
      } catch (err) {
        console.error(err);
      }
    }

    if (typeof onStatsFetched === 'function') {
      try {
        onStatsFetched(stats);
      } catch (err) {
        console.error(err);
      }
    }

    const counts = stats?.counts ?? Object.create(null);
    let totalCount = 0;

    refs.forEach((ref) => {
      const defItem = ref.def;
      if (!defItem) return;
      if (defItem.type === 'status') {
        const rawCount = counts?.[defItem.status_delivery];
        const displayCount = Number.isFinite(rawCount) ? rawCount : 0;
        totalCount += displayCount;
        ref.countEl.textContent = String(displayCount);
        ref.button.classList.remove('loading');
        ref.button.setAttribute('aria-busy', 'false');
        const label = getStatusDeliveryCardLabel(defItem);
        ref.button.setAttribute('aria-label', `${label} ${displayCount}`.trim());
      }
    });

    refs.forEach((ref) => {
      const defItem = ref.def;
      if (!defItem) return;
      if (defItem.type !== 'status') {
        const displayCount = stats?.total;
        const safeCount = Number.isFinite(displayCount)
          ? displayCount
          : totalCount;
        ref.countEl.textContent = String(safeCount);
        ref.button.classList.remove('loading');
        ref.button.setAttribute('aria-busy', 'false');
        const label = getStatusDeliveryCardLabel(defItem);
        ref.button.setAttribute('aria-label', `${label} ${safeCount}`.trim());
      }
    });
  }

  return {
    render,
    updateLabels,
    updateActiveState,
    refreshCounts,
  };
}
