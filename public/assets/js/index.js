const { createApp, reactive, ref, onMounted, computed } = window.Vue;

// --- i18n 初始化（扁平 JSON + 显式 ns）---
const i18n = I18NCore.createI18n({
  namespaces: ["index"],
  lang: I18NCore.detectLang("zh"),
  fallbackLang: "zh"
});
await i18n.init();

await i18n.setLang("zh");

// --- 全局状态 ---
const state = reactive({
  ...i18n.state,
  hasDid: false,
  didDigits: "",
  duStatus: "",
  remark: "",
  photoFile: null,
  photoPreview: null,
  torchOn: false,
  torchSupported: false,
  running: false,
  last: false,
  isValid: false,
  needsStatusHint: false,
  needsStatusShake: false,
  submitting: false,
  submitOk: false,
  submitMsg: "",
  showResult: false,
  submitView: {},
  uploadPct: 0,
});

// --- ZXing & 媒体相关 ---
let reader = null;
let currentDeviceId = null;
let devices = [];
let deviceIndex = 0;
let currentStream = null;

async function setTorch(on) {
  if (!currentStream) return false;
  const track = currentStream.getVideoTracks()[0];
  if (!track) return false;
  const caps = track.getCapabilities?.() || {};
  if (!('torch' in caps)) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: !!on }] });
    state.torchOn = !!on;
    return true;
  } catch {
    return false;
  }
}

function extractDidDigits(text) {
  const m = String(text || '').match(/DID\s*([0-9]{6,20})/i) || String(text || '').match(/([0-9]{10,20})/);
  return m ? m[1].slice(0, 13) : "";
}

function validateDid(digits) {
  return /^\d{13}$/.test(digits);
}

async function enumerateCameras() {
  const all = await navigator.mediaDevices.enumerateDevices();
  devices = all.filter(d => d.kind === 'videoinput');
  if (devices.length === 0) throw new Error('No camera found');
  const backIndex = devices.findIndex(d => /back|rear|environment/i.test(d.label));
  deviceIndex = backIndex >= 0 ? backIndex : 0;
  currentDeviceId = devices[deviceIndex].deviceId;
}

async function startReader(videoEl) {
  const { BrowserMultiFormatReader } = window.ZXingBrowser || {};
  if (!BrowserMultiFormatReader) throw new Error('ZXing UMD not loaded');
  if (!reader) reader = new BrowserMultiFormatReader();

  if (!devices.length) await enumerateCameras();
  const deviceId = currentDeviceId || devices[deviceIndex]?.deviceId;
  state.running = true;

  await reader.decodeFromVideoDevice(deviceId, videoEl, result => {
    if (!result) return;
    const digits = extractDidDigits(result.getText ? result.getText() : result.text);
    if (digits) {
      state.didDigits = digits;
      state.isValid = validateDid(digits);
      if (state.isValid) {
        state.hasDid = true;
        stopReader();
        hideKeyboard(didInput);
      }
    }
  });

  currentStream = videoEl.srcObject;
  try {
    const track = currentStream?.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.();
    state.torchSupported = !!(caps && 'torch' in caps);
  } catch {
    state.torchSupported = false;
  }
}

async function stopReader() {
  try {
    await reader?.reset();
  } catch {}
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
  state.running = false;
  state.torchOn = false;
}

function tFactory(ns) {
  return (key, vars) => i18n.t(`${ns}.${key}`, vars);
}

