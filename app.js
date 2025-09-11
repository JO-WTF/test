// app.js — 智能镜头切换 + iOS 变焦兜底 + 满13位收键盘停摄像头（稳定版）
import { translations, tFactory } from './i18n.js';

const { createApp, ref, reactive, onMounted, onBeforeUnmount, nextTick } = window.Vue;

// ====== ZXing Reader 工厂 ======
function createReader(){
  try{
    const hints = new Map();
    const F = ZXingBrowser.BarcodeFormat;
    const H = ZXingBrowser.DecodeHintType;
    hints.set(H.POSSIBLE_FORMATS, [F.QR_CODE, F.CODE_128, F.CODE_39, F.EAN_13, F.EAN_8]);
    return new ZXingBrowser.BrowserMultiFormatReader(hints, 250);
  }catch{
    return new ZXingBrowser.BrowserMultiFormatReader();
  }
}

// ====== 智能摄像头管理器 ======
class SmartCamManager {
  constructor(storageKey = 'bestCamId.v1') {
    this.storageKey = storageKey;
    this.devices = [];
    this.index = 0;
    this.bestId = localStorage.getItem(this.storageKey) || '';
  }
  async refreshDevices() {
    const all = await navigator.mediaDevices.enumerateDevices();
    this.devices = all.filter(d => d.kind === 'videoinput');

    // 基于 label 的简易打分：优先后置/主摄；排除深感/红外
    const scoreOf = (d) => {
      const L = (d.label || '').toLowerCase();
      let s = 0;
      if (/back|rear|environment/.test(L)) s += 8;
      if (/wide|standard|main|video|1x/.test(L)) s += 4;
      if (/tele|2x|3x/.test(L)) s += 2;
      if (/ultra.*wide|0\.5x/.test(L)) s -= 2;
      if (/macro/.test(L)) s += 1;
      if (/depth|true.*depth|infrared|tof/.test(L)) s -= 10;
      return s;
    };

    const byId = new Map(this.devices.map(d => [d.deviceId, d]));
    const best = this.bestId && byId.get(this.bestId);
    const rest = this.devices.filter(d => d !== best).sort((a,b) => scoreOf(b) - scoreOf(a));
    this.devices = best ? [best, ...rest] : rest;
    this.index = 0;
  }
  current() { return this.devices[this.index] || null; }
  next() {
    if (!this.devices.length) return null;
    this.index = (this.index + 1) % this.devices.length;
    return this.current();
  }
  rememberBest(deviceId) {
    if (!deviceId) return;
    this.bestId = deviceId;
    localStorage.setItem(this.storageKey, deviceId);
    const i = this.devices.findIndex(d => d.deviceId === deviceId);
    if (i > 0) {
      const [d] = this.devices.splice(i,1);
      this.devices.unshift(d);
      this.index = 0;
    }
  }
  hasMultiple() { return this.devices.length > 1; }
}

