<template>
  <div class="wrap scan-view">
    <LanguageSwitcher v-model="state.lang" @change="setLang" />

    <div><h1>{{ t('scanTitle') }}</h1></div>

    <section id="container" class="scan-area container" v-show="!state.hasDN">
      <div id="div-ui-container" style="width: 100%; height: 100%">
        <div class="dce-video-container" style="position: relative; width: 100%; height: 100%"></div>
      </div>

      <div class="corners">
        <div class="c tl"></div>
        <div class="c tr"></div>
        <div class="c bl"></div>
        <div class="c br"></div>
      </div>
    </section>

    <div class="did-input card" style="margin-top: 12px">
      <label for="dnInput">{{ t('didLabel') }}</label>
      <div class="did-row" style="display: flex; align-items: center; gap: 5px">
        <span
          id="error-icon"
          v-if="!state.isValid"
          style="color: red; margin-left: 10px; font-size: 20px"
        >
          ❌
        </span>
        <span
          id="success-icon"
          v-if="state.isValid"
          style="color: green; margin-left: 10px; font-size: 20px"
        >
          ✅
        </span>

        <input
          id="dnInput"
          ref="dnInput"
          class="mono"
          maxlength="20"
          v-model="state.dnNumber"
          style="flex: 1"
          @input="onDNInput"
        />

        <button class="okBtn" type="button" @click="onOkClick">OK</button>
      </div>
    </div>

    <button
      class="tag"
      v-if="torchTagVisible"
      @click="toggleTorch"
      :aria-pressed="state.torchOn"
      style="cursor: pointer; user-select: none"
    >
      {{ t('torch') }}：<b>{{ state.torchOn ? t('on') : t('off') }}</b>
    </button>

    <div class="row" v-if="showScanControls">
      <button class="primary" @click="start" :disabled="state.running">
        {{ t('startScan') }}
      </button>
      <button class="ghost" @click="stop" :disabled="!state.running">
        {{ t('stop') }}
      </button>
      <button class="ghost" @click="nextCamera" :disabled="!state.running">
        {{ t('switchCamera') }}
      </button>
    </div>

    <div class="card" v-if="state.hasDN">
      <div class="row">
        <button class="primary" @click="resume">{{ t('restart') }}</button>
      </div>

      <template v-if="state.isValid">
        <div class="status-box" v-show="!state.submitOk">
          <div class="status-row" :class="{ shake: state.needsStatusShake }">
            <label for="dnStatus">{{ t('updateStatus') }}：</label>
            <select
              id="dnStatus"
              class="status"
              :class="{ invalid: state.needsStatusHint }"
              v-model="state.dnStatus"
              aria-invalid="true"
              @change="() => { state.needsStatusHint = false; state.needsStatusShake = false; }"
            >
              <option value="" disabled>{{ t('choose') }}</option>
              <option
                v-for="option in scanStatusOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ t(option.filterLabelKey) }}
              </option>
            </select>
          </div>
          <div class="hint" v-if="state.needsStatusHint">
            {{ t('needSelectStatus') }}
          </div>

          <div class="flex-2">
            <div class="col">
              <label style="display: block; margin-bottom: 6px">{{ t('remark') }}</label>
              <textarea v-model="state.remark" :placeholder="t('remarkPlaceholder')"></textarea>
            </div>
            <div class="col">
              <label style="display: block; margin-bottom: 6px">{{ t('uploadPhoto') }}</label>
              <div class="uploader">
                <img
                  v-if="state.photoPreview"
                  :src="state.photoPreview"
                  alt="preview"
                  class="thumb"
                />
                <div style="display: flex; flex-direction: column; gap: 8px">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    @change="onPickPhoto"
                  />
                  <small class="muted">{{ t('photoTip') }}</small>
                  <button v-if="state.photoFile" class="ghost" @click="clearPhoto">
                    {{ t('removePhoto') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            class="primary"
            style="align-self: flex-start"
            @click="submitUpdate"
            :disabled="!state.isValid || state.submitting"
          >
            {{ state.submitting ? t('submitting') : t('submit') }}
          </button>

          <div v-if="state.submitting">
            <div class="progress" :class="{ indeterminate: !state.photoFile }">
              <div
                class="progress-bar"
                :style="{ width: (state.photoFile ? state.uploadPct : 100) + '%' }"
              ></div>
            </div>
            <div class="progress-text">
              {{
                state.photoFile
                  ? `${t('uploadingPct')} ${state.uploadPct}%`
                  : t('submittingDots')
              }}
            </div>
          </div>

          <div v-if="state.submitMsg" :class="[state.submitOk ? 'ok' : 'err']">
            {{ state.submitMsg }}
          </div>
        </div>

        <div class="result-box" v-if="state.showResult">
          <h3>{{ t('submittedTitle') }}</h3>
          <div
            class="result-row"
            v-for="row in submitSummaryRows"
            :key="row.key"
          >
            <span class="k">{{ row.label }}:</span>
            <span class="v" :class="{ mono: row.mono }">{{ row.value }}</span>
          </div>
          <div class="result-row" v-if="state.submitView.photo">
            <span class="k">{{ t('photoLabel') }}:</span>
            <img :src="state.submitView.photo" class="thumb" alt="thumb" />
          </div>
        </div>
      </template>

      <template v-else>
        <div class="err">{{ t('invalidId') }}</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import Toastify from 'toastify-js';
import { createI18n } from '../i18n/core';
import { useBodyTheme } from '../composables/useBodyTheme';
import { useUpload } from '../composables/useUpload';
import { useAuth } from '../composables/useAuth';
import { useDeviceDetection } from '../composables/useDeviceDetection';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import { getApiBase, getDynamsoftLicenseKey } from '../utils/env.js';
import { isValidDn } from '../utils/dn.js';
import { DN_SCAN_STATUS_ITEMS } from '../config.js';
import { getCookie } from '../utils/cookie.js';

const LICENSE_KEY = getDynamsoftLicenseKey();
const PHONE_COOKIE_KEY = 'phone_number';

if (LICENSE_KEY && window?.Dynamsoft?.DBR?.BarcodeScanner) {
  window.Dynamsoft.DBR.BarcodeScanner.license = LICENSE_KEY;
} else if (!LICENSE_KEY) {
  console.warn('Dynamsoft license key is not configured. Scanner features may be unavailable.');
}

const i18n = createI18n({
  namespaces: ['index'],
  fallbackLang: 'id',
  defaultLang: 'id',
});
await i18n.init(); // 自动设置 document.documentElement.lang

useBodyTheme('scan-theme');

// 初始化 composables
const { uploadWithProgress } = useUpload();
const { getStoredUserName } = useAuth();
const { isMobile: isMobileClient, browserId: browserIdentifier } = useDeviceDetection();
const router = useRouter();
const phoneNumber = ref(getCookie(PHONE_COOKIE_KEY) || '');

const refreshPhoneNumber = () => {
  const stored = getCookie(PHONE_COOKIE_KEY);
  phoneNumber.value = stored || '';
  return phoneNumber.value;
};

const state = reactive({
  lang: i18n.state.lang,
  location: null,
  hasDN: false,
  dnNumber: '',
  dnStatus: '',
  remark: '',
  photoFile: null,
  photoPreview: null,
  torchOn: false,
  running: false,
  last: false,
  isValid: false,
  needsStatusHint: false,
  needsStatusShake: false,
  submitting: false,
  submitOk: false,
  submitMsg: '',
  showResult: false,
  submitView: {},
  uploadPct: 0,
});

// 使用版本号强制响应式更新
const i18nVersion = ref(0);

i18n.onChange((lang) => {
  state.lang = lang;
  i18nVersion.value++; // 触发所有使用 t() 的地方重新渲染
  // document.documentElement.lang 现在由 i18n 核心模块自动更新
});

const dnInput = ref(null);
let scanner = null;

const t = (key, vars) => {
  // 依赖 i18nVersion 确保语言切换时模板重新渲染
  i18nVersion.value;
  return i18n.t(key, vars);
};

const showScanControls = computed(() => !state.isValid);
const torchTagVisible = computed(() => state.running && !state.isValid);
const submitSummaryRows = computed(() => {
  // depend on language changes so labels re-render with the active locale
  state.lang;
  const view = state.submitView || {};

  return [
    {
      key: 'phoneNumber',
      label: t('phoneNumberLabel'),
      value: formatResultText(view.phoneNumber ?? phoneNumber.value),
      mono: true,
    },
    {
      key: 'dnNumber',
      label: t('dnNumberLabel'),
      value: formatResultText(view.dnNumber),
      mono: true,
    },
    {
      key: 'status',
      label: t('statusLabel'),
      value: formatResultText(statusLabel(view.status)),
    },
    {
      key: 'remark',
      label: t('remarkLabel'),
      value: formatResultText(view.remark, true),
    },
    {
      key: 'lng',
      label: t('lng'),
      value: formatCoordinate(view.lng),
    },
    {
      key: 'lat',
      label: t('lat'),
      value: formatCoordinate(view.lat),
    },
  ];
});

const validateDN = (text) => isValidDn(text);

const getLocation = async () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(`Location error (${err.code}): ${err.message || 'Unknown'}`))
    );
  });

