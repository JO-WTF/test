import Viewer from 'viewerjs';

const API_BASE =
  (window.APP_CONFIG && window.APP_CONFIG.API_BASE) ||
  window.API_BASE ||
  window.location.origin;

export function setupAdminPage(rootEl, { i18n, applyTranslations }) {
  if (!rootEl) return () => {};

  const controller = new AbortController();
  const { signal } = controller;

  const el = (id) => rootEl.querySelector(`#${id}`);

  const duInput = el('f-du');
  const duHilite = el('du-hilite');
  const tbl = el('tbl');
  const tbody = tbl?.querySelector('tbody');
  const hint = el('hint');
  const pager = el('pager');
  const pginfo = el('pginfo');

  const mask = el('modal-mask');
  const mId = el('modal-id');
  const mStatus = el('m-status');
  const mRemark = el('m-remark');
  const mPhoto = el('m-photo');
  const mMsg = el('m-msg');

  let editingId = 0;

  const DU_RE_FULL = /^DID\d{13}$/;
  const DU_RE_HEAD = /^DID\d{0,13}$/;
  const q = { page: 1, page_size: 20, mode: 'single', lastParams: '' };

  const usp = new URLSearchParams(window.location.search);
  const actionsParam = usp.get('actions');
  const SHOW_ACTIONS_FINAL = actionsParam === '1';

  const applyAllTranslations = () => {
    if (typeof applyTranslations === 'function') {
      applyTranslations();
    }
    translateStatusCells();
  };

  function toAbsUrl(u) {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    const sep = u.startsWith('/') ? '' : '/';
    return `${API_BASE}${sep}${u}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function i18nStatusDisplay(raw) {
    const text = (raw || '').trim();
    if (!text) return '';
    const map = {
      '运输中': 'status.inTransit',
      '过夜': 'status.overnight',
      '已到达': 'status.arrived',
    };
    const key = map[text];
    if (i18n && key) {
      try {
        return i18n.t(key);
      } catch (err) {
        console.error(err);
      }
    }
    return text;
  }

  function normalizeRawSoft(raw) {
    return (raw || '').toUpperCase().replace(/\u200B|\uFEFF/g, '');
  }

  function buildDuHighlightHTML(raw) {
    const s = raw || '';
    if (!s) return '';
    const parts = s.split(/([,\s;]+)/g);
    const out = [];

    for (const chunk of parts) {
      if (!chunk) continue;

      if (/^[,\s;]+$/.test(chunk)) {
        out.push(`<span class="hl-sep">${escapeHtml(chunk)}</span>`);
        continue;
      }

      const token = chunk.trim();

      if (DU_RE_FULL.test(token)) {
        out.push(`<span class="hl-ok">${escapeHtml(chunk)}</span>`);
        continue;
      }

      if (DU_RE_HEAD.test(token)) {
        const digits = token.slice(3);
        if (digits.length === 0) {
          const letters = token.slice(0, Math.min(3, token.length));
          const want = 'DID';
          let html = '';
          for (let i = 0; i < 3; i++) {
            const ch = want[i];
            const active = i < letters.length && letters[i] === ch;
            html += `<span class="${active ? 'hl-did-act' : 'hl-did-inact'}">${ch}</span>`;
          }
          out.push(html);
        } else if (digits.length < 13) {
          out.push(`<span class="hl-bad">${escapeHtml(chunk)}</span>`);
        }
        continue;
      }

      out.push(`<span class="hl-bad">${escapeHtml(chunk)}</span>`);
    }

    out.push('<span class="hl-sep">\n</span>');
    return out.join('');
  }

  function toTokenList(raw) {
    const s = normalizeRawSoft(raw);
    const arr = s
      .split(/[\s,;]+/g)
      .map((v) => v.trim())
      .filter(Boolean);
    const valid = arr.filter((v) => !/^DID$/i.test(v));
    return Array.from(new Set(valid));
  }

  function renderTokens(tokens) {
    if (!duInput || !duHilite) return;
    duInput.value = (tokens || []).join('\n');
    duHilite.innerHTML = buildDuHighlightHTML(duInput.value);
  }

  function autoSeedNextDidIfNeeded() {
    if (!duInput) return;
    const val = duInput.value;
    const atEnd =
      duInput.selectionStart === val.length && duInput.selectionEnd === val.length;
    if (!atEnd) return;

    const parts = val.split(/([,\s;]+)/g);
    let lastToken = '';
    for (let i = parts.length - 1; i >= 0; i--) {
      const chunk = parts[i];
      if (!chunk || /^[,\s;]+$/.test(chunk)) continue;
      lastToken = chunk.trim();
      break;
    }
    if (!lastToken) return;

    if (DU_RE_FULL.test(lastToken)) {
      const needNL = !val.endsWith('\n');
      duInput.value = val + (needNL ? '\n' : '') + 'DID';
      try {
        duInput.selectionStart = duInput.selectionEnd = duInput.value.length;
      } catch (err) {
        console.error(err);
      }
    }
  }

  if (duInput) {
    duInput.addEventListener(
      'input',
      (e) => {
        const isDelete =
          e && typeof e.inputType === 'string' && e.inputType.startsWith('delete');

        const before = duInput.value;
        const after = normalizeRawSoft(before);
        if (after !== before) {
          const atEnd =
            duInput.selectionStart === before.length &&
            duInput.selectionEnd === before.length;
          duInput.value = after;
          if (atEnd) {
            try {
              duInput.selectionStart = duInput.selectionEnd = duInput.value.length;
            } catch (err) {
              console.error(err);
            }
          }
        }

        if (!isDelete) autoSeedNextDidIfNeeded();

        if (duHilite) duHilite.innerHTML = buildDuHighlightHTML(duInput.value);
      },
      { signal }
    );

    duInput.addEventListener(
      'paste',
      (e) => {
        try {
          const text = (e.clipboardData || window.clipboardData).getData('text');
          if (text != null) {
            e.preventDefault();
            const current = toTokenList(duInput.value);
            const pasted = toTokenList(text);
            const merged = Array.from(new Set(current.concat(pasted)));
            renderTokens(merged);
            try {
              duInput.selectionStart = duInput.selectionEnd = duInput.value.length;
            } catch (err) {
              console.error(err);
            }
          }
        } catch (err) {
          console.error(err);
        }
      },
      { signal }
    );

    duInput.addEventListener(
      'scroll',
      () => {
        if (!duHilite) return;
        duHilite.scrollTop = duInput.scrollTop;
        duHilite.scrollLeft = duInput.scrollLeft;
      },
      { signal }
    );
  }

  function buildParamsAuto() {
    const p = new URLSearchParams();
    const ids = toTokenList(duInput?.value || '');
    const ps = Number(el('f-ps2')?.value) || 20;
    q.page_size = ps;

    if (ids.length > 1) {
      ids.forEach((id) => p.append('du_id', id));
      q.mode = 'batch';
    } else {
      q.mode = 'single';
      const st = el('f-status')?.value;
      const rk = (el('f-remark')?.value || '').trim();
      const hp = el('f-has')?.value;
      const df = el('f-from')?.value;
      const dt = el('f-to')?.value;

      if (ids.length === 1) p.set('du_id', ids[0]);
      if (st) p.set('status', st);
      if (rk) p.set('remark', rk);
      if (hp) p.set('has_photo', hp);
      if (df) p.set('date_from', new Date(`${df}T00:00:00`).toISOString());
      if (dt) p.set('date_to', new Date(`${dt}T23:59:59`).toISOString());
    }

    p.set('page', q.page);
    p.set('page_size', q.page_size);
    return p.toString();
  }

  let viewer = null;
  const viewerHost = document.createElement('div');
  viewerHost.id = 'viewer-host';
  viewerHost.style.cssText =
    'position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;overflow:hidden;';
  document.body.appendChild(viewerHost);

  function openViewerWithUrl(url) {
    if (!url) return;
    viewerHost.innerHTML = `<img id="__vimg" alt="photo" data-src="${url}">`;
    const img = viewerHost.querySelector('#__vimg');

    if (viewer) {
      try {
        viewer.destroy();
      } catch (err) {
        console.error(err);
      }
      viewer = null;
    }

    viewer = new Viewer(img, {
      navbar: false,
      title: false,
      toolbar: false,
      fullscreen: false,
      movable: true,
      zoomRatio: 0.4,
      loading: true,
      backdrop: true,
      url(image) {
        return image.getAttribute('data-src');
      },
      hidden() {
        try {
          viewer?.destroy();
        } catch (err) {
          console.error(err);
        }
        viewer = null;
      },
    });
    try {
      viewer.show();
    } catch (err) {
      console.error(err);
    }
  }

  function renderRows(items) {
    if (!tbody) return;
    tbody.innerHTML = items
      .map((it) => {
        const t = it.created_at ? new Date(it.created_at).toLocaleString() : '';
        const remark = it.remark ? String(it.remark).replace(/[<>]/g, '') : '';
        const lonlat =
          it.lng && it.lat
            ? `<a href="https://www.google.com/maps?q=${it.lat},${it.lng}" target="_blank" data-i18n="table.view">${it.lat},${it.lng}</a>`
            : '-';

        const photoCell = it.photo_url
          ? `<a href="#" class="view-link" data-url="${toAbsUrl(it.photo_url)}" data-i18n="table.view">查看</a>`
          : '';

        const statusCell = `<td data-raw-status="${escapeHtml(it.status || '')}">${i18nStatusDisplay(
          it.status
        )}</td>`;

        const act = SHOW_ACTIONS_FINAL
          ? `<div class="actions">
             <button class="btn" data-act="edit" data-id="${it.id}" data-du="${it.du_id}"
                     data-status="${it.status || ''}" data-remark="${escapeHtml(remark)}" data-i18n="actions.edit">编辑</button>
             <button class="btn danger" data-act="del" data-id="${it.id}" data-i18n="actions.delete">删除</button>
           </div>`
          : '';

        return `<tr>
          <td>${it.id}</td>
          <td>${it.du_id}</td>
          ${statusCell}
          <td>${remark}</td>
          <td>${photoCell}</td>
          <td>${lonlat}</td>
          <td>${t}</td>
          <td>${act}</td>
        </tr>`;
      })
      .join('');
  }

  function bindRowActions() {
    if (!tbody) return;
    tbody.querySelectorAll('button[data-act]').forEach((btn) => {
      const act = btn.getAttribute('data-act');
      const id = Number(btn.getAttribute('data-id'));
      if (act === 'edit') {
        btn.addEventListener('click', () => {
          openModalEdit({
            id,
            du_id: btn.getAttribute('data-du') || '',
            status: btn.getAttribute('data-status') || '',
            remark: btn.getAttribute('data-remark') || '',
          });
        });
      } else if (act === 'del') {
        btn.addEventListener('click', () => onDelete(id));
      }
    });

    tbody.querySelectorAll('a.view-link[data-url]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const url = a.getAttribute('data-url');
        openViewerWithUrl(url);
      });
    });
  }

  async function fetchList() {
    if (!hint || !tbl || !pager || !pginfo) return;
    try {
      hint.textContent = '加载中…';
      tbl.style.display = 'none';
      pager.style.display = 'none';

      const params = buildParamsAuto();
      q.lastParams = params;

      const url = `${API_BASE}${q.mode === 'batch' ? '/api/du/batch?' : '/api/du/search?'}${params}`;
      const resp = await fetch(url);
      const text = await resp.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (err) {
        console.error(err);
      }
      if (!resp.ok) throw new Error((data && (data.detail || data.message)) || `HTTP ${resp.status}`);

      const items = Array.isArray(data?.items) ? data.items : [];
      renderRows(items);
      bindRowActions();
      applyAllTranslations();

      tbl.style.display = '';
      hint.textContent = items.length ? '' : '没有数据';

      const total = data?.total || 0;
      const pages = Math.max(1, Math.ceil(total / q.page_size));
      pginfo.textContent = `第 ${q.page} / ${pages} 页，共 ${total} 条`;
      pager.style.display = pages > 1 ? '' : 'none';
      const prev = el('prev');
      const next = el('next');
      if (prev) prev.disabled = q.page <= 1;
      if (next) next.disabled = q.page >= pages;
    } catch (err) {
      hint.textContent = `查询失败：${err?.message || err}`;
      tbl.style.display = 'none';
      pager.style.display = 'none';
    }
  }

  function openModalEdit(item) {
    editingId = Number(item.id);
    if (mId) mId.textContent = `#${editingId} / ${item.du_id || ''}`;
    if (mStatus) mStatus.value = item.status || '';
    if (mRemark) mRemark.value = item.remark || '';
    if (mPhoto) mPhoto.value = '';
    if (mMsg) mMsg.textContent = '';
    if (mask) mask.style.display = 'flex';
  }

  function closeModal() {
    if (mask) mask.style.display = 'none';
  }

  el('m-cancel')?.addEventListener('click', closeModal, { signal });

  el('m-save')?.addEventListener(
    'click',
    async () => {
      if (!editingId) return;
      if (mMsg) mMsg.textContent = '保存中…';
      try {
        const fd = new FormData();
        if (mStatus?.value) fd.append('status', mStatus.value);
        if (mRemark?.value) fd.append('remark', mRemark.value);
        if (mPhoto?.files && mPhoto.files[0]) fd.append('photo', mPhoto.files[0]);

        const resp = await fetch(`${API_BASE}/api/du/update/${editingId}`, {
          method: 'PUT',
          body: fd,
        });
        const text = await resp.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (err) {
          console.error(err);
        }
        if (!resp.ok)
          throw new Error((data && (data.detail || data.message)) || `HTTP ${resp.status}`);

        if (mMsg) mMsg.textContent = '保存成功';
        closeModal();
        await fetchList();
      } catch (err) {
        if (mMsg) mMsg.textContent = `保存失败：${err?.message || err}`;
      }
    },
    { signal }
  );

  async function onDelete(id) {
    if (!id) return;
    if (!window.confirm(`确认要删除记录 #${id} 吗？`)) return;
    if (hint) hint.textContent = `正在删除 #${id} …`;
    try {
      const resp = await fetch(`${API_BASE}/api/du/update/${id}`, { method: 'DELETE' });
      const text = await resp.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (err) {
        console.error(err);
      }
      if (!resp.ok)
        throw new Error((data && (data.detail || data.message)) || `HTTP ${resp.status}`);
      if (hint) hint.textContent = '删除成功';
      await fetchList();
    } catch (err) {
      if (hint) hint.textContent = `删除失败：${err?.message || err}`;
    }
  }

  function csvEscape(val) {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadCSV(rows, filename = 'du_all_results.csv') {
    const bom = '\uFEFF';
    const lines = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([bom + lines], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function toCsvRows(items) {
    const header = ['ID', 'DU ID', '状态', '备注', '照片URL', '时间'];
    const rows = [header];
    for (const it of items) {
      const t = it.created_at ? new Date(it.created_at).toLocaleString() : '';
      const remark = it.remark ? String(it.remark).replace(/[<>]/g, '') : '';
      const photo = it.photo_url ? toAbsUrl(it.photo_url) : '';
      rows.push([it.id, it.du_id, it.status || '', remark, photo, t]);
    }
    return rows;
  }

  async function exportAll() {
    if (!hint) return;
    try {
      hint.textContent = '正在导出全部数据，请稍候…';
      const per = q.page_size || 20;

      const p1 = new URLSearchParams(q.lastParams);
      p1.set('page', '1');
      p1.set('page_size', String(per));
      const firstUrl = `${API_BASE}${q.mode === 'batch' ? '/api/du/batch?' : '/api/du/search?'}${p1.toString()}`;

      const fResp = await fetch(firstUrl);
      const fRaw = await fResp.text();
      let fData = null;
      try {
        fData = fRaw ? JSON.parse(fRaw) : null;
      } catch (err) {
        console.error(err);
      }
      if (!fResp.ok)
        throw new Error((fData && (fData.detail || fData.message)) || `HTTP ${fResp.status}`);

      const total = fData?.total || 0;
      let items = Array.isArray(fData?.items) ? fData.items.slice() : [];
      const pages = Math.max(1, Math.ceil(total / per));

      for (let p = 2; p <= pages; p++) {
        const params = new URLSearchParams(q.lastParams);
        params.set('page', String(p));
        params.set('page_size', String(per));
        const url = `${API_BASE}${q.mode === 'batch' ? '/api/du/batch?' : '/api/du/search?'}${params.toString()}`;
        const r = await fetch(url);
        const raw = await r.text();
        let d = null;
        try {
          d = raw ? JSON.parse(raw) : null;
        } catch (err) {
          console.error(err);
        }
        if (!r.ok)
          throw new Error((d && (d.detail || d.message)) || `HTTP ${r.status}`);
        if (Array.isArray(d?.items)) items = items.concat(d.items);
      }

      if (!items.length) {
        window.alert('没有匹配的数据可导出。');
        hint.textContent = total ? '' : '没有数据';
        return;
      }
      downloadCSV(toCsvRows(items));
      hint.textContent = '';
    } catch (err) {
      hint.textContent = `导出失败：${err?.message || err}`;
    }
  }

  function translateStatusCells() {
    if (!tbody) return;
    tbody.querySelectorAll('td[data-raw-status]').forEach((td) => {
      const raw = td.getAttribute('data-raw-status') || '';
      td.textContent = i18nStatusDisplay(raw);
    });
  }

  el('btn-search')?.addEventListener(
    'click',
    () => {
      q.page = 1;
      fetchList();
    },
    { signal }
  );

  el('btn-reset')?.addEventListener(
    'click',
    () => {
      ['f-status', 'f-remark', 'f-has', 'f-from', 'f-to', 'f-ps2'].forEach((id) => {
        const node = el(id);
        if (node) node.value = id === 'f-ps2' ? '20' : '';
      });
      renderTokens(['DID']);
      q.page = 1;
      fetchList();
    },
    { signal }
  );

  el('prev')?.addEventListener(
    'click',
    () => {
      if (q.page > 1) {
        q.page--;
        fetchList();
      }
    },
    { signal }
  );

  el('next')?.addEventListener(
    'click',
    () => {
      q.page++;
      fetchList();
    },
    { signal }
  );

  const exportAllBtn = el('btn-export-all');
  exportAllBtn?.addEventListener(
    'click',
    async () => {
      if (!exportAllBtn) return;
      exportAllBtn.disabled = true;
      try {
        await exportAll();
      } finally {
        exportAllBtn.disabled = false;
      }
    },
    { signal }
  );

  el('btn-trust-backend-link')?.addEventListener(
    'click',
    () => {
      window.open(String(API_BASE).replace(/\/+$/, ''), '_blank');
    },
    { signal }
  );

  function init() {
    if (!duInput?.value.trim()) renderTokens(['DID']);
    if (hint) hint.textContent = '输入条件后点击查询。';
    fetchList();
  }

  init();
  applyAllTranslations();

  return () => {
    controller.abort();
    if (viewer) {
      try {
        viewer.destroy();
      } catch (err) {
        console.error(err);
      }
    }
    viewer = null;
    viewerHost.remove();
  };
}