createApp({
  setup(){
    const video = ref(null);
    const didInput = ref(null); // 可选：HTML 若未加 ref，将 fallback 到 id 查询
    const reader = createReader();
    const camMgr = new SmartCamManager();

    const API_URL = (window.API_URL || 'https://jakartabackend.onrender.com/api/du/update');
    const DIGIT_DU_RE = /^DID\d{13}$/; // DID + 13位数字

    const state = reactive({
      lang: 'id',
      running:false, locked:false,
      torchSupported:false, torchOn:false,
      duStatus:"", remark:"",
      photoFile:null, photoPreview:"",
      submitting:false, submitOk:false, submitMsg:"",
      uploadPct:0, needsStatusHint:false, needsStatusShake:false,
      showResult:false,
      submitView:{ duId:'', status:'', remark:'', photo:'' },
      didDigits: "",   // 仅 13 位数字
      hasDid: false,   // 是否已有可用 DID（扫码或手输）
      isValid: false,  // 是否满足 DID + 13 位
      last: null       // 原始识别内容（调试/记录）
    });

    // i18n
    const t = tFactory(state);
    const setLang = (l)=>{
      state.lang = l; document.documentElement.lang = l;
      const titleMap = { zh:'手机扫码 - 状态更新', en:'Scanner - Status Update', id:'Pemindaian - Pembaruan Status' };
      document.title = titleMap[l] || 'DU Status Update';
    };
    const statusLabel = (val)=>{
      if(val === '运输中') return t('inTransit');
      if(val === '已到达') return t('arrived');
      if(val === '过夜') return t('overnight');
      return val;
    };
    const currentDuId = () => (state.didDigits ? ('DID' + state.didDigits) : '');

    // ====== 输入/键盘工具 ======
    const getDidInputEl = () => didInput.value || document.getElementById('didInput');
    const blurKeyboard = () => {
      const el = getDidInputEl();
      const tryBlur = () => {
        if (el && document.activeElement === el) el.blur();
        else document.activeElement && document.activeElement.blur?.();
      };
      tryBlur(); requestAnimationFrame(tryBlur); setTimeout(tryBlur, 0);
    };

    // 手动输入：满 13 位自动收键盘 + 停摄像头 + 清理状态
    const onDidInput = () => {
      const digits = (state.didDigits || '').replace(/\D+/g, '').slice(0, 13);
      state.didDigits = digits;
      state.hasDid = digits.length === 13;
      state.isValid = state.hasDid;
      if (state.hasDid) {
        blurKeyboard();
        stopIfRunning();

        state.duStatus = "";
        state.remark = "";
        state.submitMsg = "";
        state.submitOk = false;
        state.needsStatusHint = false;
        state.needsStatusShake = false;
        state.showResult = false;
      }
    };

    // ====== 摄像头/扫描控制 ======
    let controls = null;
    let inactivityTimer = null;
    let noHitTimer = null;
    let zoomStage = 0; // iOS 单摄兜底使用

    const clearInactivity=()=>{ if(inactivityTimer){ clearTimeout(inactivityTimer); inactivityTimer=null; } };
    const startInactivityCountdown=()=>{ clearInactivity(); inactivityTimer=setTimeout(()=>{ stop(); }, 2*60*1000); };
    const clearNoHitTimer = ()=>{ if(noHitTimer){ clearTimeout(noHitTimer); noHitTimer=null; } };

    async function detectTorchSupport(){
      try{
        const track = video.value?.srcObject?.getVideoTracks?.()[0];
        const caps = track?.getCapabilities?.();
        state.torchSupported = !!(caps && 'torch' in caps);
      }catch{ state.torchSupported=false; }
    }
    async function applyTorch(on){
      try{
        const track = video.value?.srcObject?.getVideoTracks?.()[0];
        if(!track) return;
        await track.applyConstraints({ advanced:[{ torch: !!on }] });
        state.torchOn = !!on;
      }catch{ state.torchOn=false; }
    }
    async function enhanceTrack(){
      try{
        const track = video.value?.srcObject?.getVideoTracks?.()[0];
        if(!track) return;
        try{ const ic = new ImageCapture(track); await ic.setOptions?.({ focusMode: 'continuous' }); }catch{}
        try{
          const caps = track.getCapabilities?.();
          if(caps?.zoom){
            const z = caps.zoom;
            const min = z.min ?? 1, max = z.max ?? 1;
            const target = Math.min(max, Math.max(min, (z.min ?? 1) * 1.4));
            await track.applyConstraints({ advanced: [{ zoom: target }] });
          }
        }catch{}
      }catch{}
    }
    async function buildConstraintsFor(device){
      if (device && device.deviceId) {
        return { audio:false, video:{ deviceId: { exact: device.deviceId }, width:{ ideal:1280 }, height:{ ideal:720 } } };
      }
      return { audio:false, video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } } };
    }
    const hardStopStream = ()=>{
      const s = video.value?.srcObject;
      if (s && s.getTracks) s.getTracks().forEach(t=>{ try{ t.stop(); }catch{} });
      if (video.value) video.value.srcObject = null;
      state.torchOn = false; state.torchSupported = false;
    };

    const stopIfRunning = async () => { if (state.running) await stop(); };

    // iOS 单摄兜底：按 1x → 2x → 0.5x 循环跳变焦，模拟换镜头
    async function hopZoomTrack(){
      const track = video.value?.srcObject?.getVideoTracks?.[0];
      const caps = track?.getCapabilities?.();
      if (!caps?.zoom) return false;

      const min = caps.zoom.min ?? 1;
      const max = caps.zoom.max ?? 1;
      const oneX  = Math.min(max, Math.max(min, 1));
      const twoX  = Math.min(max, Math.max(min, oneX * 2));
      const halfX = Math.min(max, Math.max(min, oneX * 0.5));
      const targets = [oneX, twoX, halfX];

      const target = targets[zoomStage % targets.length];
      zoomStage++;

      try{
        await track.applyConstraints({ advanced:[{ zoom: target }] });
        console.info('[scan] hop zoom ->', target);
        return true;
      }catch(e){
        console.warn('[scan] hop zoom failed', e);
        return false;
      }
    }

    // 启动指定镜头并开始识别（start / nextCamera 复用）
    async function tryDevice(device){
      console.info('[scan] try device ->', device?.label || device?.deviceId || '(unknown)');

      // 停旧流
      try{ controls?.stop(); }catch{}
      try{ reader.reset(); }catch{}
      hardStopStream();

      const constraints = await buildConstraintsFor(device);
      controls = await reader.decodeFromConstraints(
        constraints,
        video.value,
        async (result, err, _controls) => {
          if (result && !state.locked) {
            state.locked = true;
            const text = result.getText();
            const format = result.getBarcodeFormat();

            // 识别 DID
            if (DIGIT_DU_RE.test(text)) {
              const digits = text.slice(3);
              state.didDigits = digits.replace(/\D+/g, '').slice(0, 13);
              state.hasDid = state.didDigits.length === 13;
              state.isValid = state.hasDid;
            } else {
              const m = (text.match(/(\d{13})/) || [])[1] || "";
              state.didDigits = m;
              state.hasDid = !!m;
              state.isValid = !!m;
            }

            if (state.hasDid) blurKeyboard(); // 扫码成功也顺手收键盘

            // 清理状态
            state.duStatus = "";
            state.remark = "";
            clearPhoto();
            state.submitMsg = "";
            state.submitOk = false;
            state.needsStatusHint = false;
            state.needsStatusShake = false;
            state.showResult = false;
            state.last = { text, format };

            // 记忆当前镜头
            try{
              const tr = video.value?.srcObject?.getVideoTracks?.()[0];
              const devId = tr?.getSettings?.().deviceId;
              if (devId) camMgr.rememberBest(devId);
            }catch{}

            // 停止当前识别流
            try{ _controls.stop(); }catch{}
            try{ reader.reset(); }catch{}
            await applyTorch(false);
            await detectTorchSupport();
            state.running = false;           // 仅在成功识别时置 false
            clearInactivity();
            clearNoHitTimer();
            try{ navigator.vibrate?.(30); }catch{}
          }
        }
      );

      await enhanceTrack();
      await detectTorchSupport();
      startInactivityCountdown();
    }

    function armNoHitTimer(){
      clearNoHitTimer();
      noHitTimer = setTimeout(async ()=>{
        if (state.locked) return;

        if (camMgr.hasMultiple()) {
          console.info('[scan] no hit in 4s, switch to next *device*');
          const nextDev = camMgr.next();
          state.locked = false;
          await tryDevice(nextDev);
        } else {
          // iOS 单摄兜底：变焦分档模拟换镜头
          const hopped = await hopZoomTrack();
          if (!hopped) {
            console.info('[scan] no hit in 4s, but no multi-cam/zoom; stay');
          }
          // 变焦无需重启流，继续等待下一次 4s
        }
        armNoHitTimer();
      }, 4000); // 可调 3000~6000
    }

    // ====== 开始/停止/重扫 ======
    const start = async ()=>{
      if (state.running) return;
      state.running = true;
      state.locked = false;
      clearInactivity();
      clearNoHitTimer();
      zoomStage = 0; // 重置 zoom 兜底序列
      try{
        await camMgr.refreshDevices();
        await tryDevice(camMgr.current());
        armNoHitTimer();
      }catch(e){
        console.error(e);
        alert('Camera error: ' + (e?.name || '') + (e?.message ? (' - ' + e.message) : ''));
        state.running = false; clearNoHitTimer();
      }
    };

    const stop = async ()=>{
      try{ controls?.stop(); }catch{}
      try{ reader.reset(); }catch{}
      try{ await applyTorch(false); }catch{}
      hardStopStream();
      state.running=false; state.locked=false; clearInactivity(); clearNoHitTimer();
    };

    const resume = async ()=>{
      state.locked=false;
      state.didDigits=""; state.hasDid=false; state.isValid=false;
      state.duStatus=""; state.remark=""; clearPhoto();
      state.submitMsg=""; state.submitOk=false; state.showResult=false;
      state.needsStatusHint=false; state.needsStatusShake=false;

      await start();
    };

    // 选图/清图
    const onPickPhoto = (e)=>{
      const file = e.target.files?.[0];
      if(!file) return;
      state.photoFile = file;
      try{ state.photoPreview = URL.createObjectURL(file); }catch{ state.photoPreview = ''; }
    };
    const clearPhoto = ()=>{
      try{ state.photoPreview && URL.revokeObjectURL(state.photoPreview); }catch{}
      state.photoPreview = ''; state.photoFile = null;
    };

    // 手动切换镜头（用统一 tryDevice；切完继续计时）
    const nextCamera = async ()=>{
      if (!state.running) { await start(); return; }
      try{
        const dev = camMgr.next();
        if (!dev) return;
        state.locked = false;
        clearNoHitTimer();
        await tryDevice(dev);
        armNoHitTimer();
      }catch(err){ console.error(err); }
    };

    // 提交
    const submitUpdate = async ()=>{
      if(!state.isValid){
        state.submitOk=false; state.submitMsg=t('invalidId'); return;
      }
      if(!state.duStatus){
        state.submitOk=false; state.submitMsg=t('needSelectStatus');
        state.needsStatusHint = true; state.needsStatusShake = true;
        requestAnimationFrame(()=>{
          const sel = document.getElementById('duStatus'); if(sel){ sel.focus(); }
          setTimeout(()=>{ state.needsStatusShake=false; }, 400);
        });
        return;
      }

      state.submitting = true; state.submitMsg = ''; state.submitOk = false; state.uploadPct = 0;

      try{
        const isPlaceholder = !API_URL || /<你的-render-域名>/.test(API_URL);
        if(isPlaceholder){ throw new Error(t('apiUrlMissing')); }

        const fd = new FormData();
        fd.append('duId', currentDuId());
        fd.append('status', state.duStatus); // 保持中文值
        fd.append('remark', state.remark || '');
        if(state.photoFile) fd.append('photo', state.photoFile);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', API_URL, true);
        xhr.upload.onprogress = (e)=>{ if(e && e.lengthComputable){ state.uploadPct = Math.min(100, Math.round(e.loaded / e.total * 100)); } };
        xhr.onerror = ()=>{ state.submitOk = false; state.submitMsg = t('submitNetworkErr'); state.submitting = false; };
        xhr.onabort = ()=>{ state.submitOk = false; state.submitMsg = t('submitCanceled'); state.submitting = false; };

        xhr.onreadystatechange = ()=>{
          if(xhr.readyState !== 4) return;
          const status = xhr.status; const text = xhr.responseText || '';
          let data = null; try{ data = text ? JSON.parse(text) : null }catch{}
          if(status >= 200 && status < 300){
            const ok = (data && (data.ok===true || data.success===true)) || true;
            state.submitOk = !!ok;
            state.submitMsg = ok ? (data?.message || t('submitSuccess')) : (data?.message || (t('submitHttpErrPrefix') + 'unknown'));
            state.uploadPct = 100;
            if(ok){
              state.showResult = true;
              state.submitView = {
                duId: currentDuId(),
                status: state.duStatus,
                remark: state.remark,
                photo: state.photoPreview || ''
              };
              window.scrollTo({
                top: document.body.scrollHeight,
                behavior: "smooth"
              });
            }
          }else{
            const msg = (data && (data.detail || data.message)) || ('HTTP ' + status);
            state.submitOk = false; state.submitMsg = t('submitHttpErrPrefix') + msg;
          }
          state.submitting = false;
        };
        xhr.send(fd);
      }catch(err){
        console.error(err);
        state.submitOk = false; state.submitMsg = t('submitHttpErrPrefix') + (err?.message || err);
        state.submitting = false;
      }
    };

    onMounted(async ()=>{
      setLang('id'); // 默认印尼语
      video.value?.setAttribute('playsinline','true');
      video.value?.setAttribute('muted','muted');
      document.addEventListener('visibilitychange', ()=>{ if (document.hidden) stop() });
      window.addEventListener('pagehide', stop);
      await start();
    });
    onBeforeUnmount(()=>{ stop() });

    return {
      state, video, didInput, t, setLang, statusLabel,
      start, stop, resume,
      toggleTorch: async ()=>{ if(state.torchSupported) await applyTorch(!state.torchOn) },
      nextCamera,
      submitUpdate, onPickPhoto, clearPhoto, onDidInput
    };
  }
}).mount('#app');
