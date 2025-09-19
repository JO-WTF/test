<template>
  <div class="wrap scan-view">
    <div class="lang-switch">
      <button
        :class="{ active: state.lang === 'zh' }"
        @click="() => setLang('zh')"
        aria-label="切换为中文"
      >
        <img src="https://flagcdn.com/w20/cn.png" alt="CN" />中文
      </button>
      <button
        :class="{ active: state.lang === 'en' }"
        @click="() => setLang('en')"
        aria-label="Switch to English"
      >
        <img src="https://flagcdn.com/w20/gb.png" alt="GB" />English
      </button>
      <button
        :class="{ active: state.lang === 'id' }"
        @click="() => setLang('id')"
        aria-label="Beralih ke Bahasa Indonesia"
      >
        <img src="https://flagcdn.com/w20/id.png" alt="ID" />Indonesia
      </button>
    </div>

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
          v-model="state.DNID"
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
        <div class="status-box">
          <div class="status-row" :class="{ shake: state.needsStatusShake }">
            <label for="duStatus">{{ t('updateStatus') }}：</label>
            <select
              id="duStatus"
              class="status"
              :class="{ invalid: state.needsStatusHint }"
              v-model="state.duStatus"
              aria-invalid="true"
              @change="() => { state.needsStatusHint = false; state.needsStatusShake = false; }"
            >
              <option value="" disabled>{{ t('choose') }}</option>
              <option value="运输中">{{ t('inTransit') }}</option>
              <option value="已到达">{{ t('arrived') }}</option>
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
                  <input type="file" accept="image/*" @change="onPickPhoto" />
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
          <div class="result-row">
            <span class="k">{{ t('duIdLabel') }}:</span
            ><span class="v mono">{{ state.submitView.duId }}</span>
          </div>
          <div class="result-row">
            <span class="k">{{ t('statusLabel') }}:</span
            ><span class="v">{{ statusLabel(state.submitView.status) }}</span>
          </div>
          <div class="result-row">
            <span class="k">{{ t('remarkLabel') }}:</span
            ><span class="v">{{ state.submitView.remark || '-' }}</span>
          </div>
          <div class="result-row">
            <span class="k">{{ t('lng') }}:</span
            ><span class="v">{{ state.submitView.lng || '-' }}</span>
          </div>
          <div class="result-row">
            <span class="k">{{ t('lat') }}:</span
            ><span class="v">{{ state.submitView.lat || '-' }}</span>
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
import Toastify from 'toastify-js';
import { createI18n, detectLang } from '../i18n/core';

const LICENSE_KEY =
  'DLS2eyJoYW5kc2hha2VDb2RlIjoiMTA0NTQzNDEwLU1UQTBOVFF6TkRFd0xYZGxZaTFVY21saGJGQnliMm8iLCJtYWluU2VydmVyVVJMIjoiaHR0cHM6Ly9tZGxzLmR5bmFtc29mdG9ubGluZS5jb20iLCJvcmdhbml6YXRpb25JRCI6IjEwNDU0MzQxMCIsInN0YW5kYnlTZXJ2ZXJVUkwiOiJodHRwczovL3NkbHMuZHluYW1zb2Z0b25saW5lLmNvbSIsImNoZWNrQ29kZSI6MTg2NjI4MDUzMX0=';

if (window?.Dynamsoft?.DBR?.BarcodeScanner) {
  window.Dynamsoft.DBR.BarcodeScanner.license = LICENSE_KEY;
}

const i18n = createI18n({
  namespaces: ['index'],
  lang: detectLang('id'),
  fallbackLang: 'id',
});
await i18n.init();

const state = reactive({
  lang: i18n.state.lang,
  location: null,
  hasDN: false,
  DNID: '',
  duStatus: '',
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

i18n.onChange((lang) => {
  state.lang = lang;
  document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : lang);
});

const dnInput = ref(null);
let scanner = null;

const t = (key, vars) => i18n.t(key, vars);

const showScanControls = computed(() => !state.isValid);
const torchTagVisible = computed(() => state.running && !state.isValid);

const validateDN = (text) => /^(?=.{14,18}$)[A-Za-z]{1,5}[0-9A-Za-z]+$/.test(text);

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
  state.duStatus = '';
  state.remark = '';
  state.photoFile = null;
  if (state.photoPreview) URL.revokeObjectURL(state.photoPreview);
  state.photoPreview = null;
  state.needsStatusHint = false;
  state.needsStatusShake = false;
  state.hasDN = false;
  state.isValid = false;
  state.DNID = '';
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

const statusLabel = (v) => {
  if (v === '运输中') return t('inTransit');
  if (v === '过夜') return t('overnight');
  if (v === '已到达') return t('arrived');
  return v || '-';
};

function uploadWithProgress({ url, formData, onProgress, timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.onprogress = (evt) => {
      if (typeof onProgress === 'function') {
        const pct = evt && evt.lengthComputable && evt.total > 0
          ? Math.round((evt.loaded / evt.total) * 100)
          : 0;
        onProgress(pct);
      }
    };

    xhr.timeout = timeoutMs;
    xhr.ontimeout = () => reject(new Error('Request timeout'));

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      if (!ok) {
        reject(new Error(`HTTP ${xhr.status} - ${xhr.responseText || ''}`));
        return;
      }
      resolve(xhr.responseText);
    };

    xhr.onerror = () => reject(new Error('Network error'));

    xhr.send(formData);
  });
}

const submitUpdate = async () => {
  if (!state.isValid) return;
  if (!state.duStatus) {
    state.needsStatusHint = true;
    state.needsStatusShake = true;
    return;
  }

  state.submitting = true;
  state.uploadPct = 0;
  state.submitMsg = '';
  state.submitOk = false;

  try {
    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';

    if (!API_BASE) {
      await new Promise((r) => setTimeout(r, 300));
      state.uploadPct = 100;
      state.submitOk = true;
      state.submitMsg = t('submitSuccess') || 'Submitted';

      state.submitView = {
        duId: state.DNID,
        status: state.duStatus,
        remark: state.remark,
        photo: state.photoPreview || null,
        lng: state.location?.lng,
        lat: state.location?.lat,
      };
      state.showResult = true;
      state.last = true;
      return;
    }

    const url = API_BASE.replace(/\/+$/, '') + '/api/du/update';

    const fd = new FormData();
    fd.append('duId', state.DNID);
    fd.append('status', state.duStatus ?? '');
    fd.append('remark', state.remark ?? '');
    fd.append('lng', state.location?.lng ?? '');
    fd.append('lat', state.location?.lat ?? '');

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
      duId: state.DNID,
      status: state.duStatus,
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
    state.DNID = codeResult.toUpperCase();
  }
};

const onDNInput = () => {
  state.DNID = (dnInput.value?.value || '').toUpperCase();
  state.isValid = validateDN(state.DNID);
};

const onOkClick = async () => {
  state.DNID = (dnInput.value?.value || '').toUpperCase();
  state.isValid = validateDN(state.DNID);

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
