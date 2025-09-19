import {
  createApp,
  reactive,
  ref,
  onMounted,
  computed,
} from "https://unpkg.com/vue@3.2.45/dist/vue.esm-browser.js";

Dynamsoft.DBR.BarcodeScanner.license =
  "DLS2eyJoYW5kc2hha2VDb2RlIjoiMTA0NTQzNDEwLU1UQTBOVFF6TkRFd0xYZGxZaTFVY21saGJGQnliMm8iLCJtYWluU2VydmVyVVJMIjoiaHR0cHM6Ly9tZGxzLmR5bmFtc29mdG9ubGluZS5jb20iLCJvcmdhbml6YXRpb25JRCI6IjEwNDU0MzQxMCIsInN0YW5kYnlTZXJ2ZXJVUkwiOiJodHRwczovL3NkbHMuZHluYW1zb2Z0b25saW5lLmNvbSIsImNoZWNrQ29kZSI6MTg2NjI4MDUzMX0=";

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
  location: null, // ✅ 保持对象/空一致
  hasDN: false,
  DNID: "",
  duStatus: "",
  remark: "",
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
  submitMsg: "",
  showResult: false,
  submitView: {},
  uploadPct: 0,
});

// --- 获取经纬度（更友好错误信息）---
async function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(`Location error (${err.code}): ${err.message || "Unknown"}`)
    );
  });
}

// --- DN 校验：单条正则内合并长度要求 ---
function validateDN(text) {
  // 总长 14–18；前缀 1–5 位字母；后续为字母数字
  return /^(?=.{14,18}$)[A-Za-z]{1,5}[0-9A-Za-z]+$/.test(text);
}

// --- Vue App ---
const app = createApp({
  setup() {
    const t = (key, vars) => i18n.t(key, { ...(vars || {}), ns: "index" });
    const setLang = async (lang) => {
      await i18n.setLang(lang);
      state.lang = lang;
    };

    let scanner;
    let $errorIcon = null; // ✅ 缓存错误图标，避免反复查询

    onMounted(async () => {
      // 缓存错误图标节点
      $errorIcon = document.getElementById("error-icon");

      try {
        scanner = await Dynamsoft.DBR.BarcodeScanner.createInstance();
        await scanner.setUIElement(document.getElementById("div-ui-container"));
        scanner.setVideoFit("cover");
        scanner.barcodeFillStyle = "rgba(73, 245, 73, 0)";
        scanner.barcodeLineWidth = 5;
        scanner.barcodeStrokeStyle = "rgba(73, 245, 73, 1)";
        scanner.onUniqueRead = (txt, result) => {
          onCodeScaned(txt);
        };
        await start();
      } catch (e) {
        state.submitOk = false;
        state.submitMsg = (e && e.message) || "Camera start failed";
      }
    });

    const start = async () => {
      try {
        await scanner.show();
        state.running = true;
      } catch (e) {
        state.submitOk = false;
        state.submitMsg = (e && e.message) || "Camera start failed";
      }
      console.log("running:", state.running);
    };

    const stop = async () => {
      try {
        await scanner.stop();
        console.log("Scanner stopped");
        state.running = false;
      } catch (e) {
        state.submitOk = false;
        state.submitMsg = (e && e.message) || "Camera stop failed";
      }
      console.log("running:", state.running);
    };

    const dnInput = ref(null);

    const showScanControls = computed(() => !state.isValid);
    const torchTagVisible = computed(() => state.running && !state.isValid);

    const toggleTorch = async () => {
      await setTorch(!state.torchOn);
    };

    // ✅ 修正 torch 开关逻辑
    const setTorch = async (on) => {
      try {
        if (on) {
          await scanner.turnOnTorch();
        } else {
          await scanner.turnOffTorch();
        }
        state.torchOn = on;
      } catch (e) {
        Toastify({
          text: `${t("torchFailed")}`,
          duration: 1000,
          gravity: "bottom",
          position: "center",
          style: { background: "linear-gradient(to right, #ff3333,  #ff3333)" },
        }).showToast();
      }
    };

    // ✅ 相机切换更健壮
    async function nextCamera() {
      const cameras = await scanner.getAllCameras();
      if (!Array.isArray(cameras) || cameras.length === 0) return;
      if (cameras.length === 1) {
        Toastify({
          text: t("onlyOneCamera") || "Only one camera",
          duration: 1000,
          gravity: "bottom",
          position: "center",
        }).showToast();
        return;
      }
      const current = await scanner.getCurrentCamera();
      const idx = Math.max(
        0,
        cameras.findIndex((c) => c.deviceId === current?.deviceId)
      );
      const next = cameras[(idx + 1) % cameras.length];
      await scanner.setCurrentCamera(next);
      Toastify({
        text: `${next?.label || "Camera"}`,
        duration: 1000,
        gravity: "bottom",
        position: "center",
        style: { background: "linear-gradient(to right, #00b09b, #96c93d)" },
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
      if (state.photoPreview) URL.revokeObjectURL(state.photoPreview);
      state.photoPreview = null;
      state.needsStatusHint = false;
      state.needsStatusShake = false;
      state.hasDN = false;
      state.isValid = false;
      state.DNID = "";
      try {
        await start();
      } catch (e) {
        console.log(e);
      }
    };

    // ✅ 选择图片时释放旧 URL
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
          if (typeof onProgress === "function") {
            const pct =
              evt && evt.lengthComputable && evt.total > 0
                ? Math.round((evt.loaded / evt.total) * 100)
                : 0;
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

    async function onCodeScaned(code_result) {
      state.isValid = validateDN(code_result);
      if (state.isValid) {
        stop();
        hideKeyboard(dnInput);
        state.DNID = code_result.toUpperCase();
        hideErrorIcon();
      } else {
        showErrorIcon();
      }
    }

    // ✅ 实时输入：更新 isValid，并在有效时隐藏错误图标
    function onDNInput(e) {
      state.DNID = dnInput.value.value.toUpperCase();
      state.isValid = validateDN(state.DNID);
    }

    async function onOkClick(e) {
      // 将输入转为大写并校验
      state.DNID = dnInput.value.value.toUpperCase();
      state.isValid = validateDN(state.DNID);

      // 通过类名选中输入区域容器（用于存在性检查）
      const dnInputElement = document.querySelector(".did-input");
      if (!dnInputElement) {
        console.error("did-input element not found!");
        return;
      }

      if (state.isValid) {
        // 验证通过：停扫描、收键盘、标记、隐藏错误图标
        stop();
        hideKeyboard(dnInput);
        state.hasDN = true;
        hideErrorIcon();
      } else {
        showErrorIcon();
      }

      try {
        const location = await getLocation();
        state.location = {
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
        };
      } catch (e) {
        console.error("Failed to get location:", e);
        state.location = { lat: null, lng: null };
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
