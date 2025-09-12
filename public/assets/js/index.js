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
        // （示例）先处理图片上传（如果有），这里只做“假进度条”
        if (state.photoFile) {
          for (let p = 0; p <= 100; p += 10) {
            await new Promise(r => setTimeout(r, 60));
            state.uploadPct = p;
          }
        }

        // 业务提交
        const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
        const payload = {
          duId: 'DID' + state.didDigits,
          status: state.duStatus,
          remark: state.remark,
          photo: state.photoPreview || null,
        };

        // 如果没配置 API，就直接本地模拟成功
        if (!API_BASE) {
          await new Promise(r => setTimeout(r, 200));
          state.submitOk = true;
          state.submitMsg = t('submitOk') || 'Submitted';
        } else {
          const res = await fetch(`${API_BASE}/du/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          state.submitOk = true;
          state.submitMsg = t('submitOk') || 'Submitted';
        }

        state.submitView = {
          duId: payload.duId,
          status: payload.status,
          remark: payload.remark,
          photo: payload.photo,
        };
        state.showResult = true;
        state.last = true;
      } catch (e) {
        state.submitOk = false;
        state.submitMsg = (t('submitFailed') || 'Submit failed') + ': ' + (e && e.message ? e.message : 'Error');
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