const start = async () => {
  if (!scanner) return;
  try {
    await scanner.show();
    state.running = true;
  } catch (e) {
    state.submitOk = false;
    state.submitMsg = e?.message || 'Camera start failed';
  }
};

const stop = async () => {
  if (!scanner) return;
  try {
    await scanner.stop();
    state.running = false;
  } catch (e) {
    state.submitOk = false;
    state.submitMsg = e?.message || 'Camera stop failed';
  }
};

const setTorch = async (on) => {
  if (!scanner) return;
  try {
    if (on) {
      await scanner.turnOnTorch();
    } else {
      await scanner.turnOffTorch();
    }
    state.torchOn = on;
  } catch (e) {
    Toastify({
      text: t('torchFailed') || 'Torch toggle failed',
      duration: 1000,
      gravity: 'bottom',
      position: 'center',
      style: { background: 'linear-gradient(to right, #ff3333,  #ff3333)' },
    }).showToast();
  }
};

const toggleTorch = async () => {
  await setTorch(!state.torchOn);
};

const nextCamera = async () => {
  if (!scanner) return;
  const cameras = await scanner.getAllCameras();
  if (!Array.isArray(cameras) || cameras.length === 0) return;
  if (cameras.length === 1) {
    Toastify({
      text: t('onlyOneCamera') || 'Only one camera',
      duration: 1000,
      gravity: 'bottom',
      position: 'center',
    }).showToast();
    return;
  }
  const current = await scanner.getCurrentCamera();
  const idx = Math.max(0, cameras.findIndex((c) => c.deviceId === current?.deviceId));
  const next = cameras[(idx + 1) % cameras.length];
  await scanner.setCurrentCamera(next);
  Toastify({
    text: next?.label || 'Camera',
    duration: 1000,
    gravity: 'bottom',
    position: 'center',
    style: { background: 'linear-gradient(to right, #00b09b, #96c93d)' },
  }).showToast();
};

