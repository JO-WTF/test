const STATUS_ORDER = [
  'PREPARE VEHICLE',
  'ON THE WAY',
  'ON SITE',
  'POD',
  'REPLAN MOS PROJECT',
  'WAITING PIC FEEDBACK',
  'REPLAN MOS DUE TO LSP DELAY',
  'CLOSE BY RN',
  'CANCEL MOS',
  'NO STATUS',
  'TOTAL',
];

const API_BASE =
  (window.APP_CONFIG && window.APP_CONFIG.API_BASE) ||
  'https://back.idnsc.dpdns.org';

export function setupDashboardPage(rootEl) {
  if (!rootEl) return () => {};
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
    if (!RAW_ROWS.length) return;
    const rows = currentRows();
    const totals = computeTotals(RAW_ROWS);

    const meta = $('#meta');
    if (meta && RAW_ROWS[0]) {
      meta.textContent = `Date：${RAW_ROWS[0].date} ・ Total: ${totals[totals.length - 1]}`;
    }

    const podTotal = $('#podTotal');
    const replanTotal = $('#replanTotal');
    const closedTotal = $('#closedTotal');
    if (podTotal) podTotal.textContent = totals[3];
    if (replanTotal) replanTotal.textContent = totals[4] + totals[6];
    if (closedTotal) closedTotal.textContent = totals[7] + totals[8];

    const thead = $('#thead-row');
    if (thead) {
      thead.innerHTML = '';
      const thGroup = document.createElement('th');
      thGroup.className = 'sticky';
      thGroup.textContent = 'Region / Project';
      thGroup.dataset.key = 'group';
      thead.appendChild(thGroup);
      STATUS_ORDER.forEach((s, idx) => {
        const th = document.createElement('th');
        th.className = 'num';
        th.textContent = s;
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
          td.title = STATUS_ORDER[ci];
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
      th0.textContent = '合计';
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
            `<div><span class="label">${s}</span><span class="val ${
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
      const btn = $('#toggleZero');
      if (btn) {
        btn.classList.toggle('primary', mutedZero);
        btn.textContent = mutedZero ? 'Highlight Non-Zero' : 'Show All';
      }
      render();
    },
    { signal }
  );

  $('#dl')?.addEventListener(
    'click',
    () => {
      const rows = currentRows();
      const header = ['区域/项目', ...STATUS_ORDER].join(',');
      const lines = rows.map((r) => [r.group, ...r.values].join(','));
      const csv = [header, ...lines].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Deliveries_${new Date().toISOString().slice(0, 10)}.csv`;
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

  return () => {
    controller.abort();
  };
}
