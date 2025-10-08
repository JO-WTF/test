import { escapeHtml, lockBodyScroll, unlockBodyScroll } from './utils.js';
import { TRANSPORT_MANAGER_ROLE_KEY } from './constants.js';
import { normalizeDnSoft, DN_VALID_RE } from '../../utils/dn.js';

const DN_SEPARATOR_SOURCE = '[\\s,，；;、\\u3001]+';
const DN_SEP_RE = new RegExp(DN_SEPARATOR_SOURCE, 'gu');
const DN_SEP_CAPTURE_RE = new RegExp(`(${DN_SEPARATOR_SOURCE})`, 'gu');
const DN_SEP_TEST_RE = new RegExp(`^${DN_SEPARATOR_SOURCE}$`, 'u');

export function createDnEntryManager({
  dnInput,
  dnPreview,
  dnBtn,
  dnModal,
  dnEntryInput,
  dnEntryPreview,
  dnClose,
  dnCancel,
  dnConfirm,
  signal,
  i18n,
  API_BASE,
  showToast,
  getCurrentPermissions,
  getCurrentRoleKey,
  fetchList,
}) {
  function isTransportManager() {
    if (typeof getCurrentRoleKey === 'function') {
      return getCurrentRoleKey() === TRANSPORT_MANAGER_ROLE_KEY;
    }
    return false;
  }

  function refreshVisibility() {
    if (!dnBtn) return;
    const visible = isTransportManager();
    dnBtn.style.display = visible ? '' : 'none';
    dnBtn.setAttribute('aria-hidden', visible ? 'false' : 'true');
    dnBtn.disabled = !visible;
  }

  function normalizeRawSoft(raw) {
    return normalizeDnSoft(raw);
  }

  function splitTokens(raw) {
    const normalized = normalizeRawSoft(raw);
    return normalized
      .split(DN_SEP_RE)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function buildHighlightHTML(raw) {
    const normalized = normalizeRawSoft(raw);
    if (!normalized) return '';
    const parts = normalized.split(DN_SEP_CAPTURE_RE);
    const out = [];
    for (const chunk of parts) {
      if (!chunk) continue;
      if (DN_SEP_TEST_RE.test(chunk)) {
        out.push(`<span class="hl-sep">${escapeHtml(chunk)}</span>`);
        continue;
      }
      const token = chunk.trim();
      if (!token) continue;
      const valid = DN_VALID_RE.test(token);
      out.push(
        `<span class="${valid ? 'hl-ok' : 'hl-bad'}">${escapeHtml(chunk)}</span>`
      );
    }
    out.push('<span class="hl-sep">\n</span>');
    return out.join('');
  }

  function renderFilterPreview() {
    if (!dnPreview || !dnInput) return;
    const html = buildHighlightHTML(dnInput.value);
    dnPreview.innerHTML = html;
    dnPreview.scrollTop = dnInput.scrollTop;
    dnPreview.scrollLeft = dnInput.scrollLeft;
  }

  function renderFilterTokens(tokens) {
    if (!dnInput) return [];
    const list = Array.isArray(tokens) ? tokens : [];
    dnInput.value = list.join('\n');
    renderFilterPreview();
    return list;
  }

  function normalizeFilterInput({ enforceFormat = false } = {}) {
    if (!dnInput) return [];
    const before = dnInput.value;
    const after = normalizeRawSoft(before);
    if (after !== before) {
      const atEnd =
        dnInput.selectionStart === before.length &&
        dnInput.selectionEnd === before.length;
      dnInput.value = after;
      if (atEnd) {
        try {
          dnInput.selectionStart = dnInput.selectionEnd = dnInput.value.length;
        } catch (err) {
          console.error(err);
        }
      }
    }
    const tokens = splitTokens(dnInput.value);
    if (enforceFormat) {
      renderFilterTokens(tokens);
    } else {
      renderFilterPreview();
    }
    return tokens;
  }

  function renderModalPreview(tokensOverride) {
    if (!dnEntryPreview || !dnEntryInput) return;
    const tokens = Array.isArray(tokensOverride)
      ? tokensOverride
      : splitTokens(dnEntryInput.value);
    if (!tokens.length) {
      const placeholder =
        i18n?.t('dn.preview.empty') || '在此查看格式化结果';
      dnEntryPreview.innerHTML = `<div class="placeholder">${escapeHtml(
        placeholder
      )}</div>`;
      return;
    }
    dnEntryPreview.innerHTML = tokens
      .map((token) => {
        const valid = DN_VALID_RE.test(token);
        return `<span class="dn-token ${valid ? 'ok' : 'bad'}">${escapeHtml(
          token
        )}</span>`;
      })
      .join('');
  }

  function renderModalTokens(tokens) {
    if (!dnEntryInput) return [];
    const list = Array.isArray(tokens) ? tokens : [];
    dnEntryInput.value = list.join('\n');
    renderModalPreview(list);
    return list;
  }

  function openModal() {
    if (!dnModal) return;
    const perms = getCurrentPermissions?.();
    if (!perms?.canEdit) {
      showToast(
        i18n ? i18n.t('dn.toast.denied') : '当前角色无权录入 DN',
        'error'
      );
      return;
    }
    const wasVisible = dnModal.style.display === 'flex';
    dnModal.style.display = 'flex';
    if (!wasVisible) {
      lockBodyScroll();
    }
    if (dnEntryPreview) {
      dnEntryPreview.innerHTML = '';
    }
    if (dnEntryInput) {
      dnEntryInput.value = '';
      setTimeout(() => {
        try {
          dnEntryInput.focus();
        } catch (err) {
          console.error(err);
        }
      }, 30);
    }
    renderModalPreview();
  }

  function closeModal() {
    if (dnModal) {
      const wasVisible = dnModal.style.display === 'flex';
      dnModal.style.display = 'none';
      if (wasVisible) {
        unlockBodyScroll();
      }
    }
  }

  async function handleConfirm() {
    if (!dnEntryInput) return;
    const tokens = splitTokens(dnEntryInput.value);
    if (!tokens.length) {
      showToast(i18n ? i18n.t('dn.toast.empty') : '请输入 DN 号', 'error');
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/api/dn/batch_update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dn_numbers: tokens }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(
          (data && (data.detail || data.message)) || `HTTP ${resp.status}`
        );
      }
      const success = data?.success_count || 0;
      const failure = data?.failure_count || 0;
      const msg = i18n
        ? i18n.t('dn.toast.successBase', { valid: success }) +
          (failure
            ? i18n.t('dn.toast.invalidNote', { invalid: failure })
            : '')
        : `成功创建 ${success} 条 DN${failure ? `，${failure} 条失败` : ''}`;
      showToast(msg, failure ? 'info' : 'success');
      closeModal();
      fetchList?.();
    } catch (err) {
      showToast(
        `${i18n?.t('dn.toast.error') || '录入失败'}：${err?.message || err}`,
        'error'
      );
    }
  }

  function attachFilterEvents() {
    if (!dnInput) return;
    dnInput.addEventListener(
      'input',
      () => {
        normalizeFilterInput({ enforceFormat: false });
      },
      { signal }
    );
    dnInput.addEventListener(
      'paste',
      (event) => {
        try {
          const text = (event.clipboardData || window.clipboardData)?.getData('text');
          if (typeof text === 'string') {
            event.preventDefault();
            const current = splitTokens(dnInput.value);
            const pasted = splitTokens(text);
            const merged = Array.from(new Set(current.concat(pasted)));
            renderFilterTokens(merged);
            try {
              dnInput.selectionStart = dnInput.selectionEnd = dnInput.value.length;
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
    dnInput.addEventListener(
      'scroll',
      () => {
        if (!dnPreview) return;
        dnPreview.scrollTop = dnInput.scrollTop;
        dnPreview.scrollLeft = dnInput.scrollLeft;
      },
      { signal }
    );
  }

  function attachModalEvents() {
    dnBtn?.addEventListener('click', openModal, { signal });
    dnClose?.addEventListener('click', () => closeModal(), { signal });
    dnCancel?.addEventListener('click', () => closeModal(), { signal });
    dnConfirm?.addEventListener('click', () => handleConfirm(), { signal });
    dnModal?.addEventListener(
      'click',
      (event) => {
        if (event.target === dnModal) closeModal();
      },
      { signal }
    );
    dnEntryInput?.addEventListener('input', () => renderModalPreview(), {
      signal,
    });
    dnEntryInput?.addEventListener(
      'paste',
      (event) => {
        try {
          const text = (event.clipboardData || window.clipboardData)?.getData('text');
          if (typeof text === 'string') {
            event.preventDefault();
            const current = splitTokens(dnEntryInput.value);
            const pasted = splitTokens(text);
            const merged = Array.from(new Set(current.concat(pasted)));
            renderModalTokens(merged);
            try {
              dnEntryInput.selectionStart = dnEntryInput.selectionEnd =
                dnEntryInput.value.length;
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
  }

  attachFilterEvents();
  attachModalEvents();
  refreshVisibility();

  return {
    refreshVisibility,
    normalizeFilterInput,
    renderFilterPreview,
    renderFilterTokens,
    openModal,
    closeModal,
    renderModalPreview,
    renderModalTokens,
    handleConfirm,
  };
}
