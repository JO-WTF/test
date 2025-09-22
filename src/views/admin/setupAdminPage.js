import Viewer from 'viewerjs';
import Toastify from 'toastify-js';
import {
  ROLE_LIST,
  STATUS_TRANSLATION_KEYS,
  STATUS_ALIAS_MAP,
} from '../../config.js';

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
  const mRemarkField = el('m-remark-field');
  const mPhoto = el('m-photo');
  const mPhotoField = el('m-photo-field');
  const mMsg = el('m-msg');

  const authModal = el('auth-modal');
  const authBtn = el('btn-auth');
  const authCancel = el('auth-cancel');
  const authConfirm = el('auth-confirm');
  const authInput = el('auth-password');
  const authMsg = el('auth-msg');
  const authRoleTag = el('auth-role-tag');

  const statusCardWrapper = el('status-card-wrapper');
  const statusCardContainer = el('status-card-container');

  const dnBtn = el('btn-dn-entry');
  const dnModal = el('dn-modal');
  const dnInput = el('dn-input');
  const dnPreview = el('dn-preview');
  const dnClose = el('dn-close');
  const dnCancel = el('dn-cancel');
  const dnConfirm = el('dn-confirm');

  let editingId = 0;
  let currentRoleKey = null;
  let currentUserInfo = null;
  let cachedItems = [];
  let removeI18nListener = null;
  let statusCardDefs = [];
  const statusCardRefs = new Map();
  let statusCardAbortController = null;
  let statusCardRequestId = 0;

  const ROLE_MAP = new Map((ROLE_LIST || []).map((role) => [role.key, role]));
  const AUTH_STORAGE_KEY = 'jakarta-admin-auth-state';

  function getLocalStorageSafe() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  }

  function sanitizeUserInfo(user) {
    if (!user || typeof user !== 'object') return null;
    const info = {};
    if (user.id != null) info.id = user.id;
    if (user.name != null) info.name = user.name;
    return Object.keys(info).length ? info : null;
  }

  function persistAuthState(roleKey, userInfo) {
    const storage = getLocalStorageSafe();
    if (!storage) return;
    try {
      if (!roleKey) {
        storage.removeItem(AUTH_STORAGE_KEY);
        return;
      }
      const payload = {
        roleKey,
        userInfo: sanitizeUserInfo(userInfo),
      };
      storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error(err);
    }
  }

  function loadStoredAuthState() {
    const storage = getLocalStorageSafe();
    if (!storage) return null;
    try {
      const raw = storage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const { roleKey } = parsed;
      if (!roleKey || !ROLE_MAP.has(roleKey)) {
        storage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }
      return {
        roleKey,
        userInfo: sanitizeUserInfo(parsed.userInfo),
      };
    } catch (err) {
      console.error(err);
      try {
        const storageRef = getLocalStorageSafe();
        storageRef?.removeItem(AUTH_STORAGE_KEY);
      } catch (removeErr) {
        console.error(removeErr);
      }
    }
    return null;
  }

  const DU_RE_FULL = /^DID\d{13}$/;
  const DU_RE_HEAD = /^DID\d{0,13}$/;
  const q = { page: 1, page_size: 20, mode: 'single', lastParams: '' };
  const DN_SEP_RE = /[\s,，；;、\u3001]+/gu;
  const DN_VALID_RE = /^[A-Z]{2}[A-Z0-9]{12,16}$/;

  const usp = new URLSearchParams(window.location.search);
  const actionsParam = usp.get('actions');
  const ACTIONS_FLAG = actionsParam === null ? true : actionsParam === '1';

  const STATUS_VALUE_TO_KEY = STATUS_TRANSLATION_KEYS || {};
  const STATUS_ALIAS_LOOKUP = STATUS_ALIAS_MAP || {};
  const STATUS_KNOWN_VALUES = new Set(Object.keys(STATUS_VALUE_TO_KEY));

  const applyAllTranslations = () => {
    if (typeof applyTranslations === 'function') {
      applyTranslations();
    }
    translateStatusCells();
    updateAuthButtonLabel();
    updateRoleBadge();
    updateStatusCardLabels();
    updateStatusCardActiveState();
    refreshDnEntryVisibility();
    const currentVal = mStatus?.value || '';
    refreshStatusOptionsForRole(currentVal);
    if (dnInput) {
      normalizeDnInput({ enforceFormat: false });
    }
  };

  if (i18n && typeof i18n.onChange === 'function') {
    removeI18nListener = i18n.onChange(() => {
      applyAllTranslations();
    });
  }

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

  function decodeHtmlEntities(s) {
    return String(s)
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  function normalizeStatusValue(raw) {
    const text = (raw || '').trim();
    if (!text) return '';
    if (STATUS_KNOWN_VALUES.has(text)) return text;
    const direct = STATUS_ALIAS_LOOKUP[text];
    if (direct) return direct;
    const upper = text.toUpperCase();
    if (upper !== text) {
      if (STATUS_KNOWN_VALUES.has(upper)) return upper;
      const aliasUpper = STATUS_ALIAS_LOOKUP[upper];
      if (aliasUpper) return aliasUpper;
    }
    return text;
  }

  function translateStatusValue(value) {
    const key = value ? STATUS_VALUE_TO_KEY[value] : '';
    if (!key || !i18n) return '';
    try {
      const translated = i18n.t(key);
      if (translated && translated !== key) return translated;
    } catch (err) {
      console.error(err);
    }
    return '';
  }

  function i18nStatusDisplay(raw) {
    const canonical = normalizeStatusValue(raw);
    const translated = translateStatusValue(canonical);
    if (translated) return translated;
    const fallback = translateStatusValue(raw);
    if (fallback) return fallback;
    return canonical || raw || '';
  }

  function getRoleStatusHighlights(role) {
    if (!role) return [];
    const rawList = Array.isArray(role.statusHighlights) ? role.statusHighlights : [];
    const seen = new Set();
    const list = [];
    rawList.forEach((item) => {
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

  function renderStatusHighlightCards() {
    if (!statusCardContainer || !statusCardWrapper) return;
    const role = getCurrentRole();
    const defs = getRoleStatusHighlights(role);
    statusCardDefs = defs;
    statusCardRefs.clear();

    if (!defs.length) {
      statusCardContainer.innerHTML = '';
      statusCardWrapper.style.display = 'none';
      statusCardWrapper.setAttribute('aria-hidden', 'true');
      statusCardContainer.style.removeProperty('--status-card-columns');
      if (statusCardAbortController) {
        try {
          statusCardAbortController.abort();
        } catch (err) {
          console.error(err);
        }
        statusCardAbortController = null;
      }
      return;
    }

    statusCardWrapper.style.display = '';
    statusCardWrapper.setAttribute('aria-hidden', 'false');
    statusCardContainer.innerHTML = '';
    const columns = Math.max(1, Math.min(defs.length, 4));
    statusCardContainer.style.setProperty('--status-card-columns', String(columns));

    defs.forEach((def) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'status-card';
      btn.setAttribute('data-status', def.status);
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-busy', 'false');

      const countEl = document.createElement('div');
      countEl.className = 'status-card__count';
      countEl.textContent = '…';

      const labelEl = document.createElement('div');
      labelEl.className = 'status-card__label';
      labelEl.textContent = getStatusCardLabel(def);

      btn.appendChild(countEl);
      btn.appendChild(labelEl);

      btn.addEventListener(
        'click',
        () => handleStatusCardClick(def.status),
        { signal }
      );

      statusCardContainer.appendChild(btn);
      statusCardRefs.set(def.status, { button: btn, countEl, labelEl });
    });

    updateStatusCardLabels();
    updateStatusCardActiveState();
  }

  function updateStatusCardLabels() {
    if (!statusCardDefs.length) return;
    statusCardDefs.forEach((def) => {
      const ref = statusCardRefs.get(def.status);
      if (!ref) return;
      const label = getStatusCardLabel(def);
      ref.labelEl.textContent = label;
      const currentCount = ref.countEl.textContent || '';
      ref.button.setAttribute('aria-label', `${label} ${currentCount}`.trim());
    });
  }

  function updateStatusCardActiveState() {
    if (!statusCardRefs.size) return;
    const select = el('f-status');
    const value = select ? select.value : '';
    const canonical = normalizeStatusValue(value);
    statusCardRefs.forEach((ref, status) => {
      const isActive = Boolean(canonical) && status === canonical;
      ref.button.classList.toggle('active', isActive);
      ref.button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  async function fetchStatusCount(status, signal) {
    const params = new URLSearchParams();
    params.set('status', status);
    params.set('page', '1');
    params.set('page_size', '1');
    const url = `${API_BASE}/api/dn/list/search?${params.toString()}`;
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
    const totalRaw = data?.total ?? data?.count ?? 0;
    const total = Number(totalRaw);
    return Number.isFinite(total) ? total : 0;
  }

  async function refreshStatusHighlightCards() {
    if (!statusCardDefs.length || !statusCardRefs.size) return;
    statusCardRequestId += 1;
    const requestId = statusCardRequestId;

    if (statusCardAbortController) {
      try {
        statusCardAbortController.abort();
      } catch (err) {
        console.error(err);
      }
    }
    const controller = new AbortController();
    statusCardAbortController = controller;
    const { signal: cardSignal } = controller;

    statusCardRefs.forEach((ref) => {
      ref.button.classList.add('loading');
      ref.button.setAttribute('aria-busy', 'true');
      ref.countEl.textContent = '…';
    });

    const tasks = statusCardDefs.map(async (def) => {
      try {
        const count = await fetchStatusCount(def.status, cardSignal);
        if (cardSignal.aborted || requestId !== statusCardRequestId) return;
        const ref = statusCardRefs.get(def.status);
        if (!ref) return;
        const displayCount = Number.isFinite(count) ? count : 0;
        ref.countEl.textContent = String(displayCount);
        ref.button.classList.remove('loading');
        ref.button.setAttribute('aria-busy', 'false');
        const label = getStatusCardLabel(def);
        ref.button.setAttribute('aria-label', `${label} ${displayCount}`.trim());
      } catch (err) {
        if (cardSignal.aborted || requestId !== statusCardRequestId) return;
        if (err?.name !== 'AbortError') {
          console.error(err);
        }
        const ref = statusCardRefs.get(def.status);
        if (!ref) return;
        ref.countEl.textContent = '—';
        ref.button.classList.remove('loading');
        ref.button.setAttribute('aria-busy', 'false');
        const label = getStatusCardLabel(def);
        ref.button.setAttribute('aria-label', label);
      }
    });

    try {
      await Promise.allSettled(tasks);
    } catch (err) {
      if (cardSignal.aborted || requestId !== statusCardRequestId) return;
      console.error(err);
    } finally {
      if (statusCardAbortController === controller) {
        statusCardAbortController = null;
      }
    }
  }

  function handleStatusCardClick(status) {
    const canonical = normalizeStatusValue(status);
    if (!canonical) return;
    const select = el('f-status');
    if (select) {
      let hasOption = false;
      Array.from(select.options).forEach((opt) => {
        if (opt.value === canonical) hasOption = true;
      });
      if (!hasOption) {
        const option = document.createElement('option');
        option.value = canonical;
        option.textContent = i18nStatusDisplay(canonical);
        select.appendChild(option);
      }
      select.value = canonical;
      try {
        select.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (err) {
        console.error(err);
      }
    }
    q.page = 1;
    fetchList();
  }

  function getCurrentRole() {
    return currentRoleKey ? ROLE_MAP.get(currentRoleKey) || null : null;
  }

  function getCurrentPermissions() {
    const role = getCurrentRole();
    return role && role.permissions ? role.permissions : null;
  }

  function updateAuthButtonLabel() {
    if (!authBtn) return;
    const role = getCurrentRole();
    const key = role ? 'auth.switch' : 'auth.trigger';
    const fallback = role ? '切换用户组' : '授权';
    try {
      authBtn.textContent = i18n ? i18n.t(key) : fallback;
    } catch (err) {
      console.error(err);
      authBtn.textContent = fallback;
    }
  }

  function updateRoleBadge() {
    if (!authRoleTag) return;
    const role = getCurrentRole();
    if (!role) {
      authRoleTag.textContent = '';
      authRoleTag.classList.remove('active');
      return;
    }
    const label = getRoleLabel(role);
    let text = `当前角色：${label}`;
    if (i18n) {
      try {
        text = i18n.t('auth.current', { role: label });
      } catch (err) {
        console.error(err);
      }
    }
    if (currentUserInfo?.name || currentUserInfo?.id) {
      const userDisplay = currentUserInfo.name || currentUserInfo.id;
      text = `${text} · ${userDisplay}`;
    }
    authRoleTag.textContent = text;
    authRoleTag.classList.add('active');
  }

  function refreshDnEntryVisibility() {
    if (!dnBtn) return;
    const allowed = currentRoleKey === 'customer' || currentRoleKey === 'transportManager';
    dnBtn.style.display = allowed ? '' : 'none';
  }

  function refreshStatusOptionsForRole(currentStatus = '') {
    if (!mStatus) return;
    const perms = getCurrentPermissions();
    const options = Array.isArray(perms?.statusOptions) ? perms.statusOptions : [];
    const canonicalOptions = options.map((status) => normalizeStatusValue(status) || status);
    const keepOption = mStatus.querySelector('option[value=""]');
    Array.from(mStatus.querySelectorAll('option')).forEach((opt) => {
      if (opt.value !== '') opt.remove();
    });
    canonicalOptions.forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = i18nStatusDisplay(status);
      mStatus.appendChild(option);
    });
    if (keepOption) {
      const required = Boolean(perms?.requireStatusSelection);
      keepOption.disabled = required;
      try {
        keepOption.textContent = i18n
          ? i18n.t(required ? 'modal.status.required' : 'modal.status.keep')
          : required
          ? '请选择状态'
          : '（不修改）';
      } catch (err) {
        console.error(err);
        keepOption.textContent = required ? '请选择状态' : '（不修改）';
      }
    }
    if (!canonicalOptions.length) {
      mStatus.value = '';
      mStatus.disabled = true;
      return;
    }

    mStatus.disabled = false;
    const normalizedCurrent = normalizeStatusValue(currentStatus);
    if (normalizedCurrent && canonicalOptions.includes(normalizedCurrent)) {
      mStatus.value = normalizedCurrent;
    } else if (perms?.requireStatusSelection && canonicalOptions[0]) {
      mStatus.value = canonicalOptions[0];
    } else {
      mStatus.value = '';
    }
  }

  function showToast(text, type = 'info') {
    const baseStyle = {
      background: '#334155',
      color: '#e2e8f0',
    };
    if (type === 'success') {
      baseStyle.background = '#22c55e';
      baseStyle.color = '#02120a';
    } else if (type === 'error') {
      baseStyle.background = '#ef4444';
      baseStyle.color = '#051014';
    }
    Toastify({
      text,
      duration: 3200,
      close: true,
      gravity: 'top',
      position: 'right',
      style: baseStyle,
    }).showToast();
  }

  function updateModalFieldVisibility(perms = getCurrentPermissions()) {
    const allowRemark = perms ? Boolean(perms.allowRemark) : true;
    const allowPhoto = perms ? Boolean(perms.allowPhoto) : true;
    if (mRemark) {
      mRemark.disabled = !allowRemark;
      if (!allowRemark) mRemark.value = '';
    }
    if (mRemarkField) {
      mRemarkField.style.display = allowRemark ? '' : 'none';
    }
    if (mPhoto) {
      mPhoto.disabled = !allowPhoto;
      if (!allowPhoto) {
        try {
          mPhoto.value = '';
        } catch (err) {
          console.error(err);
        }
      }
    }
    if (mPhotoField) {
      mPhotoField.style.display = allowPhoto ? '' : 'none';
    }
  }

  function getRoleLabel(role) {
    if (!role) return '';
    const fallback = role.label || role.description || role.key;
    if (!i18n) return fallback;
    try {
      const key = `roles.${role.key}`;
      const translated = i18n.t(key);
      if (translated && translated !== key) return translated;
    } catch (err) {
      console.error(err);
    }
    return fallback;
  }

  function splitDnTokens(raw) {
    const normalized = (raw || '').toUpperCase();
    return normalized
      .split(DN_SEP_RE)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  function isValidDn(token) {
    return DN_VALID_RE.test(token || '');
  }

  function renderDnTokens(tokens) {
    if (!dnPreview) return;
    if (!tokens.length) {
      const placeholder = i18n ? i18n.t('dn.preview.empty') : '在此查看格式化结果';
      dnPreview.innerHTML = `<div class="placeholder">${escapeHtml(placeholder)}</div>`;
      return;
    }
    const html = tokens
      .map((token) => {
        const valid = isValidDn(token);
        return `<span class="dn-token ${valid ? 'ok' : 'bad'}">${escapeHtml(token)}</span>`;
      })
      .join('');
    dnPreview.innerHTML = html;
  }

  function normalizeDnInput({ enforceFormat = false } = {}) {
    if (!dnInput) return [];
    const tokens = splitDnTokens(dnInput.value);
    if (enforceFormat) {
      dnInput.value = tokens.join('\n');
    }
    renderDnTokens(tokens);
    return tokens;
  }

  function openAuthModal() {
    if (!authModal) return;
    authModal.style.display = 'flex';
    if (authMsg) authMsg.textContent = '';
    if (authInput) {
      authInput.value = '';
      setTimeout(() => {
        try {
          authInput.focus();
        } catch (err) {
          console.error(err);
        }
      }, 30);
    }
  }

  function closeAuthModal() {
    if (authModal) authModal.style.display = 'none';
  }

  function setRole(nextRoleKey, userInfo = null) {
    currentRoleKey = nextRoleKey || null;
    currentUserInfo = sanitizeUserInfo(userInfo);
    updateAuthButtonLabel();
    updateRoleBadge();
    refreshDnEntryVisibility();
    const currentVal = mStatus?.value || '';
    refreshStatusOptionsForRole(currentVal);
    updateModalFieldVisibility();
    rerenderTableActions();
    renderStatusHighlightCards();
    refreshStatusHighlightCards();
    persistAuthState(currentRoleKey, currentUserInfo);
  }

  function findRoleByPassword(password) {
    if (!password) return null;
    for (const role of ROLE_LIST || []) {
      const users = Array.isArray(role?.users) ? role.users : [];
      const matchedUser = users.find((user) => user?.password === password);
      if (matchedUser) {
        return { role, user: matchedUser };
      }
    }
    return null;
  }

  function handleAuthSubmit() {
    if (!authInput) return;
    const pwd = authInput.value || '';
    if (!pwd.trim()) {
      if (authMsg)
        authMsg.textContent = i18n ? i18n.t('auth.modal.required') : '请输入密码';
      return;
    }
    if (authMsg) authMsg.textContent = i18n ? i18n.t('auth.modal.checking') : '验证中…';
    const result = findRoleByPassword(pwd.trim());
    if (!result) {
      if (authMsg)
        authMsg.textContent = i18n
          ? i18n.t('auth.modal.failed')
          : '密码不正确，请重试';
      return;
    }
    const { role, user } = result;
    setRole(role.key, user);
    closeAuthModal();
    const label = getRoleLabel(role);
    const message = i18n
      ? i18n.t('auth.toast.success', { role: label })
      : `已授权：${label}`;
    showToast(message, 'success');
  }

  function canUseDnEntry() {
    return currentRoleKey === 'customer' || currentRoleKey === 'transportManager';
  }

  function openDnModal() {
    if (!canUseDnEntry()) {
      const msg = i18n ? i18n.t('dn.toast.denied') : '当前角色无权录入 DN';
      showToast(msg, 'error');
      return;
    }
    if (dnModal) dnModal.style.display = 'flex';
    normalizeDnInput({ enforceFormat: false });
    if (dnInput) {
      setTimeout(() => {
        try {
          dnInput.focus();
        } catch (err) {
          console.error(err);
        }
      }, 30);
    }
  }

  function closeDnModal() {
    if (dnModal) dnModal.style.display = 'none';
  }

  function handleDnConfirm() {
    const tokens = normalizeDnInput({ enforceFormat: true });
    const validCount = tokens.filter((token) => isValidDn(token)).length;
    const invalidCount = Math.max(tokens.length - validCount, 0);
    let msg;
    if (i18n) {
      const base = i18n.t('dn.toast.successBase', { valid: validCount });
      const extra = invalidCount ? i18n.t('dn.toast.invalidNote', { invalid: invalidCount }) : '';
      msg = `${base}${extra}`;
    } else {
      msg = `已录入 ${validCount} 条合法 DN${invalidCount ? `，${invalidCount} 条格式有误` : ''}`;
    }
    showToast(msg, 'success');
    closeDnModal();
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

  el('f-status')?.addEventListener(
    'change',
    () => {
      updateStatusCardActiveState();
    },
    { signal }
  );

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

  function buildActionCell(it, remark) {
    const perms = getCurrentPermissions();
    if (!ACTIONS_FLAG || !perms || (!perms.canEdit && !perms.canDelete)) return '';
    const buttons = [];
    const canonicalStatus = normalizeStatusValue(it.status);
    const statusAttr = escapeHtml(canonicalStatus || it.status || '');
    if (perms.canEdit) {
      buttons.push(
        `<button class="btn" data-act="edit" data-id="${it.id}" data-du="${it.du_id}" data-status="${statusAttr}" data-remark="${escapeHtml(
          remark
        )}" data-i18n="actions.edit">编辑</button>`
      );
    }
    if (perms.canDelete) {
      buttons.push(
        `<button class="btn danger" data-act="del" data-id="${it.id}" data-i18n="actions.delete">删除</button>`
      );
    }
    if (!buttons.length) return '';
    return `<div class="actions">${buttons.join('')}</div>`;
  }

  function renderRows(items) {
    if (!tbody) return;
    cachedItems = Array.isArray(items) ? items.slice() : [];
    tbody.innerHTML = cachedItems
      .map((it) => {
        const t = it.created_at ? new Date(it.created_at).toLocaleString() : '';
        const remark = it.remark ? String(it.remark).replace(/[<>]/g, '') : '';
        const remarkCell = escapeHtml(remark);
        const lonlat =
          it.lng && it.lat
            ? `<a href="https://www.google.com/maps?q=${it.lat},${it.lng}" target="_blank" data-i18n="table.view">查看</a>`
            : '-';

        const photoCell = it.photo_url
          ? `<a href="#" class="view-link" data-url="${toAbsUrl(it.photo_url)}" data-i18n="table.view">查看</a>`
          : '';

        const normalizedStatus = normalizeStatusValue(it.status);
        const statusRaw = normalizedStatus || it.status || '';
        const statusCell = `<td data-raw-status="${escapeHtml(statusRaw)}">${i18nStatusDisplay(
          statusRaw
        )}</td>`;

        const act = buildActionCell(it, remark);

        return `<tr>
          <td>${it.id}</td>
          <td>${it.du_id}</td>
          ${statusCell}
          <td>${remarkCell}</td>
          <td>${photoCell}</td>
          <td>${lonlat}</td>
          <td>${t}</td>
          <td>${act}</td>
        </tr>`;
      })
      .join('');
  }

  function rerenderTableActions() {
    if (!tbody) return;
    renderRows(cachedItems);
    bindRowActions();
    translateStatusCells();
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

      const url = `${API_BASE}${q.mode === 'batch' ? '/api/dn/list/batch?' : '/api/dn/list/search?'}${params}`;
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
    } finally {
      refreshStatusHighlightCards();
    }
  }

  function openModalEdit(item) {
    const perms = getCurrentPermissions();
    if (!perms?.canEdit) {
      showToast(i18n ? i18n.t('auth.toast.denied') : '当前角色无权编辑该记录', 'error');
      return;
    }
    editingId = Number(item.id);
    if (mId) mId.textContent = `#${editingId} / ${item.du_id || ''}`;
    const remarkVal = decodeHtmlEntities(item.remark || '');
    if (mRemark) mRemark.value = perms.allowRemark ? remarkVal : '';
    if (mPhoto) {
      try {
        mPhoto.value = '';
      } catch (err) {
        console.error(err);
      }
    }
    const canonicalStatus = normalizeStatusValue(item.status);
    refreshStatusOptionsForRole(canonicalStatus);
    updateModalFieldVisibility(perms);
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
      const perms = getCurrentPermissions();
      if (!perms?.canEdit) {
        if (mMsg)
          mMsg.textContent = i18n
            ? i18n.t('auth.toast.denied')
            : '当前角色无权编辑该记录';
        return;
      }
      const statusVal = mStatus?.value || '';
      const allowedOptions = Array.isArray(perms?.statusOptions)
        ? perms.statusOptions.map((status) => normalizeStatusValue(status) || status)
        : [];
      const remarkVal = perms.allowRemark ? (mRemark?.value || '').trim() : '';
      const allowPhoto = perms.allowPhoto && mPhoto?.files && mPhoto.files[0];

      if (perms.requireStatusSelection && !statusVal) {
        if (mMsg)
          mMsg.textContent = i18n
            ? i18n.t('modal.status.requiredHint')
            : '请选择允许的状态后再保存。';
        return;
      }

      if (statusVal && allowedOptions.length && !allowedOptions.includes(statusVal)) {
        if (mMsg)
          mMsg.textContent = i18n
            ? i18n.t('modal.status.invalid')
            : '选择的状态不在当前角色的权限范围内。';
        return;
      }

      if (!statusVal && !remarkVal && !allowPhoto) {
        if (mMsg)
          mMsg.textContent = i18n
            ? i18n.t('modal.nothingToSave')
            : '没有可保存的更改。';
        return;
      }

      if (mMsg) mMsg.textContent = i18n ? i18n.t('modal.saving') : '保存中…';
      try {
        const fd = new FormData();
        if (statusVal) fd.append('status', statusVal);
        if (remarkVal) fd.append('remark', remarkVal);
        if (allowPhoto) fd.append('photo', mPhoto.files[0]);

        const resp = await fetch(`${API_BASE}/api/dn/update/${editingId}`, {
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

        if (mMsg) mMsg.textContent = i18n ? i18n.t('modal.success') : '保存成功';
        closeModal();
        await fetchList();
      } catch (err) {
        if (mMsg)
          mMsg.textContent = i18n
            ? i18n.t('modal.error', { msg: err?.message || err })
            : `保存失败：${err?.message || err}`;
      }
    },
    { signal }
  );

  async function onDelete(id) {
    if (!id) return;
    const perms = getCurrentPermissions();
    if (!perms?.canDelete) {
      showToast(i18n ? i18n.t('auth.toast.denied') : '当前角色无权删除该记录', 'error');
      return;
    }
    if (!window.confirm(`确认要删除记录 #${id} 吗？`)) return;
    if (hint) hint.textContent = `正在删除 #${id} …`;
    try {
      const resp = await fetch(`${API_BASE}/api/dn/update/${id}`, { method: 'DELETE' });
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
      const firstUrl = `${API_BASE}${q.mode === 'batch' ? '/api/dn/list/batch?' : '/api/dn/list/search?'}${p1.toString()}`;

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
        const url = `${API_BASE}${q.mode === 'batch' ? '/api/dn/list/batch?' : '/api/dn/list/search?'}${params.toString()}`;
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
      const canonical = normalizeStatusValue(raw);
      const value = canonical || raw;
      td.textContent = i18nStatusDisplay(value);
      td.setAttribute('data-raw-status', value);
    });
  }

  authBtn?.addEventListener('click', openAuthModal, { signal });
  authCancel?.addEventListener('click', () => closeAuthModal(), { signal });
  authConfirm?.addEventListener('click', () => handleAuthSubmit(), { signal });
  authInput?.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAuthSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeAuthModal();
      }
    },
    { signal }
  );
  authModal?.addEventListener(
    'click',
    (e) => {
      if (e.target === authModal) closeAuthModal();
    },
    { signal }
  );

  dnBtn?.addEventListener('click', openDnModal, { signal });
  dnClose?.addEventListener('click', () => closeDnModal(), { signal });
  dnCancel?.addEventListener('click', () => closeDnModal(), { signal });
  dnConfirm?.addEventListener('click', () => handleDnConfirm(), { signal });
  dnModal?.addEventListener(
    'click',
    (e) => {
      if (e.target === dnModal) closeDnModal();
    },
    { signal }
  );

  const isModalVisible = (modal) => modal && modal.style.display === 'flex';

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        if (isModalVisible(dnModal)) {
          e.preventDefault();
          closeDnModal();
          return;
        }
        if (isModalVisible(authModal)) {
          e.preventDefault();
          closeAuthModal();
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isModalVisible(dnModal)) {
        e.preventDefault();
        handleDnConfirm();
      }
    },
    { signal }
  );

  if (dnInput) {
    dnInput.addEventListener(
      'input',
      () => {
        normalizeDnInput({ enforceFormat: false });
      },
      { signal }
    );
    dnInput.addEventListener(
      'blur',
      () => {
        normalizeDnInput({ enforceFormat: true });
      },
      { signal }
    );
    dnInput.addEventListener(
      'paste',
      (e) => {
        try {
          const text = (e.clipboardData || window.clipboardData).getData('text');
          if (text != null) {
            e.preventDefault();
            const start = typeof dnInput.selectionStart === 'number' ? dnInput.selectionStart : dnInput.value.length;
            const end = typeof dnInput.selectionEnd === 'number' ? dnInput.selectionEnd : start;
            const before = dnInput.value.slice(0, start);
            const after = dnInput.value.slice(end);
            dnInput.value = `${before}${text}${after}`;
            const tokens = normalizeDnInput({ enforceFormat: true });
            if (tokens.length) {
              try {
                dnInput.selectionStart = dnInput.selectionEnd = dnInput.value.length;
              } catch (err) {
                console.error(err);
              }
            }
          }
        } catch (err) {
          console.error(err);
        }
      },
      { signal }
    );
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

  function restoreAuthFromStorage() {
    const stored = loadStoredAuthState();
    if (stored && stored.roleKey) {
      setRole(stored.roleKey, stored.userInfo);
    } else {
      updateAuthButtonLabel();
      updateRoleBadge();
      refreshDnEntryVisibility();
      const currentVal = mStatus?.value || '';
      refreshStatusOptionsForRole(currentVal);
      updateModalFieldVisibility();
      rerenderTableActions();
      renderStatusHighlightCards();
    }
  }

  function init() {
    if (!duInput?.value.trim()) renderTokens(['DID']);
    if (hint) hint.textContent = '输入条件后点击查询。';
    fetchList();
  }

  restoreAuthFromStorage();
  init();
  applyAllTranslations();

  return () => {
    controller.abort();
    try {
      removeI18nListener?.();
    } catch (err) {
      console.error(err);
    }
    try {
      statusCardAbortController?.abort();
    } catch (err) {
      console.error(err);
    }
    statusCardAbortController = null;
    statusCardRefs.clear();
    statusCardDefs = [];
    statusCardRequestId = 0;
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
