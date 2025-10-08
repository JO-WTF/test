import { getApiBase } from '../../utils/env.js';
import { 
  STATUS_DELIVERY_VALUES, 
  STATUS_TRANSLATION_KEYS,
  STATUS_ALIAS_MAP 
} from '../../config.js';

// Dashboard 页面状态顺序定义
// 注意：这里定义的是显示顺序，实际状态值来自 STATUS_DELIVERY_VALUES
// 后端返回的各种格式会通过 STATUS_ALIAS_MAP 自动映射到标准值
const STATUS_ORDER = [
  STATUS_DELIVERY_VALUES.NEW_MOS,
  STATUS_DELIVERY_VALUES.PREPARE_VEHICLE,
  STATUS_DELIVERY_VALUES.ON_THE_WAY,
  STATUS_DELIVERY_VALUES.ON_SITE,
  STATUS_DELIVERY_VALUES.POD,
  STATUS_DELIVERY_VALUES.REPLAN_MOS_PROJECT,
  STATUS_DELIVERY_VALUES.WAITING_PIC_FEEDBACK,
  STATUS_DELIVERY_VALUES.REPLAN_MOS_LSP_DELAY,
  STATUS_DELIVERY_VALUES.CLOSE_BY_RN,
  STATUS_DELIVERY_VALUES.CANCEL_MOS,
  'TOTAL',  // TOTAL 是特殊值，不是状态
];

// 状态到翻译键的映射
const STATUS_LABEL_KEYS = {
  [STATUS_DELIVERY_VALUES.NEW_MOS]: 'status.newMos',
  [STATUS_DELIVERY_VALUES.PREPARE_VEHICLE]: 'status.prepareVehicle',
  [STATUS_DELIVERY_VALUES.ON_THE_WAY]: 'status.onTheWay',
  [STATUS_DELIVERY_VALUES.ON_SITE]: 'status.onSite',
  [STATUS_DELIVERY_VALUES.POD]: 'status.pod',
  [STATUS_DELIVERY_VALUES.REPLAN_MOS_PROJECT]: 'status.replanProject',
  [STATUS_DELIVERY_VALUES.WAITING_PIC_FEEDBACK]: 'status.waitingFeedback',
  [STATUS_DELIVERY_VALUES.REPLAN_MOS_LSP_DELAY]: 'status.replanLspDelay',
  [STATUS_DELIVERY_VALUES.CLOSE_BY_RN]: 'status.closeByRn',
  [STATUS_DELIVERY_VALUES.CANCEL_MOS]: 'status.cancelMos',
  'TOTAL': 'status.total',
};

const STATUS_INDEX = STATUS_ORDER.reduce((acc, key, idx) => {
  acc[key] = idx;
  return acc;
}, {});

const API_BASE = getApiBase();

