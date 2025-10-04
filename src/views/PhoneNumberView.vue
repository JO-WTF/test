<template>
  <div class="wrap phone-view">
    <div class="language-bar">
      <LanguageSwitcher v-model="state.lang" @change="setLang" />
    </div>

    <main class="phone-card" role="main">
      <h1 class="phone-title">{{ translations.phoneTitle }}</h1>
      <p class="phone-description">{{ translations.phoneDescription }}</p>

      <label class="input-label" for="phone-input">{{ translations.phoneNumberLabel }}</label>
      <div class="input-wrapper">
        <div class="input-with-icon">
          <input
            id="phone-input"
            ref="phoneInput"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            :placeholder="translations.phonePlaceholder"
            v-model="state.phone"
            @input="onPhoneInput"
            :aria-invalid="showError ? 'true' : 'false'"
            aria-describedby="phone-error"
            :class="{ 'has-check': showCheckMark }"
          />
          <span v-if="showCheckMark" class="check-icon" aria-label="Valid">✓</span>
        </div>
      </div>
      <p v-if="showError" id="phone-error" class="error-text">{{ translations.phoneInvalid }}</p>

      <button class="confirm-btn" type="button" :disabled="isSubmitting || !isValidPhone" @click="confirmPhone">
        {{ isSubmitting ? translations.submitting : translations.phoneConfirm }}
      </button>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { 
  parsePhoneNumberFromString, 
  AsYouType,
  isValidPhoneNumber,
  isPossiblePhoneNumber,
  validatePhoneNumberLength
} from 'libphonenumber-js';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import { createI18n } from '../i18n/core';
import { getCookie, setCookie } from '../utils/cookie.js';

const PHONE_COOKIE_KEY = 'phone_number';
const DEFAULT_COUNTRY = 'ID';

const safeParsePhone = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = parsePhoneNumberFromString(value, DEFAULT_COUNTRY);
    return parsed && parsed.isValid() ? parsed : null;
  } catch {
    return null;
  }
};

const formatPhoneForDisplay = (value) => {
  const parsed = safeParsePhone(value);
  if (parsed) return parsed.formatInternational();
  return value ?? '';
};

const formatAsYouType = (value) => {
  if (!value) return '';
  const formatter = new AsYouType(DEFAULT_COUNTRY);
  return formatter.input(value);
};

const i18n = createI18n({
  namespaces: ['index'],
  fallbackLang: 'id',
  defaultLang: 'id',
});
await i18n.init();

const router = useRouter();
const route = useRoute();
const phoneInput = ref(null);

const storedPhone = getCookie(PHONE_COOKIE_KEY) || '';

// 使用版本号强制响应式更新
const i18nVersion = ref(0);

const state = reactive({
  lang: i18n.state.lang,
  phone: storedPhone ? formatPhoneForDisplay(storedPhone) : '',
});

// 使用 computed 确保翻译文本响应式更新
const translations = computed(() => {
  // 依赖 i18nVersion 确保语言切换时重新计算
  i18nVersion.value;
  return {
    phoneTitle: i18n.t('phoneTitle'),
    phoneDescription: i18n.t('phoneDescription'),
    phoneNumberLabel: i18n.t('phoneNumberLabel'),
    phonePlaceholder: i18n.t('phonePlaceholder'),
    phoneInvalid: i18n.t('phoneInvalid'),
    phoneConfirm: i18n.t('phoneConfirm'),
    submitting: i18n.t('submitting'),
  };
});

i18n.onChange((lang) => {
  state.lang = lang;
  i18nVersion.value++; // 触发 translations 重新计算
});

// 验证手机号 - 实时验证
const phoneValidation = computed(() => {
  const phone = state.phone;
  
  // 如果为空或未输入，不显示任何验证结果
  if (!phone || phone.length === 0) {
    return { isValid: false, isPossible: false, error: null, showCheck: false, showError: false };
  }
  
  try {
    // 检查长度
    const lengthValidation = validatePhoneNumberLength(phone, DEFAULT_COUNTRY);
    
    // 检查是否可能是有效号码
    const isPossible = isPossiblePhoneNumber(phone, DEFAULT_COUNTRY);
    
    // 检查是否完全有效
    const isValid = isValidPhoneNumber(phone, DEFAULT_COUNTRY);
    
    // 如果完全有效，显示对号
    if (isValid) {
      return { isValid: true, isPossible: true, error: null, showCheck: true, showError: false };
    }
    
    // 如果输入长度太短，不显示错误（可能还在输入中）
    // 只有当输入了一定字符后才显示错误提示
    const minLengthForError = 4; // 至少输入4个字符后才显示错误
    if (phone.replace(/\D/g, '').length < minLengthForError) {
      return { isValid: false, isPossible, error: null, showCheck: false, showError: false };
    }
    
    // 根据长度验证结果返回不同错误
    if (lengthValidation === 'TOO_SHORT') {
      return { isValid: false, isPossible, error: 'TOO_SHORT', showCheck: false, showError: true };
    } else if (lengthValidation === 'TOO_LONG') {
      return { isValid: false, isPossible, error: 'TOO_LONG', showCheck: false, showError: true };
    } else if (!isPossible) {
      return { isValid: false, isPossible: false, error: 'INVALID_FORMAT', showCheck: false, showError: true };
    } else {
      return { isValid: false, isPossible, error: 'INVALID', showCheck: false, showError: true };
    }
  } catch (err) {
    return { isValid: false, isPossible: false, error: 'INVALID_FORMAT', showCheck: false, showError: false };
  }
});

