// admin.js — 管理页脚本（高亮不重影 + 自动换行 + 粘贴合并 + 删除不强填 + DID 占位激活逻辑）

(function () {
  // 1) 优先从 /config.js 暴露的 APP_CONFIG 读取；2) 兼容旧的 window.API_BASE；3) 最后回退同源
  const API_BASE =
    (window.APP_CONFIG && window.APP_CONFIG.API_BASE) ||
    window.API_BASE ||
    location.origin;

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
  const DU_RE_FULL = /^DID\d{13}$/;        // 完整合法：DID + 13 位数字
  const DU_RE_HEAD = /^DID\d{0,13}$/;      // 仅头部检查（含 0~13 位数字）
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

  // 仅做：大写 + 去零宽/BOM（不做自动注入 DID，除非在“自动换行种子”逻辑里）
  function normalizeRawSoft(raw) {
    return (raw || "").toUpperCase().replace(/\u200B|\uFEFF/g, "");
  }

  // 构造高亮 HTML（只画背景，不画文字颜色，避免重影）
  function buildDuHighlightHTML(raw) {
    const s = raw || "";
    if (!s) return "";

    // 分段：保留分隔符
    const parts = s.split(/([,\s;]+)/g);
    const out = [];

    for (const chunk of parts) {
      if (!chunk) continue;

      // 分隔符：透明占位
      if (/^[,\s;]+$/.test(chunk)) {
        out.push(`<span class="hl-sep">${escapeHtml(chunk)}</span>`);
        continue;
      }

      const token = chunk.trim();

      // 完整合法
      if (DU_RE_FULL.test(token)) {
        out.push(`<span class="hl-ok">${escapeHtml(chunk)}</span>`);
        continue;
      }

      // 头部形式（DID + 0~13位数字）
      if (DU_RE_HEAD.test(token)) {
        const digits = token.slice(3); // 可能为 ""、1..13 位
        if (digits.length === 0) {
          // 只有 "D" / "DI" / "DID"
          const letters = token.slice(0, Math.min(3, token.length));
          // 逐字渲染：按 D I D 顺序，已输入的字母用 hl-did-act，未输入用 hl-did-inact
          const want = "DID";
          let html = "";
          for (let i = 0; i < 3; i++) {
            const ch = want[i];
            const active = i < letters.length && letters[i] === ch;
            html += `<span class="${active ? "hl-did-act" : "hl-did-inact"}">${ch}</span>`;
          }
          out.push(html);
        } else if (digits.length < 13) {
          // 数位不足，非法（红底）
          out.push(`<span class="hl-bad">${escapeHtml(chunk)}</span>`);
        } else {
          // 13 位会在最前面的 FULL 分支被捕获；这里理论不会进
          out.push(`<span class="hl-ok">${escapeHtml(chunk)}</span>`);
        }
        continue;
      }

      // 否则，非法
      out.push(`<span class="hl-bad">${escapeHtml(chunk)}</span>`);
    }

    // 底部占位，帮助高度对齐
    out.push('<span class="hl-sep">\n</span>');
    return out.join("");
  }

  // 把原始输入拆为 token（按换行/空格/逗号），去重
  function toTokenList(raw) {
    const s = normalizeRawSoft(raw);
    const arr = s.split(/[\s,;]+/g)
      .map(v => v.trim())
      .filter(Boolean);

    // 过滤掉仅有 "DID" 没数字的占位符
    const valid = arr.filter(v => !/^DID$/i.test(v));

    return Array.from(new Set(valid));
  }

  // 渲染 tokens -> textarea + 高亮
  function renderTokens(tokens) {
    duInput.value = (tokens || []).join("\n");
    duHilite.innerHTML = buildDuHighlightHTML(duInput.value);
  }

  // 自动换行 + 种子：当“最后一个非空 token”为完整合法 DID13，则追加换行 + "DID"
  function autoSeedNextDidIfNeeded() {
    const val = duInput.value;
    // 只在光标末尾时执行，避免中间编辑时插入
    const atEnd = duInput.selectionStart === val.length && duInput.selectionEnd === val.length;
    if (!atEnd) return;

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

    if (DU_RE_FULL.test(lastToken)) {
      // 避免重复插入：末尾已经有换行/空白/逗号则先补换行
      const tail = val.slice(-1);
      const needNL = !/[\n\r]$/.test(tail);
      duInput.value = val + (needNL ? "\n" : "") + "DID";
      try { duInput.selectionStart = duInput.selectionEnd = duInput.value.length; } catch {}
    }
  }

  // ====== 输入：区分删除与插入；不对删除做自动脚手架 ======
  duInput.addEventListener("input", (e) => {
    const isDelete = (e && typeof e.inputType === "string" && e.inputType.startsWith("delete"));

    // 统一做：大写 + 清理零宽/BOM（不自动注入 DID）
    const before = duInput.value;
    const after  = normalizeRawSoft(before);
    if (after !== before) {
      const atEnd = duInput.selectionStart === before.length && duInput.selectionEnd === before.length;
      duInput.value = after;
      if (atEnd) {
        try { duInput.selectionStart = duInput.selectionEnd = duInput.value.length; } catch {}
      }
    }

    // 非删除：检查是否需要换行并种下新 DID
    if (!isDelete) autoSeedNextDidIfNeeded();

    // 刷新高亮
    duHilite.innerHTML = buildDuHighlightHTML(duInput.value);
  });

  // 粘贴：合并、去重
  duInput.addEventListener("paste", (e) => {
    try {
      const text = (e.clipboardData || window.clipboardData).getData("text");
      if (text != null) {
        e.preventDefault();
        const current = toTokenList(duInput.value);
        const pasted  = toTokenList(text);
        const merged  = Array.from(new Set(current.concat(pasted)));
        renderTokens(merged);
        try { duInput.selectionStart = duInput.selectionEnd = duInput.value.length; } catch {}
      }
    } catch {
      /* ignore */
    }
  });

  // 同步滚动（textarea -> 高亮层）
  duInput.addEventListener("scroll", () => {
    duHilite.scrollTop  = duInput.scrollTop;
    duHilite.scrollLeft = duInput.scrollLeft;
  });

  // ====== 查询参数构建（自动单/多）======
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
    renderTokens(["DID"]);          // 重置后默认显示 DID（浅灰占位）
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
  trustBackendLinkBtn.onclick = () =>
    window.open(String(API_BASE).replace(/\/+$/,""), "_blank");

  // ====== 初始 ======
  window.addEventListener("load", () => {
    if (!duInput.value.trim()) renderTokens(["DID"]); // 初始显示 DID 浅灰占位
    hint.textContent = "输入条件后点击查询。";
  });
})();
