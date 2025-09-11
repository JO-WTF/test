// app.js — 智能镜头切换版（清理与修复版）
import { translations, tFactory } from './i18n.js';

const { createApp, ref, reactive, onMounted, onBeforeUnmount } = window.Vue;

// ====== ZXing Reader 工厂（与你现有保持一致）======
function createReader(){
  try{
    const hints = new Map();
    const F = ZXingBrowser.BarcodeFormat;
    const H = ZXingBrowser.DecodeHintType;
    hints.set(H.POSSIBLE_FORMATS, [F.QR_CODE, F.CODE_128, F.CODE_39, F.EAN_13, F.EAN_8]);
    return new ZXingBrowser.BrowserMultiFormatReader(hints, 250);
  }catch{ return new ZXingBrowser.BrowserMultiFormatReader(); }
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
    const didInput = ref(null); // DID 输入框（可无 ref，会退化到按 id 获取）
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

    // 组合当前 duId
    const currentDuId = () => (state.didDigits ? ('DID' + state.didDigits) : '');

    // ——— 键盘/输入框工具 ———
    const getDidInputEl = () => didInput.value || document.getElementById('didInput');
    const blurKeyboard = () => {
      const el = getDidInputEl();
      const tryBlur = () => {
        if (el && document.activeElement === el) el.blur();
        else document.activeElement && document.activeElement.blur?.();
      };
      tryBlur(); requestAnimationFrame(tryBlur); setTimeout(tryBlur, 0);
    };

    // 手动输入：满 13 位自动收键盘 + 停摄像头
    const onDidInput = () => {
      const digits = (state.didDigits || '').replace(/\D+/g, '').slice(0, 13);
      state.didDigits = digits;
      state.hasDid = digits.length === 13;
      state.isValid = state.hasDid;
      if (state.hasDid) {
        blurKeyboard();
        stopIfRunning();

        // 对齐扫码成功后的清理逻辑
        state.duStatus = "";
        state.remark = "";
        state.submitMsg = "";
        state.submitOk = false;
        state.needsStatusHint = false;
        state.needsStatusShake = false;
        state.showResult = false;
      }
    };

    // ——— 摄像头/扫描 控制 ———
    let controls = null;
    let inactivityTimer = null;
    let noHitTimer = null;

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
            const target = Math.min(max, Math.max(min, min * 1.4));
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

    // 若正在扫描则停止摄像头（供手输满 13 位时调用）
    const stopIfRunning = async () => { if (state.running) await stop(); };

    // 启动指定镜头并开始识别（start 与 nextCamera 复用）
    async function tryDevice(device){
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
              const track = video.value?.srcObject?.getVideoTracks?.()[0];
              const devId = track?.getSettings?.().deviceId;
              if (devId) camMgr.rememberBest(devId);
            }catch{}

            // 停止当前识别流
            try{ _controls.stop(); }catch{}
            try{ reader.reset(); }catch{}
            await applyTorch(false);
            await detectTorchSupport();
            state.running = false;
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
        if (!camMgr.hasMultiple()) return;
        const nextDev = camMgr.next();
        state.locked = false;
        await tryDevice(nextDev);
        armNoHitTimer();
      }, 4000); // 可调 3000~6000
    }

    // ====== 开始扫描（自适应切镜头）======
    const start = async ()=>{
      if (state.running) return;
      state.running = true;
      state.locked = false;
      clearInactivity();
      clearNoHitTimer();
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

    // 停止扫描
    const stop = async ()=>{
      try{ controls?.stop(); }catch{}
      try{ reader.reset(); }catch{}
      try{ await applyTorch(false); }catch{}
      hardStopStream();
      state.running=false; state.locked=false; clearInactivity(); clearNoHitTimer();
    };

    // 重新扫描（保留已输 DID；如需清空可手动置空）
    const resume = async ()=>{
      state.locked=false;
      state.hasDid = state.didDigits.length === 13;
      state.isValid = state.hasDid;
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

    // 手动切换镜头（使用统一 tryDevice 回调，切完继续计时器）
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