export function setupDashboardPage(rootEl, opts = {}) {
  if (!rootEl) {
    return {
      destroy() {},
      updateI18n() {},
    };
  }
  const controller = new AbortController();
  const { signal } = controller;

  const $ = (sel) => rootEl.querySelector(sel);
  const $$ = (sel) => Array.from(rootEl.querySelectorAll(sel));

  const loadingElement = $('#loading');
  const datePicker = $('#datePicker');

  let mutedZero = true;
  let sortKey = 'group';
  let sortDir = 'asc';
  let query = '';
  let RAW_ROWS = [];

  const applyVars = (str, vars) => {
    if (!vars) return str;
    return String(str).replace(/\{(\w+)\}/g, (_, k) =>
      Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`
    );
  };

  const defaultTranslate = (key, vars) => applyVars(key, vars);

  let translateFn = typeof opts.t === 'function' ? opts.t : defaultTranslate;

  const setTranslator = (fn) => {
    translateFn = typeof fn === 'function' ? fn : defaultTranslate;
  };

  const translate = (key, vars, fallback) => {
    if (!key) return fallback ?? '';
    const res = translateFn(key, vars);
    if (typeof res === 'string' && res !== key) return res;
    if (fallback != null) return applyVars(fallback, vars);
    return typeof res === 'string' ? applyVars(res, vars) : fallback ?? key;
  };

  const statusLabel = (status) => {
    const key = STATUS_LABEL_KEYS[status];
    return key ? translate(key, undefined, status) : status;
  };

  const updateToggleZeroButton = () => {
    const btn = $('#toggleZero');
    if (!btn) return;
    btn.classList.toggle('primary', mutedZero);
    const labelKey = mutedZero ? 'controls.highlightNonZero' : 'controls.showAll';
    const fallback = mutedZero ? 'Highlight Non-Zero' : 'Show All';
    btn.textContent = translate(labelKey, undefined, fallback);
  };

  function fmtDate(iso) {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }

  function computeTotals(rows) {
    const sums = new Array(STATUS_ORDER.length).fill(0);
    rows.forEach((r) => r.values.forEach((v, i) => (sums[i] += v)));
    return sums;
  }

  function currentRows() {
    const q = query.trim().toLowerCase();
    let rows = RAW_ROWS.filter((r) => (q ? r.group.toLowerCase().includes(q) : true));
    rows = rows.slice().sort((a, b) => {
      if (sortKey === 'group')
        return sortDir === 'asc'
          ? a.group.localeCompare(b.group)
          : b.group.localeCompare(a.group);
      const i = Number(sortKey);
      const av = a.values[i] ?? 0;
      const bv = b.values[i] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return rows;
  }

  function render() {
    updateToggleZeroButton();
    if (!RAW_ROWS.length) return;
    const rows = currentRows();
    const totals = computeTotals(RAW_ROWS);

    const meta = $('#meta');
    if (meta && RAW_ROWS[0]) {
      meta.textContent = translate(
        'meta',
        { date: RAW_ROWS[0].date, total: totals[totals.length - 1] },
        'Date: {date} ・ Total: {total}'
      );
    }

    const podTotal = $('#podTotal');
    const replanTotal = $('#replanTotal');
    const closedTotal = $('#closedTotal');
    const idxPod = STATUS_INDEX[STATUS_DELIVERY_VALUES.POD] ?? STATUS_ORDER.indexOf(STATUS_DELIVERY_VALUES.POD);
    if (podTotal) podTotal.textContent = totals[idxPod] ?? 0;

    const idxReplanProject = STATUS_INDEX[STATUS_DELIVERY_VALUES.REPLAN_MOS_PROJECT] ?? STATUS_ORDER.indexOf(STATUS_DELIVERY_VALUES.REPLAN_MOS_PROJECT);
    const idxReplanLsp = STATUS_INDEX[STATUS_DELIVERY_VALUES.REPLAN_MOS_LSP_DELAY] ?? STATUS_ORDER.indexOf(STATUS_DELIVERY_VALUES.REPLAN_MOS_LSP_DELAY);
    if (replanTotal)
      replanTotal.textContent = (totals[idxReplanProject] ?? 0) + (totals[idxReplanLsp] ?? 0);

    const idxCloseRn = STATUS_INDEX[STATUS_DELIVERY_VALUES.CLOSE_BY_RN] ?? STATUS_ORDER.indexOf(STATUS_DELIVERY_VALUES.CLOSE_BY_RN);
    const idxCancel = STATUS_INDEX[STATUS_DELIVERY_VALUES.CANCEL_MOS] ?? STATUS_ORDER.indexOf(STATUS_DELIVERY_VALUES.CANCEL_MOS);
    if (closedTotal) closedTotal.textContent = (totals[idxCloseRn] ?? 0) + (totals[idxCancel] ?? 0);

    const thead = $('#thead-row');
    if (thead) {
      thead.innerHTML = '';
      const thGroup = document.createElement('th');
      thGroup.className = 'sticky';
      thGroup.textContent = translate('table.regionProject', undefined, 'Region / Project');
      thGroup.dataset.key = 'group';
      thead.appendChild(thGroup);
      STATUS_ORDER.forEach((s, idx) => {
        const th = document.createElement('th');
        th.className = 'num';
        th.textContent = statusLabel(s);
        th.dataset.key = String(idx);
        thead.appendChild(th);
      });
      $$('thead th').forEach((th) => {
        th.style.cursor = 'pointer';
        th.onclick = () => onSort(th.dataset.key);
      });
      decorateSortIndicators();
    }

    const tb = $('#tbody');
    if (tb) {
      tb.innerHTML = '';
      rows.forEach((row) => {
        const tr = document.createElement('tr');
        const td0 = document.createElement('td');
        td0.className = 'sticky';
        const [projectName] = row.group.split(' ');
        td0.innerHTML = `<span class="chip">${projectName}</span> <span style="margin-left:6px; white-space: nowrap;">${row.group.replace(
          projectName,
          ''
        )}</span>`;
        tr.appendChild(td0);
        row.values.forEach((v, ci) => {
          const td = document.createElement('td');
          td.className = 'num';
          td.title = statusLabel(STATUS_ORDER[ci]);
          if (mutedZero && v === 0) td.classList.add('muted');
          if (v > 0 && ci === 3) td.style.fontWeight = '700';
          td.textContent = v;
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
    }

    const tf = $('#tfoot-row');
    if (tf) {
      tf.innerHTML = '';
      const th0 = document.createElement('th');
      th0.className = 'sticky';
      th0.textContent = translate('table.total', undefined, 'Total');
      tf.appendChild(th0);
      totals.forEach((t) => {
        const th = document.createElement('th');
        th.className = 'num';
        th.textContent = t;
        tf.appendChild(th);
      });
    }

    const cards = $('#cards');
    if (cards) {
      cards.innerHTML = '';
      rows.forEach((row) => {
        const div = document.createElement('div');
        div.className = 'rowcard';
        const tag = row.group.includes('IOH')
          ? 'IOH'
          : row.group.includes('TSEL')
          ? 'TSEL'
          : 'XLS';
        const kv = STATUS_ORDER.map(
          (s, i) =>
            `<div><span class="label">${statusLabel(s)}</span><span class="val ${
              mutedZero && row.values[i] === 0 ? 'muted' : ''
            }">${row.values[i]}</span></div>`
        ).join('');
        div.innerHTML = `
        <div class="head">
          <div><span class="chip">${tag}</span> <strong style="margin-left:6px;">${row.group}</strong></div>
          <small style="color:#64748b">${fmtDate(row.date)}</small>
        </div>
        <div class="kv">${kv}</div>`;
        cards.appendChild(div);
      });
    }
  }

  function decorateSortIndicators() {
    $$('thead th').forEach((th) => {
      const key = th.dataset.key;
      if (!key) return;
      const arrow = sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      const base = th.textContent.replace(/[ ▲▼]+$/, '');
      th.textContent = base + arrow;
    });
  }

  function onSort(key) {
    if (!key) return;
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else {
      sortKey = key;
      sortDir = key === 'group' ? 'asc' : 'desc';
    }
    render();
  }

  function getCurrentDate(offsetDays = 0) {
    const today = new Date();
    today.setDate(today.getDate() + offsetDays);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(today.getDate()).padStart(2, '0');
    const month = months[today.getMonth()];
    const year = String(today.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  }

  function populateDatePicker() {
    if (!datePicker) return;
    datePicker.innerHTML = '';
    for (let i = -5; i <= 5; i++) {
      const option = document.createElement('option');
      const dateStr = getCurrentDate(i);
      option.value = dateStr;
      option.textContent = dateStr;
      if (i === 0) option.selected = true;
      datePicker.appendChild(option);
    }
  }

  async function loadData(date) {
    if (!loadingElement) return;
    loadingElement.style.visibility = 'visible';
    try {
      const base = API_BASE.replace(/\/+$/, '');
      const response = await fetch(`${base}/api/dn/stats/${date}`);
      const data = await response.json();
      RAW_ROWS = Array.isArray(data?.data) ? data.data : [];
      render();
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      loadingElement.style.visibility = 'hidden';
    }
  }

  $('#q')?.addEventListener(
    'input',
    (e) => {
      query = e.target.value;
      render();
    },
    { signal }
  );

  $('#toggleZero')?.addEventListener(
    'click',
    () => {
      mutedZero = !mutedZero;
      updateToggleZeroButton();
      render();
    },
    { signal }
  );

  $('#dl')?.addEventListener(
    'click',
    () => {
      const rows = currentRows();
      const header = [
        translate('csv.regionProject', undefined, 'Region / Project'),
        ...STATUS_ORDER.map((status) => statusLabel(status)),
      ].join(',');
      const lines = rows.map((r) => [r.group, ...r.values].join(','));
      const csv = [header, ...lines].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const prefix = translate('csv.fileNamePrefix', undefined, 'Deliveries');
      a.download = `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    { signal }
  );

  datePicker?.addEventListener(
    'change',
    async (e) => {
      await loadData(e.target.value);
    },
    { signal }
  );

  populateDatePicker();
  const initialDate = datePicker?.value || getCurrentDate();
  loadData(initialDate);

  return {
    destroy() {
      controller.abort();
    },
    updateI18n(newOpts = {}) {
      if (newOpts.t) setTranslator(newOpts.t);
      updateToggleZeroButton();
      render();
    },
  };
}