const resume = async () => {
  state.last = false;
  state.showResult = false;
  state.submitMsg = '';
  state.submitOk = false;
  state.dnStatus = '';
  state.remark = '';
  state.photoFile = null;
  if (state.photoPreview) URL.revokeObjectURL(state.photoPreview);
  state.photoPreview = null;
  state.needsStatusHint = false;
  state.needsStatusShake = false;
  state.hasDN = false;
  state.isValid = false;
  state.dnNumber = '';
  try {
    await start();
  } catch (e) {
    console.error(e);
  }
};

const onPickPhoto = (e) => {
  const f = e.target.files?.[0] || null;
  state.photoFile = f;
  if (state.photoPreview) URL.revokeObjectURL(state.photoPreview);
  state.photoPreview = f ? URL.createObjectURL(f) : null;
};

const clearPhoto = () => {
  state.photoFile = null;
  if (state.photoPreview) URL.revokeObjectURL(state.photoPreview);
  state.photoPreview = null;
};

const scanStatusOptions = DN_SCAN_STATUS_ITEMS || [];
const scanStatusMetaMap = new Map(scanStatusOptions.map((item) => [item.value, item]));

const STATUS_TRANSLATION_MAP = scanStatusOptions.reduce(
  (acc, item) => {
    acc[item.value] = item.filterLabelKey;
    return acc;
  },
  {
    '运输中': 'inTransit',
    '过夜': 'overnight',
    '已到达': 'arrived',
  }
);