// --- Vue App ---
const app = createApp({
  setup() {
    const t = (key, vars) => i18n.t(key, { ...(vars || {}), ns: "index" });
    const setLang = async (lang) => {
      await i18n.setLang(lang);
      state.lang = lang;
    };

    onMounted(async () => {
      try {
        await start();
      } catch (e) {
        state.submitOk = false;
        state.submitMsg = (e && e.message) || 'Camera start failed';
      }
    });

    const video = ref(null);
    const didInput = ref(null);

    const showScanControls = computed(() => !state.isValid);

    const torchTagVisible = computed(() => state.running && !state.isValid && state.torchSupported);

    const onDidInput = () => {
      state.didDigits = state.didDigits.replace(/\D+/g, '').slice(0, 13);
      const wasValid = state.isValid;
      state.isValid = validateDid(state.didDigits);
      state.hasDid = state.didDigits.length > 0;

      if (!wasValid && state.isValid) {
        hideKeyboard(didInput);
      }
    };

    const start = async () => {
      if (!video.value) return;
      try {
        await startReader(video.value);
      } catch (e) {
        state.submitOk = false;
        state.submitMsg = (e && e.message) || 'Camera start failed';
      }
    };

    const stop = async () => {
      await stopReader();
    };

    const toggleTorch = async () => {
      if (!state.torchSupported) return;
      await setTorch(!state.torchOn);
    };

    const nextCamera = async () => {
      if (!devices.length) await enumerateCameras();
      deviceIndex = (deviceIndex + 1) % devices.length;
      currentDeviceId = devices[deviceIndex].deviceId;
      if (state.running && video.value) {
        await stopReader();
        await startReader(video.value);
      }
    };

    const resume = async () => {
      state.last = false;
      state.showResult = false;
      state.submitMsg = '';
      state.submitOk = false;
      state.duStatus = '';
      state.remark = '';
      state.photoFile = null;
      state.photoPreview = null;
      state.needsStatusHint = false;
      state.needsStatusShake = false;
      state.hasDid = false;
      state.isValid = false;
      state.didDigits = '';
      try { didInput.value?.focus(); } catch {}
    };

    const onPickPhoto = (e) => {
      const f = e.target.files?.[0];
      state.photoFile = f || null;
      if (f) {
        state.photoPreview = URL.createObjectURL(f);
      } else {
        state.photoPreview = null;
      }
    };

    const clearPhoto = () => {
      state.photoFile = null;
      if (state.photoPreview) URL.revokeObjectURL(state.photoPreview);
      state.photoPreview = null;
    };

    function statusLabel(v) {
      if (v === "运输中") return t("inTransit");
      if (v === "过夜") return t("overnight");
      if (v === "已到达") return t("arrived");
      return v || "-";
    }

    function uploadWithProgress({ url, formData, onProgress, timeoutMs = 15000 }) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && typeof onProgress === 'function') {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            onProgress(pct);
          }
        };

        xhr.timeout = timeoutMs;
        xhr.ontimeout = () => reject(new Error('Request timeout'));

        xhr.onload = () => {
          const ok = xhr.status >= 200 && xhr.status < 300;
          if (!ok) return reject(new Error(`HTTP ${xhr.status} - ${xhr.responseText || ''}`));
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
          await new Promise(r => setTimeout(r, 300));
          state.uploadPct = 100;
          state.submitOk = true;
          state.submitMsg = t('submitOk') || 'Submitted';

          state.submitView = {
            duId: 'DID' + state.didDigits,
            status: state.duStatus,
            remark: state.remark,
            photo: state.photoPreview || null,
          };
          state.showResult = true;
          state.last = true;
          return;
        }

        const url = API_BASE.replace(/\/+$/, '') + '/api/du/update';

        const fd = new FormData();
        fd.append('duId', 'DID' + state.didDigits);
        fd.append('status', state.duStatus ?? '');
        fd.append('remark', state.remark ?? '');

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
        state.submitMsg = t('submitOk') || 'Submitted';

        state.submitView = {
          duId: 'DID' + state.didDigits,
          status: state.duStatus,
          remark: state.remark,
          photo: state.photoPreview || null,
        };
        state.showResult = true;
        state.last = true;
      } catch (e) {
        state.submitOk = false;
        state.submitMsg =
          (t('submitFailed') || 'Submit failed') +
          ': ' +
          (e && e.message ? e.message : 'Error');
        console.error('submit error', e);
      } finally {
        state.submitting = false;
      }
    };

    function hideKeyboard(inputEl) {
      try {
        const el = inputEl?.value || inputEl;
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
      } catch {}
    }

    const onRescan = async () => {
      // 保留输入框，不清引用
      state.last = false;
      state.showResult = false;
      state.submitMsg = '';
      state.submitOk = false;
    
      // 清 DID 与状态
      state.duStatus = '';
      state.remark = '';
      state.photoFile = null;
      if (state.photoPreview) URL.revokeObjectURL(state.photoPreview);
      state.photoPreview = null;
    
      state.needsStatusHint = false;
      state.needsStatusShake = false;
    
      state.hasDid = false;
      state.isValid = false;
      state.didDigits = '';
    
      // 重启摄像头扫描（如果页面上 video 已经挂载）
      try {
        await stopReader();
        if (video.value) await startReader(video.value);
      } catch (e) {
        console.warn('Rescan failed:', e);
      }
    
      // 重新聚焦输入框（保留输入框可用）
      try { didInput.value?.focus(); } catch {}
    };
    

    return {
      t,
      setLang,
      state,
      video,
      didInput,
      onDidInput,
      start,
      stop,
      toggleTorch,
      nextCamera,
      resume,
      onPickPhoto,
      clearPhoto,
      submitUpdate,
      statusLabel,
      showScanControls,
      torchTagVisible,
      onRescan,
    };
  }
});

app.mount("#app");
