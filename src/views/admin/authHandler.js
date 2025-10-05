/**
 * Authentication and Authorization Handler
 * 处理用户授权登录、角色切换和认证状态管理
 */

import { ROLE_LIST } from '../../config.js';
import { ROLE_MAP, AUTH_STORAGE_KEY } from './constants.js';

/**
 * 清理用户信息对象
 */
function sanitizeUserInfo(user) {
  if (!user || typeof user !== 'object') return null;
  const info = {};
  if (user.id != null) info.id = user.id;
  if (typeof user.name === 'string') {
    const trimmed = user.name.trim();
    if (trimmed) info.name = trimmed;
  }
  return Object.keys(info).length ? info : null;
}

/**
 * 获取用户显示名称
 */
function getUserDisplayName(user) {
  if (!user || typeof user !== 'object') return '';
  if (typeof user.name === 'string') {
    const trimmed = user.name.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/**
 * 安全获取 localStorage
 */
function getLocalStorageSafe() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (err) {
    console.error('localStorage not available:', err);
  }
  return null;
}

/**
 * 持久化认证状态到 localStorage
 */
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
    console.error('Failed to persist auth state:', err);
  }
}

/**
 * 从 localStorage 加载认证状态
 */
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
    console.error('Failed to load auth state:', err);
    try {
      storage?.removeItem(AUTH_STORAGE_KEY);
    } catch (removeErr) {
      console.error('Failed to remove invalid auth state:', removeErr);
    }
  }
  return null;
}

/**
 * 获取角色显示标签
 */
function getRoleLabel(role, i18n = null) {
  if (!role) return '';
  
  const translationKey = `role.${role.key}`;
  const fallbackLabel = role.label || role.key || '';
  
  if (i18n && typeof i18n.t === 'function') {
    try {
      const translated = i18n.t(translationKey, { defaultValue: fallbackLabel });
      return translated !== translationKey ? translated : fallbackLabel;
    } catch (err) {
      console.error('Translation error:', err);
    }
  }
  
  return fallbackLabel;
}

/**
 * 更新授权按钮显示文案
 */
function updateAuthButtonLabel(role, i18n, authBtn, currentUserInfo) {
  if (!authBtn) return;

  const displayName = getUserDisplayName(currentUserInfo);
  if (displayName) {
    authBtn.textContent = displayName;
    authBtn.removeAttribute('data-i18n');
    return;
  }

  const translationKey = role ? 'auth.switch' : 'auth.trigger';

  let label = role ? getRoleLabel(role, i18n) : '授权';

  if (!role && i18n && typeof i18n.t === 'function') {
    try {
      const translated = i18n.t(translationKey);
      if (translated && translated !== translationKey) {
        label = translated;
      }
    } catch (err) {
      console.error('Translation error:', err);
    }
  }

  authBtn.textContent = label;

  if (!role && label) {
    authBtn.setAttribute('data-i18n', translationKey);
  } else if (!label) {
    authBtn.removeAttribute('data-i18n');
  } else {
    authBtn.removeAttribute('data-i18n');
  }
}

/**
 * 创建授权处理器
 * @param {Object} options - 配置选项
 * @returns {Object} 授权处理器实例
 */
