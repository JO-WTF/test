const normalizeLspName = (raw) => {
  if (!raw && raw !== 0) return '';
  const str = typeof raw === 'string' ? raw : String(raw ?? '').trim();
  return str.trim();
};

const normalizeNumber = (raw, fallback = 0) => {
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
};

export function createLspSummaryCardManager({
  container,
  wrapper,
  signal,
  onCardClick,
  getActiveLspValues,
} = {}) {
  let summaries = [];
  let loading = false;
  const refs = new Map();

  const getActiveSet = () => {
    if (typeof getActiveLspValues !== 'function') return new Set();
    try {
      const values = getActiveLspValues();
      if (!values) return new Set();
      const array = Array.isArray(values) ? values : [values];
      return new Set(
        array
          .map((item) => normalizeLspName(item))
          .filter((item) => Boolean(item))
      );
    } catch (err) {
      console.error(err);
    }
    return new Set();
  };

  const attachCardHandler = (button, item) => {
    if (!button) return;
    button.addEventListener(
      'click',
      () => {
        if (!item) return;
        onCardClick?.(item);
      },
      { signal }
    );
  };

  const renderEmptyState = () => {
    if (!wrapper || !container) return;
    container.innerHTML = '';
    refs.clear();
    if (loading) {
      wrapper.style.display = '';
      wrapper.setAttribute('aria-hidden', 'false');
      wrapper.setAttribute('aria-busy', 'true');
      const placeholder = document.createElement('div');
      placeholder.className = 'lsp-summary-card lsp-summary-card--placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.textContent = 'Loading…';
      container.appendChild(placeholder);
    } else {
      wrapper.style.display = 'none';
      wrapper.setAttribute('aria-hidden', 'true');
      wrapper.removeAttribute('aria-busy');
    }
  };

  const renderCards = () => {
    if (!wrapper || !container) return;
    container.innerHTML = '';
    refs.clear();

    if (!summaries.length) {
      renderEmptyState();
      return;
    }

    wrapper.style.display = '';
    wrapper.setAttribute('aria-hidden', 'false');
    wrapper.setAttribute('aria-busy', loading ? 'true' : 'false');

    const activeSet = getActiveSet();

    summaries.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lsp-summary-card';
      btn.setAttribute('data-lsp', item.lsp);
      btn.setAttribute('aria-pressed', activeSet.has(item.lsp) ? 'true' : 'false');
      btn.setAttribute('aria-busy', loading ? 'true' : 'false');

      const label = document.createElement('span');
      label.className = 'lsp-summary-card__label';
      label.textContent = `${item.lsp}:`;

      const stats = document.createElement('span');
      stats.className = 'lsp-summary-card__stats';
      stats.textContent = `Updated ${item.updated}/${item.total} Total`;

      btn.setAttribute('aria-label', `${item.lsp}: Updated ${item.updated}/${item.total} Total`);

      btn.appendChild(label);
      btn.appendChild(stats);

      container.appendChild(btn);
      refs.set(item.lsp, { button: btn, item });
      attachCardHandler(btn, item);
    });

    updateActiveState();
  };

  function normalizeSummaries(list) {
    if (!Array.isArray(list)) return [];
    const normalized = [];
    list.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const lsp = normalizeLspName(entry.lsp ?? entry.lsp_name ?? entry.name);
      if (!lsp) return;
      const updated = normalizeNumber(entry.status_not_empty ?? entry.updated ?? entry.count);
      const total = normalizeNumber(entry.total_dn ?? entry.total ?? entry.total_count);
      normalized.push({
        lsp,
        updated,
        total,
      });
    });
    return normalized.length
      ? normalized
      : [];
  }

  function setData(list) {
    summaries = normalizeSummaries(list);
    renderCards();
  }

  function setLoading(next) {
    loading = Boolean(next);
    if (!summaries.length) {
      renderEmptyState();
      return;
    }
    wrapper?.setAttribute('aria-busy', loading ? 'true' : 'false');
    refs.forEach(({ button }) => {
      if (!button) return;
      button.setAttribute('aria-busy', loading ? 'true' : 'false');
      button.classList.toggle('loading', loading);
    });
  }

  function updateActiveState() {
    if (!refs.size) return;
    const activeSet = getActiveSet();
    refs.forEach(({ button, item }) => {
      if (!button || !item) return;
      const isActive = activeSet.has(item.lsp);
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  return {
    setData,
    setLoading,
    updateActiveState,
  };
}