const statusLabel = (v) => {
  if (!v) return '-';
  const meta = scanStatusMetaMap.get(v);
  if (meta) {
    const key = STATUS_TRANSLATION_MAP[v];
    if (key) {
      const translated = t(key);
      if (translated && translated !== key) return translated;
    }
    if (meta.fallbackLabel) return meta.fallbackLabel;
  } else {
    const key = STATUS_TRANSLATION_MAP[v];
    if (key) {
      const translated = t(key);
      if (translated && translated !== key) return translated;
    }
  }
  return v;
};

const formatResultText = (val, allowTrim = false) => {
  if (val == null) return '-';
  if (typeof val === 'string') {
    const text = allowTrim ? val.trim() : val;
    return text === '' ? '-' : text;
  }
  return String(val);
};

const formatCoordinate = (val) => {
  if (val == null) return '-';
  const num = Number(val);
  if (Number.isFinite(num)) {
    return String(Math.round(num * 1e6) / 1e6);
  }
  return formatResultText(val);
};

// resolveClientProfile, getStoredUserName, uploadWithProgress 现在来自 composables

const submitUpdate = async () => {
  if (!state.isValid) return;
  if (!state.dnStatus) {
    state.needsStatusHint = true;
    state.needsStatusShake = true;
    return;
  }

  if (!state.photoFile && !state.photoPreview) {
    Toastify({
      text: t('needWatermarkedPhoto'),
      duration: 3000,
      gravity: 'bottom',
      position: 'center',
    }).showToast();
    return;
  }

  state.submitting = true;
  state.uploadPct = 0;
  state.submitMsg = '';
  state.submitOk = false;

  const currentPhone = refreshPhoneNumber();

  if (!currentPhone) {
    state.submitting = false;
    Toastify({
      text: t('phoneMissingToast'),
      duration: 2500,
      gravity: 'bottom',
      position: 'center',
    }).showToast();
    await router.replace({ name: 'phone', query: { redirect: '/' } });
    return;
  }

  try {
    const API_BASE = getApiBase();

    if (!API_BASE) {
      await new Promise((r) => setTimeout(r, 300));
      state.uploadPct = 100;
      state.submitOk = true;
      state.submitMsg = t('submitSuccess') || 'Submitted';

      state.submitView = {
        phoneNumber: currentPhone,
        dnNumber: state.dnNumber,
        status: state.dnStatus,
        remark: state.remark,
        photo: state.photoPreview || null,
        lng: state.location?.lng,
        lat: state.location?.lat,
      };
      state.showResult = true;
      state.last = true;
      return;
    }

    const url = API_BASE.replace(/\/+$/, '') + '/api/dn/update';

    const fd = new FormData();
    fd.append('dnNumber', state.dnNumber);
    fd.append('status', state.dnStatus ?? '');
    fd.append('remark', state.remark ?? '');
    fd.append('lng', state.location?.lng ?? '');
    fd.append('lat', state.location?.lat ?? '');
  fd.append('phone_number', currentPhone);
    const storedUserName = getStoredUserName();
    fd.append('updated_by', storedUserName || (isMobileClient ? 'driver' : browserIdentifier));

    if (state.photoFile instanceof File) {
      fd.append('photo', state.photoFile, state.photoFile.name || 'photo');
    } else if (typeof state.photoPreview === 'string' && state.photoPreview) {
      fd.append('photo', state.photoPreview);
    } else {
      fd.append('photo', '');
    }

    await uploadWithProgress({
      url,
      formData: fd,
      onProgress: (pct) => {
        state.uploadPct = Math.min(99, pct);
      },
      timeoutMs: 15000,
    });

    state.uploadPct = 100;
    state.submitOk = true;
    state.submitMsg = t('submitSuccess') || 'Submitted';

    state.submitView = {
      phoneNumber: currentPhone,
      dnNumber: state.dnNumber,
      status: state.dnStatus,
      remark: state.remark,
      photo: state.photoPreview || null,
      lng: state.location?.lng,
      lat: state.location?.lat,
    };
    state.showResult = true;
    state.last = true;
  } catch (e) {
    const prefix = t('submitHttpErrPrefix') || 'Submit failed: ';
    state.submitOk = false;
    state.submitMsg = `${prefix}${e?.message || 'Error'}`;
    console.error('submit error', e);
  } finally {
    state.submitting = false;
  }
};

