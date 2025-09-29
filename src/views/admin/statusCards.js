const STATUS_CARD_MAX_COLUMNS = 13;
const STATUS_CARD_TOTAL_KEY = '__TOTAL__';
const DEFAULT_TRANSPORT_MANAGER_STATUS_CARDS = [
  { status: 'Prepare Vehicle', label: 'Prepare Vehicle' },
  { status: 'On the way', label: 'On the way' },
  { status: 'On Site', label: 'On Site' },
  { status: 'POD', label: 'POD' },
  { status: 'Waiting PIC Feedback', label: 'Waiting PIC Feedback' },
  { status: 'RePlan MOS due to LSP Delay', label: 'RePlan MOS due to LSP Delay' },
  { status: 'RePlan MOS Project', label: 'RePlan MOS Project' },
  { status: 'Cancel MOS', label: 'Cancel MOS' },
  { status: 'Close by RN', label: 'Close by RN' },
  { status: 'No Status', label: 'No Status' },
];

export function createStatusCardManager({
  container,
  wrapper,
  signal,
  API_BASE,
  i18n,
  getCurrentRole,
  normalizeStatusValue,
  i18nStatusDisplay,
  getStatusDeliveryValues,
  getStatusFilterValue,
  onApplyFilter,
  transportManagerCards = DEFAULT_TRANSPORT_MANAGER_STATUS_CARDS,
  onSummaryUpdate,
}) {
  let defs = [];
  const refs = new Map();
  let abortController = null;
  let requestId = 0;

  function getStatusCardLabel(def) {
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
    return i18nStatusDisplay(def.status);
  }

  function safeNotifySummary(summary) {
    if (typeof onSummaryUpdate !== 'function') return;
    try {
      onSummaryUpdate(summary);
    } catch (err) {
      console.error(err);
    }
  }

  function getRoleStatusHighlights(role) {
    if (!role) return [];
    const highlights = Array.isArray(role.statusHighlights)
      ? role.statusHighlights
      : [];
    const seen = new Set();
    const list = [];
    highlights.forEach((item) => {
      if (!item) return;
      let status = '';
      let label = '';
      let labelKey = '';
      if (typeof item === 'string') {
        status = normalizeStatusValue(item) || item;
      } else if (typeof item === 'object') {
        const target = item.status ?? item.value ?? item.key;
        status = normalizeStatusValue(target) || target || '';
        if (typeof item.label === 'string') label = item.label;
        if (typeof item.labelKey === 'string') labelKey = item.labelKey;
      }
      if (!status || seen.has(status)) return;
      seen.add(status);
      list.push({ status, label, labelKey });
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
            ? normalizeStatusValue(def.status) || def.status || ''
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
      if (role?.key === 'transportManager') {
        list = transportManagerCards.map((card) => ({
          status: card.status,
          label: card.label,
        }));
      } else {
        list = getRoleStatusHighlights(role);
      }

      list = list.map((defItem, index) => {
        const canonical = normalizeStatusValue(defItem.status);
        const status = canonical || defItem.status || '';
        const key =
          status ||
          (typeof defItem.labelKey === 'string' && defItem.labelKey
            ? `label:${defItem.labelKey}`
            : `status:${index}`);
        return {
          ...defItem,
          status,
          key,
          type: 'status',
        };
      });

      list = list.filter((defItem) => defItem.type !== 'status' || defItem.status);

      if (role?.key === 'transportManager' && list.length) {
        list = [
          {
            status: '',
            label: 'Total',
            key: STATUS_CARD_TOTAL_KEY,
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
      container.style.removeProperty('--status-card-columns');
      safeNotifySummary(null);
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
    const columns = Math.max(1, Math.min(list.length, STATUS_CARD_MAX_COLUMNS));
    container.style.setProperty('--status-card-columns', String(columns + 1));

    list.forEach((defItem) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'status-card';
      btn.setAttribute('data-status', defItem.type === 'status' ? defItem.status : '');
      btn.setAttribute('data-card-key', defItem.key);
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-busy', 'false');

      const countEl = document.createElement('div');
      countEl.className = 'status-card__count';
      countEl.textContent = '…';

      const labelEl = document.createElement('div');
      labelEl.className = 'status-card__label';
      labelEl.textContent = getStatusCardLabel(defItem);

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
      const label = getStatusCardLabel(defItem);
      ref.labelEl.textContent = label;
      const currentCount = ref.countEl.textContent || '';
      ref.button.setAttribute('aria-label', `${label} ${currentCount}`.trim());
    });
  }

  function updateActiveState() {
    if (!refs.size) return;
    const deliveryTokens = getStatusDeliveryValues();
    const deliveryValue = deliveryTokens.length ? deliveryTokens[0] : '';
    const canonicalDelivery = normalizeStatusValue(deliveryValue);
    const statusValue = getStatusFilterValue();
    const canonicalStatus = normalizeStatusValue(statusValue);
    const canonical = canonicalDelivery || canonicalStatus;
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

  async function fetchStatusCardStats(signal) {
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
    const lspSummary = data?.lsp_summary ?? data?.lspSummary ?? null;
    const counts = Object.create(null);
    list.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const statusRaw =
        item.status_delivery ?? item.status ?? item.value ?? item.key ?? '';
      const status = normalizeStatusValue(statusRaw);
      if (!status) return;
      const countRaw = Number(
        item.count ?? item.total ?? item.value ?? item.qty ?? item.quantity ?? 0
      );
      const countValue = Number.isFinite(countRaw) ? countRaw : 0;
      const existing = Number.isFinite(counts[status]) ? counts[status] : 0;
      counts[status] = existing + countValue;
    });
    const totalRaw = Number(data?.total ?? data?.count);
    const total = Number.isFinite(totalRaw) ? totalRaw : null;
    return { counts, total, lspSummary };
  }

  async function refreshCounts() {
    const shouldUpdateCards = defs.length && refs.size;
    if (!shouldUpdateCards && typeof onSummaryUpdate !== 'function') return;
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

    if (shouldUpdateCards) {
      refs.forEach((ref) => {
        ref.button.classList.add('loading');
        ref.button.setAttribute('aria-busy', 'true');
        ref.countEl.textContent = '…';
      });
    }

    let stats = null;
    try {
      stats = await fetchStatusCardStats(cardSignal);
    } catch (err) {
      if (cardSignal.aborted || currentRequestId !== requestId) return;
      if (err?.name !== 'AbortError') {
        console.error(err);
      }
      safeNotifySummary(null);
      if (!shouldUpdateCards) return;
    }

    if (cardSignal.aborted || currentRequestId !== requestId) return;

    const counts = stats?.counts || Object.create(null);
    let totalCount = 0;

    safeNotifySummary(stats?.lspSummary ?? null);

    if (!shouldUpdateCards) return;

    refs.forEach((ref) => {
      const defItem = ref.def;
      if (!defItem) return;
      if (defItem.type === 'status') {
        const rawCount = counts?.[defItem.status];
        const displayCount = Number.isFinite(rawCount) ? rawCount : 0;
        totalCount += displayCount;
        ref.countEl.textContent = String(displayCount);
        ref.button.classList.remove('loading');
        ref.button.setAttribute('aria-busy', 'false');
        const label = getStatusCardLabel(defItem);
        ref.button.setAttribute('aria-label', `${label} ${displayCount}`.trim());
      }
    });

    refs.forEach((ref) => {
      const defItem = ref.def;
      if (!defItem) return;
      if (defItem.type !== 'status') {
        const displayCount = stats?.total ?? totalCount;
        const safeCount = Number.isFinite(displayCount)
          ? displayCount
          : totalCount;
        ref.countEl.textContent = String(safeCount);
        ref.button.classList.remove('loading');
        ref.button.setAttribute('aria-busy', 'false');
        const label = getStatusCardLabel(defItem);
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
