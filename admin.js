// admin.js — 管理页脚本（单/多 DU 自动识别 + DID 自动脚手架 + 高亮不重影 + 自动换行 + 粘贴合并 + 删除不强填）
// 仅依赖 admin.html 中的 DOM；无需第三方库。

(function () {
  const API_BASE = window.API_BASE || location.origin;
  const el = (id) => document.getElementById(id);

  // ====== DOM ======
  const duInput  = el("f-du");
  const duHilite = el("du-hilite");
  const tbl = el("tbl");
  const tbody = tbl.querySelector("tbody");
  const hint = el("hint");
  const pager = el("pager");
  const pginfo = el("pginfo");

  // 编辑弹窗
  const mask = el("modal-mask");
  const mId = el("modal-id");
  const mStatus = el("m-status");
  const mRemark = el("m-remark");
  const mPhoto = el("m-photo");
  const mMsg = el("m-msg");
  let editingId = 0;

  // ====== 常量 / 状态 ======
  const DU_RE = /^DID\d{13}$/; // 合法：DID + 13 位数字
  const q = { page: 1, page_size: 20, mode: "single", lastParams: "" };

  // ====== 工具 ======
  function toAbsUrl(u) {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    const sep = u.startsWith("/") ? "" : "/";
    return `${API_BASE}${sep}${u}`;
  }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // 规范：大写 + 清理零宽/BOM。可选是否“强制脚手架 DID”（在非删除时）
  function normalizeRaw(raw, { scaffold = true } = {}) {
    let s = (raw || "").toUpperCase().replace(/\u200B|\uFEFF/g, "");
    if (!scaffold) return s;
    if (!s) return "DID";
    if (!s.startsWith("DID")) s = "DID" + s;
    // 在分隔符（逗号/空白）后若不是 DID 开头，自动补 DID
    s = s.replace(/([,\s]+)(?!DID)/g, "$1DID");
    return s;
  }

  // 高亮层：只渲染背景，不渲染文字颜色，避免与 textarea 叠加重影
  function buildDuHighlightHTML(raw) {
    const s = raw || "";
    if (!s) return "";
    const parts = s.split(/([,\s;]+)/g);
    const out = [];
    for (const chunk of parts) {
      if (!chunk) continue;
      if (/^[,\s;]+$/.test(chunk)) {
        out.push(`<span class="hl-sep">${escapeHtml(chunk)}</span>`);
      } else {
        const token = chunk.trim();
        const ok = DU_RE.test(token);
        out.push(`<span class="${ok ? "hl-ok" : "hl-bad"}">${escapeHtml(chunk)}</span>`);
      }
    }
    // 占位换行，帮助底层高度对齐
    out.push('<span class="hl-sep">\n</span>');
    return out.join("");
  }

  // 解析为去重后的 token 列表（DIDxxxx...）
  function toTokenList(raw) {
    const s = normalizeRaw(raw, { scaffold: true });
    const arr = s.split(/[\s,;]+/g).map(v => v.trim()).filter(Boolean);
    return Array.from(new Set(arr));
  }

  // 将 token 列表渲染到输入框（按换行拼接）
  function renderTokens(tokens) {
    duInput.value = (tokens || []).join("\n");
    duHilite.innerHTML = buildDuHighlightHTML(duInput.value);
  }

  // ====== 自动换行：当光标在末尾，并且最后一个 token 已满足 DU_RE，则补 "\nDID"
  function autoBreakAndSeedDidIfNeeded() {
    const val = duInput.value;
    const caretAtEnd = duInput.selectionStart === val.length && duInput.selectionEnd === val.length;
    if (!caretAtEnd) return; // 仅在末尾输入时触发

    // 找到最后一个非空 token
    const parts = val.split(/([,\s;]+)/g);
    let lastToken = "";
    for (let i = parts.length - 1; i >= 0; i--) {
      const chunk = parts[i];
      if (!chunk || /^[,\s;]+$/.test(chunk)) continue;
      lastToken = chunk.trim();
      break;
    }
    if (!lastToken) return;

    if (DU_RE.test(lastToken)) {
      // 末尾如果已经有分隔符或另一个 DID 就不重复插入
      if (!/(?:[,\s]|^)$/.test(val.slice(-1))) {
        duInput.value = val + "\nDID";
        try { duInput.selectionStart = duInput.selectionEnd = duInput.value.length; } catch {}
      }
    }
  }

  // ====== 输入事件：区分“删除/退格”与“插入/输入”
  duInput.addEventListener("input", (e) => {
    const isDelete = (e && typeof e.inputType === "string" && e.inputType.startsWith("delete"));
    const before = duInput.value;

    // 删除时：不做脚手架（防止强制回填），只做大写和清理零宽
    let after = normalizeRaw(before, { scaffold: !isDelete });

    if (after !== before) {
      const atEnd = duInput.selectionStart === before.length && duInput.selectionEnd === before.length;
      duInput.value = after;
      if (atEnd) {
        try { duInput.selectionStart = duInput.selectionEnd = duInput.value.length; } catch {}
      }
    }

    // 非删除输入：检查是否需要自动换行并续写 DID
    if (!isDelete) autoBreakAndSeedDidIfNeeded();

    // 更新高亮
    duHilite.innerHTML = buildDuHighlightHTML(duInput.value);
  });

  // ====== 粘贴合并：把剪贴板里的内容解析成 token，与现有合并去重
  duInput.addEventListener("paste", (e) => {
    try {
      const text = (e.clipboardData || window.clipboardData).getData("text");
      if (text != null) {
        e.preventDefault();
        const current = toTokenList(duInput.value);
        const pasted = toTokenList(text);        // 粘贴时自带 DID 也会被识别
        const merged = Array.from(new Set(current.concat(pasted)));
        renderTokens(merged);
        try { duInput.selectionStart = duInput.selectionEnd = duInput.value.length; } catch {}
      }
    } catch {
      /* 忽略粘贴异常，走默认行为 */
    }
  });

  // 同步滚动：textarea 滚动 -> 高亮层跟随
  duInput.addEventListener("scroll", () => {
    duHilite.scrollTop  = duInput.scrollTop;
    duHilite.scrollLeft = duInput.scrollLeft;
  });

  // ====== 查询参数构建（自动单/多模式）======
  function parseDuInput() {
    return toTokenList(duInput.value);
  }
  function buildParamsAuto() {
    const p = new URLSearchParams();
    const ids = parseDuInput();
    const ps = Number(el("f-ps2").value) || 20;
    q.page_size = ps;

    if (ids.length > 1) {
      ids.forEach(id => p.append("du_id", id));
      q.mode = "batch";
    } else {
      q.mode = "single";
      const st = el("f-status").value;
      const rk = el("f-remark").value.trim();
      const hp = el("f-has").value;
      const df = el("f-from").value;
      const dt = el("f-to").value;

      if (ids.length === 1) p.set("du_id", ids[0]);
      if (st) p.set("status", st);
      if (rk) p.set("remark", rk);
      if (hp) p.set("has_photo", hp);
      if (df) p.set("date_from", new Date(df + "T00:00:00").toISOString());
      if (dt) p.set("date_to", new Date(dt + "T23:59:59").toISOString());
    }

    p.set("page", q.page);
    p.set("page_size", q.page_size);
    return p.toString();
  }

  // ====== 列表渲染与请求 ======
  function renderRows(items) {
    tbody.innerHTML = items.map(it => {
      const t = it.created_at ? new Date(it.created_at).toLocaleString() : "";
      const link = it.photo_url ? `<a href="${toAbsUrl(it.photo_url)}" target="_blank">查看</a>` : "";
      const remark = it.remark ? String(it.remark).replace(/[<>]/g,"") : "";
      const act = `
        <div class="actions">
          <button class="btn" data-act="edit" data-id="${it.id}" data-du="${it.du_id}" data-status="${it.status||''}" data-remark="${escapeHtml(remark)}">编辑</button>
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
  function bindRowActions() {
    tbody.querySelectorAll("button[data-act]").forEach(btn => {
      const act = btn.getAttribute("data-act");
      const id = Number(btn.getAttribute("data-id"));
      if (act === "edit") {
        btn.onclick = () => openModalEdit({
          id,
          du_id: btn.getAttribute("data-du") || "",
          status: btn.getAttribute("data-status") || "",
          remark: btn.getAttribute("data-remark") || "",
        });
      } else if (act === "del") {
        btn.onclick = () => onDelete(id);
      }
    });
  }

  async function fetchList() {
    try {
      hint.textContent = "加载中…";
      tbl.style.display = "none";
      pager.style.display = "none";

      const params = buildParamsAuto();
      q.lastParams = params;

      const url = `${API_BASE}${q.mode === "batch" ? "/api/du/batch?" : "/api/du/search?"}${params}`;
      const resp = await fetch(url);
      const text = await resp.text();
      let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
      if (!resp.ok) throw new Error((data && (data.detail||data.message)) || ("HTTP " + resp.status));

      const items = Array.isArray(data?.items) ? data.items : [];
      renderRows(items);
      bindRowActions();

      tbl.style.display = "";
      hint.textContent = items.length ? "" : "没有数据";

      const total = data?.total || 0;
      const pages = Math.max(1, Math.ceil(total / q.page_size));
      pginfo.textContent = `第 ${q.page} / ${pages} 页，共 ${total} 条`;
      pager.style.display = (pages > 1) ? "" : "none";
      el("prev").disabled = (q.page <= 1);
      el("next").disabled = (q.page >= pages);
    } catch (err) {
      hint.textContent = "查询失败：" + (err?.message || err);
      tbl.style.display = "none";
      pager.style.display = "none";
    }
  }

  // ====== 弹窗 ======
  function openModalEdit(item) {
    editingId = Number(item.id);
    mId.textContent = `#${editingId} / ${item.du_id || ""}`;
    mStatus.value = item.status || "";
    mRemark.value = item.remark || "";
    mPhoto.value = "";
    mMsg.textContent = "";
    mask.style.display = "flex";
  }
  function closeModal() { mask.style.display = "none"; }

  el("m-cancel").onclick = closeModal;
  el("m-save").onclick = async () => {
    if (!editingId) return;
    mMsg.textContent = "保存中…";
    try {
      const fd = new FormData();
      if (mStatus.value) fd.append("status", mStatus.value);
      if (mRemark.value) fd.append("remark", mRemark.value);
      if (mPhoto.files && mPhoto.files[0]) fd.append("photo", mPhoto.files[0]);

      const resp = await fetch(`${API_BASE}/api/du/update/${editingId}`, { method: "PUT", body: fd });
      const text = await resp.text();
      let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
      if (!resp.ok) throw new Error((data && (data.detail||data.message)) || ("HTTP " + resp.status));

      mMsg.textContent = "保存成功";
      closeModal();
      await fetchList();
    } catch (err) {
      mMsg.textContent = "保存失败：" + (err?.message || err);
    }
  };

  // ====== 删除 ======
  async function onDelete(id) {
    if (!id) return;
    if (!confirm(`确认要删除记录 #${id} 吗？`)) return;
    hint.textContent = `正在删除 #${id} …`;
    try {
      const resp = await fetch(`${API_BASE}/api/du/update/${id}`, { method: "DELETE" });
      const text = await resp.text();
      let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
      if (!resp.ok) throw new Error((data && (data.detail||data.message)) || ("HTTP " + resp.status));
      hint.textContent = "删除成功";
      await fetchList();
    } catch (err) {
      hint.textContent = "删除失败：" + (err?.message || err);
    }
  }

  // ====== 导出 ======
  function csvEscape(val) {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }
  function downloadCSV(rows, filename = "du_all_results.csv") {
    const bom = "\uFEFF";
    const lines = rows.map(r => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([bom + lines], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }
  function toCsvRows(items) {
    const header = ["ID","DU ID","状态","备注","照片URL","时间"];
    const rows = [header];
    for (const it of items) {
      const t = it.created_at ? new Date(it.created_at).toLocaleString() : "";
      const remark = it.remark ? String(it.remark).replace(/[<>]/g,"") : "";
      const photo = it.photo_url ? toAbsUrl(it.photo_url) : "";
      rows.push([it.id, it.du_id, it.status||"", remark, photo, t]);
    }
    return rows;
  }
  async function exportAll() {
    try {
      hint.textContent = "正在导出全部数据，请稍候…";
      const per = q.page_size || 20;

      const p1 = new URLSearchParams(q.lastParams);
      p1.set("page","1"); p1.set("page_size", String(per));
      const firstUrl = `${API_BASE}${q.mode === "batch" ? "/api/du/batch?" : "/api/du/search?"}${p1.toString()}`;

      const fResp = await fetch(firstUrl);
      const fRaw = await fResp.text();
      let fData = null; try { fData = fRaw ? JSON.parse(fRaw) : null; } catch {}
      if (!fResp.ok) throw new Error((fData && (fData.detail||fData.message)) || ("HTTP " + fResp.status));

      const total = fData?.total || 0;
      let items = Array.isArray(fData?.items) ? fData.items.slice() : [];
      const pages = Math.max(1, Math.ceil(total / per));

      for (let p=2; p<=pages; p++) {
        const params = new URLSearchParams(q.lastParams);
        params.set("page", String(p)); params.set("page_size", String(per));
        const url = `${API_BASE}${q.mode === "batch" ? "/api/du/batch?" : "/api/du/search?"}${params.toString()}`;
        const r = await fetch(url);
        const raw = await r.text();
        let d = null; try { d = raw ? JSON.parse(raw) : null; } catch {}
        if (!r.ok) throw new Error((d && (d.detail||d.message)) || ("HTTP " + r.status));
        if (Array.isArray(d?.items)) items = items.concat(d.items);
      }

      if (!items.length) {
        alert("没有匹配的数据可导出。");
        hint.textContent = total ? "" : "没有数据";
        return;
      }
      downloadCSV(toCsvRows(items), "du_all_results.csv");
      hint.textContent = "";
    } catch (err) {
      hint.textContent = "导出失败：" + (err?.message || err);
    }
  }

  // ====== 事件绑定 ======
  el("btn-search").onclick = () => { q.page = 1; fetchList(); };
  el("btn-reset").onclick = () => {
    ["f-status","f-remark","f-has","f-from","f-to","f-ps2"].forEach(id => {
      const n = el(id); n.value = (id==="f-ps2") ? "20" : "";
    });
    renderTokens(["DID"]);          // 重置默认显示 DID 并刷新高亮
    q.page = 1;
    fetchList();
  };
  el("prev").onclick = () => { if (q.page > 1) { q.page--; fetchList(); } };
  el("next").onclick = () => { q.page++; fetchList(); };

  const exportAllBtn = el("btn-export-all");
  exportAllBtn.onclick = async () => {
    exportAllBtn.disabled = true;
    try { await exportAll(); } finally { exportAllBtn.disabled = false; }
  };
  const trustBackendLinkBtn = el("btn-trust-backend-link");
  trustBackendLinkBtn.onclick = () => window.open(API_BASE.replace(/\/+$/,""), "_blank");

  // ====== 初始 ======
  window.addEventListener("load", () => {
    if (!duInput.value.trim()) renderTokens(["DID"]);
    hint.textContent = "输入条件后点击查询。";
  });
})();
