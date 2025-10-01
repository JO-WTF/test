/**
 * 认证相关的 composable
 * 处理用户认证状态的存储和读取
 */
import { ref, computed } from 'vue';

const AUTH_STORAGE_KEY = 'jakarta-admin-auth-state';

export function useAuth() {
  const authState = ref(null);

  /**
   * 从 localStorage 读取认证状态
   */
  function loadAuthState() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      authState.value = parsed;
      return parsed;
    } catch (err) {
      console.warn('Failed to read auth state:', err);
      return null;
    }
  }

  /**
   * 获取已存储的用户名
   */
  function getStoredUserName() {
    const state = authState.value || loadAuthState();
    const name = state?.userInfo?.name;

    if (typeof name === 'string') {
      const trimmed = name.trim();
      return trimmed ? trimmed : null;
    }

    return null;
  }

  /**
   * 保存认证状态到 localStorage
   */
  function saveAuthState(state) {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
      authState.value = state;
      return true;
    } catch (err) {
      console.warn('Failed to save auth state:', err);
      return false;
    }
  }

  /**
   * 清除认证状态
   */
  function clearAuthState() {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    authState.value = null;
  }

  // 计算属性
  const isAuthenticated = computed(() => !!authState.value?.userInfo);
  const userName = computed(() => getStoredUserName());

  return {
    authState,
    isAuthenticated,
    userName,
    loadAuthState,
    getStoredUserName,
    saveAuthState,
    clearAuthState,
  };
}
