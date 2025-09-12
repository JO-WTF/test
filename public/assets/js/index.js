// 统一使用全局 UMD：不要再 import 'vue'
const { createApp, reactive, ref, onMounted } = window.Vue;

// --- i18n 初始化（扁平 JSON + 显式 ns）---
const i18n = I18NCore.createI18n({
  // 你要用多命名空间也行，这里先注册 index
  namespaces: ["index"],
  // 默认中文
  lang: I18NCore.detectLang("zh"),
  // 没做完其它语言时，回退中文，避免显示原样 key
  fallbackLang: "zh"
});
await i18n.init();

await i18n.setLang("zh");


// --- 全局状态 ---
const state = reactive({
  ...i18n.state,         // 包含 lang
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

// Torch 需要访问 track.capabilities().torch
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
  // 支持 "DID1234567890123" 或包含 DID 的任意文本
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
  // 尽量选择后置
  const backIndex = devices.findIndex(d => /back|rear|environment/i.test(d.label));
  deviceIndex = backIndex >= 0 ? backIndex : 0;
  currentDeviceId = devices[deviceIndex].deviceId;
}

async function startReader(videoEl) {
  const { BrowserMultiFormatReader } = window.ZXingBrowser || {};
  if (!BrowserMultiFormatReader) throw new Error('ZXing UMD not loaded');
  if (!reader) reader = new BrowserMultiFormatReader();

  // 先列设备
  if (!devices.length) await enumerateCameras();

  // 打开指定/当前设备
  const deviceId = currentDeviceId || devices[deviceIndex]?.deviceId;
  state.running = true;

  // 使用 ZXing 的便捷方法
  await reader.decodeFromVideoDevice(deviceId, videoEl, result => {
    if (!result) return;
    const digits = extractDidDigits(result.getText ? result.getText() : result.text);
    if (digits) {
      state.didDigits = digits;
      state.isValid = validateDid(digits);
      if (state.isValid) {
        state.hasDid = true;
        stopReader(); // 扫到就停止
      }
    }
  });

  // 保存流 & torch 支持判断
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

    (function sanityCheck() {
      const k = "scanTitle";
      const v = i18n.t(k, { ns: "index" });
      if (v === k) {
        console.warn(
          `[i18n] 未命中翻译: ns=index, key=${k}\n` +
          `请确认存在 /locales/${i18n.state.lang}/index.json（扁平结构），且静态服务器能访问。`
        );
      } else {
        console.debug("[i18n] OK:", i18n.state.lang, v);
      }
    })();

    const video = ref(null);
    const didInput = ref(null);

    onMounted(() => {
      // 可选：自动聚焦输入框
      try { didInput.value?.focus(); } catch {}

      // 为了安全起见，不自动开摄像头，由用户点击 Start
    });

    // --- 业务方法 ---
    const onDidInput = () => {
      // 只保留数字
      state.didDigits = state.didDigits.replace(/\D+/g, '').slice(0, 13);
      state.isValid = validateDid(state.didDigits);
      state.hasDid = state.didDigits.length > 0;
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
      if (v === "过夜")   return t("overnight");
      if (v === "已到达") return t("arrived");
      return v || "-";
    }

    // 可复用的小工具：XHR 上传（带进度、超时）
    function uploadWithProgress({ url, formData, onProgress, timeoutMs = 15000 }) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);

        // 真实上传进度
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && typeof onProgress === 'function') {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            onProgress(pct);
          }
        };

        // 超时
        xhr.timeout = timeoutMs;
        xhr.ontimeout = () => reject(new Error('Request timeout'));

        // 完成
        xhr.onload = () => {
          const ok = xhr.status >= 200 && xhr.status < 300;
          if (!ok) {
            // 返回文本以便调试
            return reject(new Error(`HTTP ${xhr.status} - ${xhr.responseText || ''}`));
          }
          resolve(xhr.responseText);
        };

        xhr.onerror = () => reject(new Error('Network error'));

        // 发送（不要自己设置 Content-Type）
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

        // 无 API：本地模拟成功
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

        // 目标地址（避免尾斜杠问题）
        const url = API_BASE.replace(/\/+$/, '') + '/api/du/update';

        // 组装 FormData（字段名需与后端一致）
        const fd = new FormData();
        fd.append('duId', 'DID' + state.didDigits);
        fd.append('status', state.duStatus ?? '');
        fd.append('remark', state.remark ?? '');

        if (state.photoFile instanceof File) {
          // 真文件就按文件传
          fd.append('photo', state.photoFile, state.photoFile.name || 'photo');
        } else if (typeof state.photoPreview === 'string' && state.photoPreview) {
          // 也可传字符串（如 dataURL/URL），看后端是否支持
          fd.append('photo', state.photoPreview);
        } else {
          fd.append('photo', '');
        }

        // 真·上传进度（用 XHR）
        await uploadWithProgress({
          url,
          formData: fd,
          onProgress: (pct) => {
            // 避免偶发 100% 后服务器还未返回的抖动：最多显示到 99%，成功后再置 100
            state.uploadPct = Math.min(99, pct);
          },
          timeoutMs: 15000,
        });

        // 成功：补齐到 100%
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

    return {
      t,
      setLang,
      state,
      video,
      didInput,
      // methods
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
    };
  }
});

// **只挂载一次**
app.mount("#app");