export function createAuthHandler(options) {
  const {
    authModal,
    authBtn,
    authCancel,
    authConfirm,
    authInput,
    authMsg,
    authRoleTag,
    signal,
    i18n,
    showToast,
    onRoleChange,
    onAuthSuccess,
    onRoleApplied,
  } = options;

  let currentRoleKey = '';
  let currentUserInfo = null;

  /**
   * 打开授权登录模态框
   */
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
          console.error('Failed to focus auth input:', err);
        }
      }, 30);
    }
  }

  /**
   * 关闭授权登录模态框
   */
  function closeAuthModal() {
    if (authModal) authModal.style.display = 'none';
  }

  /**
   * 根据密码查找匹配的角色和用户
   * @param {string} password - 用户输入的密码
   * @returns {Object|null} 匹配的角色和用户对象，或 null
   */
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

  /**
   * 应用角色变更后的公共逻辑
   */
  function applyRoleChange(roleKey, role, userInfo, { persist = true } = {}) {
    currentRoleKey = roleKey || '';
    currentUserInfo = sanitizeUserInfo(userInfo);

    if (persist) {
      persistAuthState(currentRoleKey, currentUserInfo);
    }

    const resolvedRole = currentRoleKey ? role || ROLE_MAP.get(currentRoleKey) || null : null;

    updateAuthButtonLabel(resolvedRole, i18n, authBtn, currentUserInfo);
    updateRoleTag(resolvedRole);

    notifyRoleChange(currentRoleKey, resolvedRole, currentUserInfo);

    if (typeof onRoleApplied === 'function') {
      try {
        onRoleApplied(currentRoleKey, resolvedRole, currentUserInfo);
      } catch (err) {
        console.error('Error in onRoleApplied callback:', err);
      }
    }
  }

  /**
   * 设置当前角色
   * @param {string} roleKey - 角色 key
   * @param {Object} userInfo - 用户信息
   * @param {Object} [options]
   */
  function setRole(roleKey, userInfo, options = {}) {
    if (!roleKey) {
      applyRoleChange('', null, null, options);
      return;
    }

    const role = ROLE_MAP.get(roleKey);
    if (!role) {
      console.error(`Role not found: ${roleKey}`);
      return;
    }

    applyRoleChange(role.key, role, userInfo, options);
  }

  /**
   * 更新角色标签显示
   * @param {Object} role - 角色对象
   */
  function updateRoleTag(role) {
    if (!authRoleTag) return;

    if (!role) {
      authRoleTag.textContent = '';
      authRoleTag.style.display = 'none';
      authRoleTag.setAttribute('aria-hidden', 'true');
      return;
    }

    const roleLabel = getRoleLabel(role, i18n);
    const displayName = getUserDisplayName(currentUserInfo) || roleLabel || '';

    let text = `当前角色：${displayName}`;
    if (i18n && typeof i18n.t === 'function') {
      try {
        const template = i18n.t('auth.current');
        if (template && template !== 'auth.current') {
          text = template.replace('{role}', displayName || roleLabel || '');
        }
      } catch (err) {
        console.error('Translation error:', err);
      }
    }

    authRoleTag.textContent = text;
    authRoleTag.style.display = '';
    authRoleTag.setAttribute('aria-hidden', 'false');
  }

  /**
   * 通知角色变更
   * @param {string} roleKey - 角色 key
   * @param {Object} role - 角色对象
   * @param {Object} userInfo - 用户信息
   */
  function notifyRoleChange(roleKey, role, userInfo) {
    if (typeof onRoleChange === 'function') {
      try {
        onRoleChange(roleKey || '', role || null, userInfo || null);
      } catch (err) {
        console.error('Error in onRoleChange callback:', err);
      }
    }
  }

  /**
   * 处理授权提交
   */
  function handleAuthSubmit() {
    if (!authInput) return;

    const pwd = authInput.value || '';
    if (!pwd.trim()) {
      if (authMsg) {
        authMsg.textContent = i18n?.t('auth.modal.required') || '请输入密码';
      }
      return;
    }

    if (authMsg) {
      authMsg.textContent = i18n?.t('auth.modal.checking') || '验证中…';
    }

    const matched = findRoleByPassword(pwd);
    if (!matched) {
      if (authMsg) {
        authMsg.textContent = i18n?.t('auth.modal.failed') || '密码错误，请重试';
      }
      return;
    }

    const sanitizedUser = sanitizeUserInfo(matched.user);
    setRole(matched.role.key, sanitizedUser);
    closeAuthModal();

    const roleLabel = getRoleLabel(matched.role, i18n);
    const displayName = getUserDisplayName(sanitizedUser) || roleLabel || 'user';
    showToast?.(`You are logged in as ${displayName}.`, 'success');

    // 调用认证成功回调
    if (typeof onAuthSuccess === 'function') {
      try {
        onAuthSuccess(matched.role, sanitizedUser);
      } catch (err) {
        console.error('Error in onAuthSuccess callback:', err);
      }
    }
  }

  /**
   * 从本地存储恢复认证状态
   * @returns {boolean} 是否成功恢复角色信息
   */
  function restoreFromStorage() {
    const stored = loadStoredAuthState();
    if (stored && stored.roleKey && ROLE_MAP.has(stored.roleKey)) {
      const role = ROLE_MAP.get(stored.roleKey);
      applyRoleChange(role.key, role, stored.userInfo, { persist: false });
      return true;
    }

    applyRoleChange('', null, null, { persist: false });
    return false;
  }

  /**
   * 获取当前角色 key
   * @returns {string} 当前角色 key
   */
  function getCurrentRoleKey() {
    return currentRoleKey;
  }

  /**
   * 获取当前用户信息
   * @returns {Object|null} 当前用户信息
   */
  function getCurrentUserInfo() {
    return currentUserInfo;
  }

  /**
   * 获取当前角色
   * @returns {Object|null} 当前角色对象
   */
  function getCurrentRole() {
    return currentRoleKey ? ROLE_MAP.get(currentRoleKey) || null : null;
  }

  /**
   * 重新渲染与认证相关的文案
   */
  function refreshLabels() {
    const role = getCurrentRole();
    updateAuthButtonLabel(role, i18n, authBtn, currentUserInfo);
    updateRoleTag(role);
  }

  // 绑定事件监听器
  authBtn?.addEventListener('click', openAuthModal, { signal });
  authCancel?.addEventListener('click', closeAuthModal, { signal });
  authConfirm?.addEventListener('click', handleAuthSubmit, { signal });

  // 点击模态框背景关闭
  authModal?.addEventListener(
    'click',
    (e) => {
      if (e.target === authModal) closeAuthModal();
    },
    { signal }
  );

  // 回车键提交
  authInput?.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAuthSubmit();
      }
    },
    { signal }
  );

  // 初始化按钮与标签文案
  refreshLabels();

  // 返回公共 API
  return {
    openAuthModal,
    closeAuthModal,
    setRole,
    getCurrentRoleKey,
    getCurrentUserInfo,
    getCurrentRole,
    updateRoleTag,
    refreshLabels,
    restoreFromStorage,
  };
}
