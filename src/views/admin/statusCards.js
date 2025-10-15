import {
  TRANSPORT_MANAGER_STATUS_DELIVERY_CARDS,
  TRANSPORT_MANAGER_ROLE_KEY,
  TRANSPORT_MANAGER_STATUS_SITE_CARDS,
} from './constants.js';

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
  transportManagerSiteCards = TRANSPORT_MANAGER_STATUS_SITE_CARDS,
  onStatsFetched,
  onLoadingChange,
}) {
  let defs = [];
  let siteDefs = [];
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
    // i18nStatusDeliveryDisplay may be optional; guard the call and fallback
    try {
      if (typeof i18nStatusDeliveryDisplay === 'function') {
        const v = i18nStatusDeliveryDisplay(def.status_delivery);
        if (v || v === '') return v;
      }
    } catch (err) {
      console.error('i18nStatusDeliveryDisplay error', err);
    }
    // final fallback: return the raw status_delivery or empty string
    return String(def.status_delivery || '') ;
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

  function getRoleStatusSiteHighlights(role) {
    if (!role) return [];
    const highlights = Array.isArray(role.statusSiteHighlights)
      ? role.statusSiteHighlights
      : [];
    const seen = new Set();
    const list = [];
    highlights.forEach((item) => {
      if (!item) return;
      let statusSite = '';
      let label = '';
      let labelKey = '';
      if (typeof item === 'string') {
        statusSite = normalizeStatusDeliveryValue(item) || item;
      } else if (typeof item === 'object') {
        const target = item.status_site ?? item.value ?? item.key;
        statusSite = normalizeStatusDeliveryValue(target) || target || '';
        if (typeof item.label === 'string') label = item.label;
        if (typeof item.labelKey === 'string') labelKey = item.labelKey;
      }
      if (!statusSite || seen.has(statusSite)) return;
      seen.add(statusSite);
      list.push({ status_site: statusSite, label, labelKey });
    });
    return list;
  }

  function attachCardHandler(button, def) {
    button.addEventListener(
      'click',
      () => {
        if (!def || (def.type !== 'status_delivery')) return;
        const canonical =
          def.type === 'status_delivery'
            ? normalizeStatusDeliveryValue(def.status_delivery) || def.status_delivery || ''
            : '';
        if (def.type === 'status_delivery' && !canonical) return;
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
    let siteList = [];

    // Use role-defined highlights when available. Fallback to provided transportManagerDeliveryCards
    const roleHighlights = getRoleStatusDeliveryHighlights(role);
    if (roleHighlights && roleHighlights.length) {
      list = roleHighlights;
    } else {
      list = [];
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
          type: 'status_delivery',
        };
      });

      list = list.filter((defItem) => defItem.type !== 'status_delivery' || defItem.status_delivery);
    // Build site cards: prefer role-defined site highlights, fallback to role.permissions.statusSiteOptions,
    try {
      const roleSiteHighlights = getRoleStatusSiteHighlights(role);
      if (roleSiteHighlights && roleSiteHighlights.length) {
        siteList = roleSiteHighlights.map((defItem, idx) => {
          const status_site = normalizeStatusDeliveryValue(defItem.status_site) || defItem.status_site || '';
          const key = status_site || (typeof defItem.labelKey === 'string' && defItem.labelKey ? `label:${defItem.labelKey}` : `status_site:${idx}`);
          return { ...defItem, status_site, key, type: 'status_site' };
        }).filter((d) => d.status_site);
      } else {
        const perms = role?.permissions || {};
        const allowedSites = Array.isArray(perms.statusSiteOptions) ? perms.statusSiteOptions : [];
        if (allowedSites && allowedSites.length) {
          siteList = allowedSites.map((v, idx) => {
            const status_site = normalizeStatusDeliveryValue(v) || v || '';
            const key = status_site || `status_site:${idx}`;
            return { status_site, label: v, key, type: 'status_site' };
          }).filter((d) => d.status_site);
        } else {
          // fallback to transport manager default site cards; prepend a Total card
          if (Array.isArray(transportManagerSiteCards)) {
            const mapped = transportManagerSiteCards.map((card, idx) => ({
              status_site: card.status_site,
              label: card.label,
              key: card.status_site || `status_site:${idx}`,
              type: 'status_site',
            }));
            // prepend Total card
            siteList = [{ status_site: 'Total', label: 'Total', key: 'status_site:total', type: 'status_site' }, ...mapped];
          } else {
            siteList = [];
          }
        }
      }
    } catch (err) {
      console.error(err);
      siteList = [];
    }
    console.log(list);
    defs = list;
    refs.clear();

    if (!list.length && !siteList.length) {
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

    // Delivery cards container
    const deliveryGroup = document.createElement('div');
    deliveryGroup.className = 'status-card-group status-card-group--delivery';
    // Site cards container
    const siteGroup = document.createElement('div');
    siteGroup.className = 'status-card-group status-card-group--site';

    list.forEach((defItem) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'status-card';
      btn.setAttribute('data-status_delivery', defItem.type === 'status_delivery' ? defItem.status_delivery : '');
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

      deliveryGroup.appendChild(btn);
      refs.set(defItem.key, { def: defItem, button: btn, countEl, labelEl });
    });

    // Render site cards (if any)
    siteList.forEach((defItem) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'status-card status-card--site';
      btn.setAttribute('data-status_site', defItem.type === 'status_site' ? defItem.status_site : '');
      btn.setAttribute('data-card-key', defItem.key);
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-busy', 'false');

      const countEl = document.createElement('div');
      countEl.className = 'status-card__count';
      countEl.textContent = '…';

      const labelEl = document.createElement('div');
      labelEl.className = 'status-card__label';
      labelEl.textContent = defItem.label || defItem.status_site || '';

      btn.appendChild(countEl);
      btn.appendChild(labelEl);

      attachCardHandler(btn, defItem);

      siteGroup.appendChild(btn);
      refs.set(defItem.key, { def: defItem, button: btn, countEl, labelEl });
    });

    // Append groups in order: delivery then site
    container.appendChild(deliveryGroup);
    if (siteList.length) container.appendChild(siteGroup);

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
        defItem.type === 'status_delivery'
          ? hasStatus && defItem.status_delivery === canonical
          : defItem.type === 'status_site'
          ? canonicalSite && defItem.status_site === canonicalSite
          : defItem.type === 'total'
          ? !hasStatus
          : false;
      ref.button.classList.toggle('active', isActive);
      ref.button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  async function refreshCounts(passedStats) {
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

    // Use provided stats (from search API). If none provided, use empty stats (no network calls).
    let stats = null;
    try {
      if (typeof passedStats === 'object' && passedStats !== null) {
        stats = passedStats;
      } else {
        stats = { counts: Object.create(null), total: null, lspSummary: [] };
      }
    } catch (err) {
      console.error('Error preparing stats', err);
      stats = { counts: Object.create(null), total: null, lspSummary: [] };
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

    function findCountForStatus(countsObj, statusKey) {
      if (!countsObj || !statusKey) return 0;
      if (Object.prototype.hasOwnProperty.call(countsObj, statusKey)) {
        const v = countsObj[statusKey];
        return Number.isFinite(Number(v)) ? Number(v) : 0;
      }
      try {
        for (const k of Object.keys(countsObj)) {
          try {
            const nk = normalizeStatusDeliveryValue(k) || String(k || '');
            if (nk && nk === statusKey) {
              const vv = countsObj[k];
              return Number.isFinite(Number(vv)) ? Number(vv) : 0;
            }
          } catch (e) {
            // ignore
          }
        }
      } catch (err) {
        console.error('Error iterating counts for match', err);
      }

      const normalizeLoose = (s) =>
        String(s || '')
          .toLowerCase()
          .replace(/[\u2013\u2014\/-]/g, ' ')
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      const targetLoose = normalizeLoose(statusKey);
      if (!targetLoose) return 0;
      for (const k of Object.keys(countsObj)) {
        const kk = normalizeLoose(k);
        if (kk === targetLoose) {
          const vv = countsObj[k];
          return Number.isFinite(Number(vv)) ? Number(vv) : 0;
        }
      }

      return 0;
    }

    refs.forEach((ref) => {
      const defItem = ref.def;
      if (!defItem) return;
      if (defItem.type === 'status_delivery') {
        const rawCount = findCountForStatus(counts, defItem.status_delivery);
        const displayCount = Number.isFinite(rawCount) ? rawCount : 0;
        ref.countEl.textContent = String(displayCount);
        ref.button.classList.remove('loading');
        ref.button.setAttribute('aria-busy', 'false');
        const label = getStatusDeliveryCardLabel(defItem);
        ref.button.setAttribute('aria-label', `${label} ${displayCount}`.trim());
      } else if (defItem.type === 'status_site') {
        const rawCount = findCountForStatus(counts, defItem.status_site);
        const displayCount = Number.isFinite(rawCount) ? rawCount : 0;
        ref.countEl.textContent = String(displayCount);
        ref.button.classList.remove('loading');
        ref.button.setAttribute('aria-busy', 'false');
        const label = defItem.label || defItem.status_site || '';
        ref.button.setAttribute('aria-label', `${label} ${displayCount}`.trim());
      } else {
        const displayCount = stats?.total;
        ref.countEl.textContent = String(displayCount);
        ref.button.classList.remove('loading');
        ref.button.setAttribute('aria-busy', 'false');
        const label = getStatusDeliveryCardLabel(defItem);
        ref.button.setAttribute('aria-label', `${label} ${displayCount}`.trim());
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
