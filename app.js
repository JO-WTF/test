// app.js — 智能镜头切换版
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
    const reader = createReader();
    const camMgr = new SmartCamManager();

    const API_URL = (window.API_URL || 'https://jakartabackend.onrender.com/api/du/update');
    // 新校验：DID + 13位数字
    const DIGIT_DU_RE = /^DID\d{13}$/;

    const state = reactive({
      lang: 'id',
      running:false, last:null, locked:false,
      torchSupported:false, torchOn:false,
      duStatus:"", remark:"",
      photoFile:null, photoPreview:"",
      submitting:false, submitOk:false, submitMsg:"",
      uploadPct:0, needsStatusHint:false, needsStatusShake:false,
      showResult:false,
      submitView:{ duId:'', status:'', remark:'', photo:'' },
      didDigits: "",       // 仅 13 位数字
      hasDid: false,       // 是否已具备一个可用 DID（扫码或手输）
      isValid: false,      // 仍保留：DID + 13 位数字是否满足 ^DID\d{13}$

    });

    // 组合 DID 的 getter（随用随取，不用写回）
    const currentDuId = () => (state.didDigits ? ('DID' + state.didDigits) : '');

    // 手输处理：只保留数字，最多 13 位；满 13 位即进入可选状态
    const onDidInput = () => {
    let digits = (state.didDigits || '').replace(/\D+/g, '').slice(0, 13);
    state.didDigits = digits;
    state.hasDid = digits.length === 13;
    state.isValid = digits.length === 13;  // 满 13 位即视为有效
    if (state.hasDid) {
        // 手输完成后，清理一些旧状态（与扫码成功时一致）
        state.duStatus = "";
        state.remark = "";
        state.submitMsg = "";
        state.submitOk = false;
        state.needsStatusHint = false;
        state.needsStatusShake = false;
        state.showResult = false;
    }
    };


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

    let controls = null; 
    let inactivityTimer = null;
    let noHitTimer = null; // 无命中超时定时器（用于自动切镜头）

    const clearInactivity=()=>{ if(inactivityTimer){ clearTimeout(inactivityTimer); inactivityTimer=null; } };
    const startInactivityCountdown=()=>{ clearInactivity(); inactivityTimer=setTimeout(()=>{ stop(); }, 2*60*1000); };

    const clearNoHitTimer = ()=>{ if(noHitTimer){ clearTimeout(noHitTimer); noHitTimer=null; } };

    async function detectTorchSupport(){
      try{
        const stream = video.value?.srcObject;
        const track = stream?.getVideoTracks?.()[0];
        const caps = track?.getCapabilities?.();
        state.torchSupported = !!(caps && 'torch' in caps);
      }catch{ state.torchSupported=false; }
    }
    async function applyTorch(on){
      try{
        const stream = video.value?.srcObject;
        const track = stream?.getVideoTracks?.()[0];
        if(!track) return;
        await track.applyConstraints({ advanced:[{ torch: !!on }] });
        state.torchOn = !!on;
      }catch{ state.torchOn=false; }
    }
    async function enhanceTrack(){
      try{
        const stream = video.value?.srcObject;
        const track = stream?.getVideoTracks?.()[0];
        if(!track) return;
        try{ const ic = new ImageCapture(track); await ic.setOptions?.({ focusMode: 'continuous' }); }catch{}
        try{ 
          const caps = track.getCapabilities?.(); 
          if(caps?.zoom){
            const z = caps.zoom;
            const min = z.min ?? 1, max = z.max ?? 1;
            const target = Math.min(max, Math.max(min, min * 1.4)); // 稍微更激进一点
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

    const stop = async ()=>{
      try{ controls?.stop(); }catch{}
      try{ reader.reset(); }catch{}
      try{ await applyTorch(false); }catch{}
      hardStopStream();
      state.running=false; state.locked=false; clearInactivity(); clearNoHitTimer();
    };

    const resume = async ()=>{
      state.last=null; state.locked=false; state.isValid=false;
      state.duStatus=""; state.remark=""; clearPhoto();
      state.submitMsg=""; state.submitOk=false; state.showResult=false;
      state.needsStatusHint=false; state.needsStatusShake=false;
      await start();
    };

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

    // ====== 智能开扫（支持无命中自动切镜头）======
    const start = async ()=>{
      if (state.running) return;
      state.running = true; state.locked = false; clearInactivity(); clearNoHitTimer();
      try{
        await camMgr.refreshDevices();

        const tryDevice = async (device)=>{
          // 先停掉旧的
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

                // 若匹配 DID + 13 位数字，则提取后 13 位写入输入框
                if (DIGIT_DU_RE.test(text)) {
                const digits = text.slice(3); // 去掉 "DID"
                state.didDigits = digits.replace(/\D+/g, '').slice(0, 13);
                state.hasDid = state.didDigits.length === 13;
                state.isValid = state.hasDid;
                } else {
                // 扫到非预期内容，仍可填入输入框（只提取其中的连续 13 位数字，若没有就当无效）
                const m = (text.match(/(\d{13})/) || [])[1] || "";
                state.didDigits = m;
                state.hasDid = !!m;
                state.isValid = !!m;
                }

                // 清理旧状态（与你已有一致）
                state.duStatus = ""; 
                state.remark = "";
                clearPhoto();
                state.submitMsg = ""; 
                state.submitOk = false;
                state.needsStatusHint = false; 
                state.needsStatusShake = false;
                state.showResult = false;

                // （可保留 last 作为“最近原始识别内容”的记录，但 UI 显示统一用 currentDuId）
                state.last = { text, format };

                // 记忆当前镜头
                try{
                  const track = video.value?.srcObject?.getVideoTracks?.()[0];
                  const devId = track?.getSettings?.().deviceId;
                  if (devId) camMgr.rememberBest(devId);
                }catch{}

                try{ _controls.stop(); }catch{}
                try{ reader.reset(); }catch{}
                await applyTorch(false);
                await detectTorchSupport();
                state.running = false; clearInactivity(); clearNoHitTimer();
                try{ navigator.vibrate?.(30); }catch{}
              }
            }
          );

          await enhanceTrack(); await detectTorchSupport(); startInactivityCountdown();
        };

        // 无命中 4s 自动切镜头（仅当存在多摄像头）
        const armNoHitTimer = ()=>{
          clearNoHitTimer();
          noHitTimer = setTimeout(async ()=>{
            if (state.locked) return;
            if (!camMgr.hasMultiple()) return;
            const nextDev = camMgr.next();
            await tryDevice(nextDev);
            armNoHitTimer(); // 继续下一轮
          }, 4000); // 可调范围 3000~6000
        };

        await tryDevice(camMgr.current());
        armNoHitTimer();

      }catch(e){
        console.error(e);
        alert('Camera error: ' + (e?.name || '') + (e?.message ? (' - ' + e.message) : ''));
        state.running = false; clearNoHitTimer();
      }
    };

    // 手动切换镜头（可选按钮会用到）
    const nextCamera = async ()=>{
      if (!state.running) {
        await start(); // 若未运行则直接启动
        return;
      }
      // 运行中：切到下一颗并重新布防
      try{
        const dev = camMgr.next();
        if (!dev) return;
        // 轻量重启当前扫描（复用 start 的内部方式）
        try{ controls?.stop(); }catch{}
        try{ reader.reset(); }catch{}
        hardStopStream();

        const constraints = await buildConstraintsFor(dev);
        controls = await reader.decodeFromConstraints(
          constraints,
          video.value,
          ()=>{}
        );
        await enhanceTrack(); await detectTorchSupport();
        clearNoHitTimer();
        // 切完后重新开启无命中倒计时
        noHitTimer = setTimeout(async ()=>{
          if (state.locked) return;
          if (!camMgr.hasMultiple()) return;
          const nextDev = camMgr.next();
          // 用 start 的 tryDevice 逻辑更稳，这里简单处理：
          try{ controls?.stop(); }catch{}
          try{ reader.reset(); }catch{}
          hardStopStream();
          const c2 = await buildConstraintsFor(nextDev);
          controls = await reader.decodeFromConstraints(c2, video.value, ()=>{});
          await enhanceTrack();
          await detectTorchSupport();
        }, 4000);
      }catch(err){ console.error(err); }
    };

    const submitUpdate = async ()=>{
      if(!state.isValid){
        state.submitOk=false; 
        state.submitMsg=t('invalidId');
        return;
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
      state, video, t, setLang, statusLabel, 
      start, stop, resume, 
      toggleTorch: async ()=>{ if(state.torchSupported) await applyTorch(!state.torchOn) }, 
      nextCamera, // 手动切换
      submitUpdate, onPickPhoto, clearPhoto, onDidInput
    };
  }
}).mount('#app');
