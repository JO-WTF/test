const { createApp, reactive, ref, onMounted, computed } = window.Vue;

// --- i18n 初始化（扁平 JSON + 显式 ns）---
const i18n = I18NCore.createI18n({
  namespaces: ["index"],
  lang: I18NCore.detectLang("id"),
  fallbackLang: "id",
});
await i18n.init();

// --- 全局状态 ---
const state = reactive({
  ...i18n.state,
  hasDN: false,
  DNID: "",
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

// --- Quagga & 媒体相关 ---
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
  if (!("torch" in caps)) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: !!on }] });
    state.torchOn = !!on;
    return true;
  } catch {
    return false;
  }
}

function validateDN(result_text) {
  return result_text;
}

async function enumerateCameras() {
  const all = await navigator.mediaDevices.enumerateDevices();
  devices = all.filter((d) => d.kind === "videoinput");
  if (devices.length === 0) throw new Error("No camera found");
  const backIndex = devices.findIndex((d) =>
    /back|rear|environment/i.test(d.label)
  );
  deviceIndex = backIndex >= 0 ? backIndex : 0;
  currentDeviceId = devices[deviceIndex].deviceId;
}

async function startReader(videoEl) {
  const Quagga = window.Quagga;
  if (!Quagga) throw new Error("Quagga is not loaded");

  // 初始化 Quagga
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: videoEl,
      constraints: {
        aspectRatio: { min: 1, max: 2 },
        width: { min: 1280, ideal: 1920, max: 1920 },
        height: { min: 720, ideal: 1080, max: 1080 },
        facingMode: "environment", // 后置相机
      },
    },
    decoder: {},
    locator: {
      patchSize: "medium", // 默认使用 medium
      halfSample: true
    },
    locate: true,
  }, (err) => {
    if (err) {
      console.log(err);
      return;
    }

    // 启动 Quagga 扫描
    Quagga.start();
    state.running = true;
    currentStream = videoEl.srcObject;

    // 扫描结果回调
    Quagga.onDetected((result) => {
      const result_text = result.codeResult?.code;
      if (result_text) {
        state.DNID = result_text;
        state.isValid = validateDN(result_text);
        if (state.isValid) {
          state.hasDN = true;
          stopReader();
          hideKeyboard(dnInput);
        }
      }
    });
  });

  // 检查摄像头支持情况
  try {
    const track = currentStream?.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.();
    state.torchSupported = !!(caps && "torch" in caps);
  } catch {
    state.torchSupported = false;
  }
}

async function stopReader() {
  try {
    const Quagga = window.Quagga;
    if (Quagga) {
      Quagga.stop(); // 停止 Quagga
    }
  } catch (e) {
    console.error("Error stopping Quagga", e);
  }

  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
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
        state.submitMsg = (e && e.message) || "Camera start failed";
      }
    });

    const video = ref(null);
    const dnInput = ref(null);

    const showScanControls = computed(() => !state.isValid);

    const torchTagVisible = computed(
      () => state.running && !state.isValid && state.torchSupported
    );

    const start = async () => {
      console.log(video.value);
      if (!video.value) return;
      try {
        await startReader(video.value);
      } catch (e) {
        state.submitOk = false;
        state.submitMsg = (e && e.message) || "Camera start failed";
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
      state.submitMsg = "";
      state.submitOk = false;
      state.duStatus = "";
      state.remark = "";
      state.photoFile = null;
      state.photoPreview = null;
      state.needsStatusHint = false;
      state.needsStatusShake = false;
      state.hasDN = false;
      state.isValid = false;
      state.DNID = "";
      console.log(video.value);
      try {
        await startReader(video.value);
      } catch (e) {
        console.log(e);
      }
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

    function uploadWithProgress({
      url,
      formData,
      onProgress,
      timeoutMs = 15000,
    }) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && typeof onProgress === "function") {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            onProgress(pct);
          }
        };

        xhr.timeout = timeoutMs;
        xhr.ontimeout = () => reject(new Error("Request timeout"));

        xhr.onload = () => {
          const ok = xhr.status >= 200 && xhr.status < 300;
          if (!ok)
            return reject(
              new Error(`HTTP ${xhr.status} - ${xhr.responseText || ""}`)
            );
          resolve(xhr.responseText);
        };

        xhr.onerror = () => reject(new Error("Network error"));

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
      state.submitMsg = "";
      state.submitOk = false;

      try {
        const API_BASE =
          (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "";

        if (!API_BASE) {
          await new Promise((r) => setTimeout(r, 300));
          state.uploadPct = 100;
          state.submitOk = true;
          state.submitMsg = t("submitOk") || "Submitted";

          state.submitView = {
            duId: state.DNID,
            status: state.duStatus,
            remark: state.remark,
            photo: state.photoPreview || null,
          };
          state.showResult = true;
          state.last = true;
          return;
        }

        const url = API_BASE.replace(/\/+$/, "") + "/api/du/update";

        const fd = new FormData();
        fd.append("duId", state.DNID);
        fd.append("status", state.duStatus ?? "");
        fd.append("remark", state.remark ?? "");

        if (state.photoFile instanceof File) {
          fd.append("photo", state.photoFile, state.photoFile.name || "photo");
        } else if (
          typeof state.photoPreview === "string" &&
          state.photoPreview
        ) {
          fd.append("photo", state.photoPreview);
        } else {
          fd.append("photo", "");
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
        state.submitMsg = t("submitOk") || "Submitted";

        state.submitView = {
          duId: state.DNID,
          status: state.duStatus,
          remark: state.remark,
          photo: state.photoPreview || null,
        };
        state.showResult = true;
        state.last = true;
      } catch (e) {
        state.submitOk = false;
        state.submitMsg =
          (t("submitFailed") || "Submit failed") +
          ": " +
          (e && e.message ? e.message : "Error");
        console.error("submit error", e);
      } finally {
        state.submitting = false;
      }
    };

    function onOkClick(e) {
      state.DNID = dnInput.value.value;
      state.isValid = validateDN(state.DNID);
      if (state.isValid) {
        stopReader();
        hideKeyboard(dnInput);
        state.hasDN = true;
      }
    }

    function hideKeyboard(inputEl) {
      try {
        const el = inputEl?.value || inputEl;
        if (el && typeof el.blur === "function") {
          const wasReadonly = el.readOnly;
          el.readOnly = true;
          el.blur();
          el.readOnly = wasReadonly;
        }
        if (
          document.activeElement &&
          typeof document.activeElement.blur === "function"
        ) {
          document.activeElement.blur();
        }
        setTimeout(() => {
          if (
            document.activeElement &&
            typeof document.activeElement.blur === "function"
          ) {
            document.activeElement.blur();
          }
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, 50);
      } catch {}
    }

    return {
      t,
      setLang,
      state,
      video,
      dnInput,
      onOkClick,
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
    };
  },
});

app.mount("#app");