const onCodeScanned = async (codeResult) => {
  state.isValid = validateDN(codeResult);
  if (state.isValid) {
    await stop();
    hideKeyboard();
    state.dnNumber = codeResult.toUpperCase();
  }
};

const onDNInput = () => {
  state.dnNumber = (dnInput.value?.value || '').toUpperCase();
  state.isValid = validateDN(state.dnNumber);
};

const onOkClick = async () => {
  state.dnNumber = (dnInput.value?.value || '').toUpperCase();
  state.isValid = validateDN(state.dnNumber);

  if (state.isValid) {
    await stop();
    hideKeyboard();
    state.hasDN = true;
  }

  try {
    const location = await getLocation();
    state.location = {
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
    };
  } catch (e) {
    console.error('Failed to get location:', e);
    state.location = { lat: null, lng: null };
  }
};

const hideKeyboard = () => {
  try {
    const el = dnInput.value;
    if (el && typeof el.blur === 'function') {
      const wasReadonly = el.readOnly;
      el.readOnly = true;
      el.blur();
      el.readOnly = wasReadonly;
    }
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    setTimeout(() => {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  } catch (err) {
    console.error(err);
  }
};

const setLang = async (lang) => {
  await i18n.setLang(lang);
  state.lang = lang;
};

onMounted(async () => {
  const currentPhone = refreshPhoneNumber();
  if (!currentPhone) {
    const redirectTo = router.currentRoute?.value?.fullPath || '/';
    await router.replace({ name: 'phone', query: { redirect: redirectTo } });
    return;
  }

  const storedUserName = getStoredUserName();
  if (storedUserName) {
    Toastify({
      text: `You are logged in as ${storedUserName}.`,
      duration: 3000,
      gravity: 'bottom',
      position: 'center',
    }).showToast();
  }

  if (!window?.Dynamsoft?.DBR?.BarcodeScanner) {
    state.submitOk = false;
    state.submitMsg = 'Scanner SDK not loaded';
    return;
  }
  try {
    scanner = await window.Dynamsoft.DBR.BarcodeScanner.createInstance();
    const container = document.getElementById('div-ui-container');
    if (container) {
      await scanner.setUIElement(container);
    }
    scanner.setVideoFit('cover');
    scanner.barcodeFillStyle = 'rgba(73, 245, 73, 0)';
    scanner.barcodeLineWidth = 5;
    scanner.barcodeStrokeStyle = 'rgba(73, 245, 73, 1)';
    scanner.onUniqueRead = (txt) => {
      onCodeScanned(txt);
    };
    await start();
  } catch (e) {
    state.submitOk = false;
    state.submitMsg = e?.message || 'Camera start failed';
  }
});

onBeforeUnmount(async () => {
  try {
    await stop();
  } catch {}
  if (state.photoPreview) {
    URL.revokeObjectURL(state.photoPreview);
  }
  try {
    await scanner?.destroyContext?.();
  } catch {}
});
</script>

<style scoped>
.scan-view {
  padding-bottom: 40px;
}
</style>
