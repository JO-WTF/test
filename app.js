// admin 管理脚本（编辑 / 删除 / 批量查询 / 导出）
(function(){
  const API_BASE = window.API_BASE || location.origin; // 默认同源
  const el = id => document.getElementById(id);

  const tbl = el('tbl');
  const tbody = tbl.querySelector('tbody');
  const hint = el('hint');
  const pager = el('pager');
  const pginfo = el('pginfo');

  // 查询上下文（复用分页）
  const q = { page: 1, page_size: 20, mode: 'single', lastParams: '' };
  // mode: 'single' 使用 /api/du/search，'batch' 使用 /api/du/batch

  function toAbsUrl(u){
    if(!u) return "";
    if(/^https?:\/\//i.test(u)) return u;
    const sep = u.startsWith("/") ? "" : "/";
    return `${API_BASE}${sep}${u}`;
  }

  // ============ 单条件查询参数 ============
  function buildParamsSingle(){
    const p = new URLSearchParams();
    const du = el('f-du').value.trim();
    const st = el('f-status').value;
    const rk = el('f-remark').value.trim();
    const hp = el('f-has').value;
    const df = el('f-from').value;
    const dt = el('f-to').value;
    const ps = Number(el('f-ps2').value) || 20;

    if(du) p.set('du_id', du);
    if(st) p.set('status', st);
    if(rk) p.set('remark', rk);
    if(hp) p.set('has_photo', hp);
    if(df){ p.set('date_from', new Date(df + "T00:00:00").toISOString()); }
    if(dt){ p.set('date_to', new Date(dt + "T23:59:59").toISOString()); }
    q.page_size = ps;
    p.set('page', q.page);
    p.set('page_size', q.page_size);
    return p.toString();
  }

  // ============ 批量查询参数 ============
  function parseMultiDu(){
    const raw = el('f-du-multi').value || '';
    const list = raw.split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean);
    return Array.from(new Set(list)); // 去重
  }
  function buildParamsBatch(){
    const p = new URLSearchParams();
    const ids = parseMultiDu();
    const ps = Number(el('f-ps').value) || 20;
    q.page_size = ps;
    if(!ids.length){ return ''; }
    for(const id of ids){ p.append('du_id', id); }
    p.set('page', q.page);
    p.set('page_size', q.page_size);
    return p.toString();
  }

  // ============ 通用渲染 ============
  function renderRows(items){
    tbody.innerHTML = items.map(it=>{
      const t = it.created_at ? new Date(it.created_at).toLocaleString() : '';
      const link = it.photo_url ? `<a href="${toAbsUrl(it.photo_url)}" target="_blank">查看</a>` : '';
      const remark = it.remark ? String(it.remark).replace(/[<>]/g,'') : '';
      const act = `
        <div class="actions">
          <button class="btn" data-act="edit" data-id="${it.id}" data-du="${it.du_id}" data-status="${it.status||''}" data-remark="${remark}">编辑</button>
          <button class="btn danger" data-act="del" data-id="${it.id}">删除</button>
        </div>`;
      return `<tr>
        <td>${it.id}</td>
        <td>${it.du_id}</td>
        <td>${it.status||''}</td>
        <td>${remark}</td>
        <td>${link}</td>
        <td>${t}</td>
        <td>${act}</td>
      </tr>`;
    }).join('');
  }

  function bindRowActions(){
    tbody.querySelectorAll('button[data-act]').forEach(btn=>{
      const act = btn.getAttribute('data-act');
      const id = Number(btn.getAttribute('data-id'));
      if(act === 'edit'){
        btn.onclick = () => openModalEdit({
          id,
          du_id: btn.getAttribute('data-du') || '',
          status: btn.getAttribute('data-status') || '',
          remark: btn.getAttribute('data-remark') || ''
        });
      }else if(act === 'del'){
        btn.onclick = () => onDelete(id);
      }
    });
  }

  // ============ 拉取数据 ============
  async function fetchList(){
    try{
      hint.textContent = '加载中…';
      tbl.style.display = 'none';
      pager.style.display = 'none';

      let url = '';
      if(q.mode === 'batch'){
        const params = buildParamsBatch();
        if(!params){ hint.textContent = '请先填写批量 DU ID'; return; }
        q.lastParams = params;
        url = `${API_BASE}/api/du/batch?${params}`;
      }else{
        const params = buildParamsSingle();
        q.lastParams = params;
        url = `${API_BASE}/api/du/search?${params}`;
      }

      const resp = await fetch(url);
      const text = await resp.text();
      let data = null; try{ data = text ? JSON.parse(text) : null }catch{}
      if(!resp.ok){ throw new Error((data && (data.detail||data.message)) || ('HTTP '+resp.status)); }

      const items = Array.isArray(data?.items) ? data.items : [];
      renderRows(items);
      bindRowActions();

      tbl.style.display = '';
      hint.textContent = items.length ? '' : '没有数据';

      const total = data?.total || 0;
      const pages = Math.max(1, Math.ceil(total / q.page_size));
      pginfo.textContent = `第 ${q.page} / ${pages} 页，共 ${total} 条`;
      pager.style.display = (pages > 1) ? '' : 'none';
      el('prev').disabled = (q.page <= 1);
      el('next').disabled = (q.page >= pages);
    }catch(err){
      hint.textContent = '查询失败：' + (err?.message || err);
      tbl.style.display = 'none';
      pager.style.display = 'none';
    }
  }

  // ============ 编辑弹窗 ============
  const mask = el('modal-mask');
  const mId = el('modal-id');
  const mStatus = el('m-status');
  const mRemark = el('m-remark');
  const mPhoto = el('m-photo');
  const mMsg = el('m-msg');
  let editingId = 0;

  function openModalEdit(item){
    editingId = Number(item.id);
    mId.textContent = `#${editingId} / ${item.du_id||''}`;
    mStatus.value = item.status || '';
    mRemark.value = item.remark || '';
    mPhoto.value = '';
    mMsg.textContent = '';
    mask.style.display = 'flex';
  }
  function closeModal(){ mask.style.display = 'none'; }

  el('m-cancel').onclick = closeModal;
  el('m-save').onclick = async ()=>{
    if(!editingId) return;
    mMsg.textContent = '保存中…';
    try{
      const fd = new FormData();
      if(mStatus.value) fd.append('status', mStatus.value);
      if(mRemark.value) fd.append('remark', mRemark.value);
      if(mPhoto.files && mPhoto.files[0]) fd.append('photo', mPhoto.files[0]);

      const resp = await fetch(`${API_BASE}/api/du/update/${editingId}`, { method:'PUT', body: fd });
      const text = await resp.text();
      let data=null; try{ data = text ? JSON.parse(text) : null }catch{}
      if(!resp.ok){ throw new Error((data && (data.detail||data.message)) || ('HTTP '+resp.status)); }

      mMsg.textContent = '保存成功';
      closeModal();
      await fetchList(); // 刷新当前页
    }catch(err){
      mMsg.textContent = '保存失败：' + (err?.message || err);
    }
  };

  // ============ 删除 ============
  async function onDelete(id){
    if(!id) return;
    if(!confirm(`确认要删除记录 #${id} 吗？`)) return;
    hint.textContent = `正在删除 #${id} …`;
    try{
      const resp = await fetch(`${API_BASE}/api/du/update/${id}`, { method:'DELETE' });
      const text = await resp.text();
      let data=null; try{ data = text ? JSON.parse(text) : null }catch{}
      if(!resp.ok){ throw new Error((data && (data.detail||data.message)) || ('HTTP '+resp.status)); }
      hint.textContent = '删除成功';
      await fetchList();
    }catch(err){
      hint.textContent = '删除失败：' + (err?.message || err);
    }
  }

  // ============ 导出全部 ============
  function csvEscape(val){
    if(val === null || val === undefined) return '';
    const s = String(val);
    if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }
  function downloadCSV(rows, filename='du_export.csv'){
    const bom = '\uFEFF';
    const lines = rows.map(r => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([bom + lines], {type: 'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }
  function toCsvRows(items){
    const header = ['ID','DU ID','状态','备注','照片URL','时间'];
    const rows = [header];
    for(const it of items){
      const t = it.created_at ? new Date(it.created_at).toLocaleString() : '';
      const remark = it.remark ? String(it.remark).replace(/[<>]/g,'') : '';
      const photo = it.photo_url ? toAbsUrl(it.photo_url) : '';
      rows.push([it.id, it.du_id, it.status||'', remark, photo, t]);
    }
    return rows;
  }
  async function exportAll(){
    try{
      hint.textContent = '正在导出全部数据，请稍候…';

      const per = q.page_size || 20;
      // 先取首页
      let firstUrl = '';
      if(q.mode === 'batch'){
        const p = new URLSearchParams(q.lastParams);
        p.set('page','1'); p.set('page_size', String(per));
        firstUrl = `${API_BASE}/api/du/batch?${p.toString()}`;
      }else{
        const p = new URLSearchParams(q.lastParams);
        p.set('page','1'); p.set('page_size', String(per));
        firstUrl = `${API_BASE}/api/du/search?${p.toString()}`;
      }

      const fResp = await fetch(firstUrl);
      const fRaw = await fResp.text();
      let fData=null; try{ fData = fRaw ? JSON.parse(fRaw) : null }catch{}
      if(!fResp.ok){ throw new Error((fData && (fData.detail||fData.message)) || ('HTTP '+fResp.status)); }

      const total = fData?.total || 0;
      let items = Array.isArray(fData?.items) ? fData.items.slice() : [];
      const pages = Math.max(1, Math.ceil(total / per));

      for(let p=2; p<=pages; p++){
        const params = new URLSearchParams(q.lastParams);
        params.set('page', String(p)); params.set('page_size', String(per));
        const url = `${API_BASE}${q.mode==='batch'?'/api/du/batch?':'/api/du/search?'}${params.toString()}`;
        const r = await fetch(url);
        const raw = await r.text();
        let d=null; try{ d = raw ? JSON.parse(raw) : null }catch{}
        if(!r.ok){ throw new Error((d && (d.detail||d.message)) || ('HTTP '+r.status)); }
        if(Array.isArray(d?.items)) items = items.concat(d.items);
      }

      if(!items.length){
        alert('没有匹配的数据可导出。');
        hint.textContent = total ? '' : '没有数据';
        return;
      }
      downloadCSV(toCsvRows(items), 'du_all_results.csv');
      hint.textContent = '';
    }catch(err){
      hint.textContent = '导出失败：' + (err?.message || err);
    }
  }

  // ============ 事件绑定 ============
  el('btn-search').onclick = ()=>{ q.mode='single'; q.page=1; fetchList(); };
  el('btn-reset').onclick = ()=>{
    ['f-du','f-status','f-remark','f-has','f-from','f-to','f-ps2'].forEach(id=>{
      const n = el(id);
      n.value = (id==='f-ps2') ? '20' : '';
    });
    q.mode='single'; q.page=1; fetchList();
  };
  el('prev').onclick = ()=>{ if(q.page>1){ q.page--; fetchList(); }};
  el('next').onclick = ()=>{ q.page++; fetchList(); };

  el('btn-batch').onclick = ()=>{ q.mode='batch'; q.page=1; fetchList(); };

  const exportAllBtn = el('btn-export-all');
  exportAllBtn.onclick = async () => { exportAllBtn.disabled=true; try{ await exportAll(); } finally { exportAllBtn.disabled=false; } };

  const trustBackendLinkBtn = el('btn-trust-backend-link');
  trustBackendLinkBtn.onclick = () => window.open(API_BASE.replace(/\/+$/,''), "_blank");

  // 初始进入展示空态
  hint.textContent = '输入条件后点击查询。';
})();