const isValidPhone = computed(() => phoneValidation.value.isValid);
const showError = computed(() => phoneValidation.value.showError);
const showCheckMark = computed(() => phoneValidation.value.showCheck);
const isSubmitting = ref(false);

const setLang = async (lang) => {
  await i18n.setLang(lang);
  state.lang = lang;
};

const onPhoneInput = (event) => {
  const input = event?.target;
  if (!input) return;
  
  // 获取用户输入的原始值（从事件对象，而不是state）
  const rawValue = input.value;
  const cursorPos = input.selectionStart ?? 0;
  
  // 每次创建新的 AsYouType 实例进行格式化
  const formatter = new AsYouType(DEFAULT_COUNTRY);
  const formatted = formatter.input(rawValue);
  
  // 如果格式化后没有变化，直接返回
  if (formatted === rawValue) {
    state.phone = rawValue;
    return;
  }
  
  // 更新为格式化后的值
  state.phone = formatted;
  
  // 使用 nextTick 确保 DOM 更新后再设置光标
  nextTick(() => {
    if (!phoneInput.value) return;
    
    // 计算新的光标位置
    const lengthDiff = formatted.length - rawValue.length;
    let newCursorPos = cursorPos + lengthDiff;
    
    // 确保光标在有效范围内
    newCursorPos = Math.max(0, Math.min(newCursorPos, formatted.length));
    
    phoneInput.value.setSelectionRange(newCursorPos, newCursorPos);
  });
};

const confirmPhone = async () => {
  // 检查号码是否有效
  if (!isValidPhone.value || isSubmitting.value) return;
  
  const parsed = safeParsePhone(state.phone);
  if (!parsed) return;

  isSubmitting.value = true;
  try {
    // 转换为本地格式（0 开头）保存到 cookie
    // 将 E.164 格式 (+6281234567890) 转换为本地格式 (081234567890)
    const nationalNumber = parsed.formatNational();
    // 移除所有非数字字符，确保存储纯数字格式
    const phoneToStore = nationalNumber.replace(/\D/g, '');
    
    setCookie(PHONE_COOKIE_KEY, phoneToStore, 365);
    state.phone = parsed.formatInternational();
    const redirectTo = typeof route.query.redirect === 'string' && route.query.redirect ? route.query.redirect : null;
    await router.replace(redirectTo || { name: 'scan' });
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  if (phoneInput.value?.focus) {
    phoneInput.value.focus();
  }
});
</script>

<style scoped>
.phone-view {
  min-height: 100vh;
  padding: 24px 16px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
}

.language-bar {
  align-self: stretch;
  display: flex;
  justify-content: flex-end;
  max-width: 520px;
  width: 100%;
}

.phone-card {
  width: min(520px, 100%);
  margin-top: clamp(32px, 8vh, 72px);
  background: #ffffff;
  border-radius: 20px;
  padding: clamp(20px, 5vw, 36px);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.phone-title {
  font-size: clamp(1.5rem, 2.5vw, 2rem);
  margin: 0;
  color: #0f172a;
}

.phone-description {
  margin: 0;
  color: #475569;
  line-height: 1.6;
}

.input-label {
  font-weight: 600;
  color: #0f172a;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrapper input {
  width: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid #cbd5f5;
  background: #f8fafc;
  font-size: 16px;
  line-height: 1.4;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-wrapper input.has-check {
  padding-right: 48px;
}

.input-wrapper input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
  background: #ffffff;
}

.input-wrapper input[aria-invalid='true'] {
  border-color: #f97316;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
}

.check-icon {
  position: absolute;
  right: 16px;
  font-size: 24px;
  font-weight: bold;
  color: #10b981;
  pointer-events: none;
  animation: checkIn 0.3s ease-out;
}

@keyframes checkIn {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.error-text {
  margin: -6px 0 0;
  color: #f97316;
  font-size: 14px;
}

.confirm-btn {
  margin-top: 8px;
  border: none;
  border-radius: 999px;
  padding: 14px 18px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.confirm-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  box-shadow: none;
}

.confirm-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.35);
}

@media (max-width: 600px) {
  .phone-view {
    padding: 16px 12px 32px;
  }

  .phone-card {
    gap: 16px;
    padding: clamp(18px, 6vw, 28px);
    border-radius: 16px;
    box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
  }

  .language-bar {
    justify-content: center;
  }
}
</style>
