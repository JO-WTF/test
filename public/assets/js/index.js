import { createApp, reactive, ref, onMounted, computed } from 'https://unpkg.com/vue@3.2.45/dist/vue.esm-browser.js';

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
  location: "",
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

// --- 获取经纬度 ---
async function getLocation() {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject("Unable to retrieve location");
        }
      );
    } else {
      reject("Geolocation is not supported by this browser");
    }
  });
}

function validateDN(result_text) {
  return result_text;
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

    const dnInput = ref(null);

    const showScanControls = computed(() => !state.isValid);

    const torchTagVisible = computed(
      () => state.running && !state.isValid && state.torchSupported
    );

    const start = async () => {
      try {
        await startReader();
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

    async function nextCamera() {
      if (!devices.length) devices = await Quagga.CameraAccess.enumerateVideoDevices();

      deviceIndex = (deviceIndex + 1) % devices.length; // 切换到下一个摄像头
      currentDeviceId = devices[deviceIndex].deviceId;

      // 更新状态
      state.currentDeviceId = currentDeviceId;

      // 重新初始化摄像头
      if (state.running) {
        await stopReader();
        await startReader(); // 重新启动 Quagga
      }

      // 显示 Toast 通知
      const cameraLabel =
        devices[deviceIndex].label || `Camera ${deviceIndex + 1}`;
      Toastify({
        text: `${cameraLabel}`,
        duration: 1000, // 3秒钟后消失
        gravity: "bottom", // `top` or `bottom`
        position: "center", // Toast 显示的位置
        style: {
          background: "linear-gradient(to right, #00b09b, #96c93d)",
        },
      }).showToast();
    }

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
      try {
        await startReader();
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
            lng: state.location?.lng,
            lat: state.location?.lat,
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
        fd.append("lng", state.location?.lng ?? "");
        fd.append("lat", state.location?.lat ?? "");

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
          lng: state.location?.lng,
          lat: state.location?.lat,
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

    function onDNInput(e) {
      state.DNID = dnInput.value.value.toUpperCase(); // 转为大写
    }

    async function onOkClick(e) {
      state.DNID = dnInput.value.value.toUpperCase(); // 转为大写
      state.isValid = validateDN(state.DNID);
      if (state.isValid) {
        stopReader();
        hideKeyboard(dnInput);
        state.hasDN = true;
      }
      try {
        // 加载位置信息并保存到 state.location
        const location = await getLocation();
        state.location = {
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
        };
      } catch (e) {
        console.error("Failed to get location:", e);
        state.location = { lat: null, lng: null }; // 如果获取失败，存储空值
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

    // --- Quagga 初始化及处理 ---
    async function startReader() {
      devices = await Quagga.CameraAccess.enumerateVideoDevices();
      console.log(devices)

      if (devices.length === 0) return;

      const constraints = {
        inputStream: {
          type: "LiveStream",
          constraints: {
            width: { min: 1920 },
            height: { min: 1080 },
            facingMode: "environment",
            deviceId: devices[deviceIndex].deviceId,
          },
        },
        decoder: {
          readers: [
          ],
        },
      };

      // 初始化 Quagga
      Quagga.init(constraints, function (err) {
        if (err) {
          console.error(err);
          return;
        }
        Quagga.start();
        state.running = true;
        console.log("running")
      });

      // 处理扫描结果
      Quagga.onDetected(handleDetected);
      Quagga.onProcessed(handleProcessed);
    }

    async function stopReader() {
      Quagga.stop();
      state.running = false;
    }

    function handleProcessed(result) {
      if (result) {
        const drawingCtx = Quagga.canvas.ctx.overlay;
        console.log(drawingCtx)
        const drawingCanvas = Quagga.canvas.dom.overlay;

        // 清空画布并重新绘制框架
        if (result.boxes) {
          drawingCtx.clearRect(
            0,
            0,
            parseInt(drawingCanvas.getAttribute("width")),
            parseInt(drawingCanvas.getAttribute("height"))
          );
          result.boxes
            .filter(function (box) {
              return box !== result.box; // 排除当前框
            })
            .forEach(function (box) {
              Quagga.ImageDebug.drawPath(
                box,
                { x: 0, y: 1 },
                drawingCtx,
                { color: "green", lineWidth: 2 }
              );
            });
        }

        // 绘制当前框
        if (result.box) {
          Quagga.ImageDebug.drawPath(
            result.box,
            { x: 0, y: 1 },
            drawingCtx,
            { color: "#00F", lineWidth: 2 }
          );
        }

        // 如果识别到了条形码，绘制扫描线
        if (result.codeResult && result.codeResult.code) {
          Quagga.ImageDebug.drawPath(
            result.line,
            { x: "x", y: "y" },
            drawingCtx,
            { color: "red", lineWidth: 3 }
          );
        }
      }
    }

    function handleDetected(result) {
      const code = result.codeResult.code;
      console.log(code);
      if (state.lastResult !== code) {
        state.lastResult = code;
        state.barcodeResult = code;
        console.log("Barcode detected: ", code);
      }
    }

    return {
      t,
      setLang,
      state,
      dnInput,
      onDNInput,
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
