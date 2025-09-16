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
            lon: position.coords.longitude,
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

async function enumerateCameras() {
  const all = await navigator.mediaDevices.enumerateDevices();
  console.log(all);
  devices = all.filter((d) => d.kind === "videoinput");
  if (devices.length === 0) throw new Error("No camera found");
  const backIndex = devices.findIndex((d) =>
    /back|rear|environment/i.test(d.label)
  );
  deviceIndex = backIndex >= 0 ? backIndex : 0;
  currentDeviceId = devices[deviceIndex].deviceId;
}

async function startReader() {
  const Quagga = window.Quagga;
  if (!Quagga) throw new Error("Quagga is not loaded");
  // 初始化 Quagga
  Quagga.init(
    {
      inputStream: {
        type: "LiveStream",
        constraints: {
          width: { min: 1920 },
          height: { min: 1080 },
          facingMode: "environment", // 后置相机
          aspectRatio: { min: 1, max: 2 },
        },
      },
      locator: {
        patchSize: "medium", // 默认使用 medium
        halfSample: true,
      },
      numOfWorkers: 2, // 默认使用 2 个 workers
      frequency: 10,
      decoder: { readers: [] },
      locate: true,
    },
    (err) => {
      if (err) {
        console.log(err);
        return;
      }

      // 启动 Quagga 扫描
      Quagga.start();
      state.running = true;

      // 扫描结果回调
      Quagga.onDetected((result) => {
        const code = result.codeResult?.code;
        // 检查条形码是否符合条件
        var prefixes = ["DID", "KID", "SDNID", "MIND", "CID", "RFID", "STRID"];
        var isValid = false;

        // 条形码长度检查，必须在14到18位之间
        if (code.length >= 14 && code.length <= 18) {
          // 检查条形码是否以指定前缀之一开头
          prefixes.forEach(function (prefix) {
            if (code.startsWith(prefix)) {
              isValid = true;
            }
          });
        }
        if (isValid) {
          state.DNID = result_text;
          state.isValid = validateDN(result_text);
          if (state.isValid) {
            state.hasDN = true;
            stopReader();
            hideKeyboard(dnInput);
          }
        }
      });
    }
  );

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
      if (!devices.length) await enumerateCameras();

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
        // 获取经纬度并将其添加到备注中
        const locationRemark = `Latitude: ${state.location?.lat}, Longitude: ${state.location?.lon}`;
        state.remark += ` ${locationRemark}`;

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
          lon: location?.lon ?? null,
        };
      } catch (e) {
        console.error("Failed to get location:", e);
        state.location = { lat: null, lon: null }; // 如果获取失败，存储空值
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
