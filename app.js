// app.js
import { translations, tFactory } from './i18n.js';

const { createApp, ref, reactive, onMounted, onBeforeUnmount } = window.Vue;

function createReader(){
  try{
    const hints = new Map();
    const F = ZXingBrowser.BarcodeFormat;
    const H = ZXingBrowser.DecodeHintType;
    hints.set(H.POSSIBLE_FORMATS, [F.QR_CODE, F.CODE_128, F.CODE_39, F.EAN_13, F.EAN_8]);
    return new ZXingBrowser.BrowserMultiFormatReader(hints, 250);
  }catch{ return new ZXingBrowser.BrowserMultiFormatReader(); }
}

createApp({
  setup(){
    const video = ref(null);
    const reader = createReader();

    const API_URL = (window.API_URL || 'https://jakartabackend.onrender.com/api/du/update');
    const DIGIT_DU_RE = /^\d{10,20}$/;

    const state = reactive({
      lang: 'id', // 默认印尼语
      running:false, last:null, locked:false,
      torchSupported:false, torchOn:false, isValid:false,
      duStatus:"", remark:"",
      photoFile:null, photoPreview:"",
      submitting:false, submitOk:false, submitMsg:"",
      uploadPct:0, needsStatusHint:false, needsStatusShake:false,
    });

    const t = tFactory(state);

    const setLang = (l)=>{
      state.lang = l; document.documentElement.lang = l;
      const titleMap = { zh:'手机扫码 - 状态更新', en:'Scanner - Status Update', id:'Pemindaian - Pembaruan Status' };
      document.title = titleMap[l] || 'DU Status Update';
    };

    let controls = null; let inactivityTimer = null;
    const clearInactivity=()=>{ if(inactivityTimer){ clearTimeout(inactivityTimer); inactivityTimer=null; } };
    const startInactivityCountdown=()=>{ clearInactivity(); inactivityTimer=setTimeout(()=>{ stop(); }, 2*60*1000); };

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
        try{ const caps = track.getCapabilities?.(); if(caps?.zoom){ const z=caps.zoom; const t=Math.min(z.max, Math.max(z.min||1,(z.min||1)*1.3)); await track.applyConstraints({ advanced: [{ zoom: t }] }); } }catch{}
      }catch{}
    }

    async function buildBackCameraConstraints(){
      const tries = [
        { video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      ];
      for(const c of tries){
        try{ const s = await navigator.mediaDevices.getUserMedia(c); s.getTracks().forEach(t=>t.stop()); return c; }catch{}
      }
      try{ const devices = await navigator.mediaDevices.enumerateDevices(); const cams = devices.filter(d=>d.kind==='videoinput'); const back = cams.find(d=>!/front|user/i.test(d.label)) || cams[0]; if(back){ return { video: { deviceId: { exact: back.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio:false }; } }catch{}
      return { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio:false };
    }

    const start = async ()=>{
      if (state.running) return;
      try{
        state.running = true; state.locked = false; clearInactivity();
        try{ controls?.stop(); }catch{}

        let constraints = await buildBackCameraConstraints();
        try{
          controls = await reader.decodeFromConstraints(
            constraints,
            video.value,
            async (result, err, _controls) => {
              if (result && !state.locked) {
                state.locked = true;
                const text = result.getText();
                const format = result.getBarcodeFormat();
                state.isValid = DIGIT_DU_RE.test(text);
                state.duStatus = ""; state.remark = ""; clearPhoto();
                state.submitMsg = ""; state.submitOk = false;
                state.needsStatusHint = false; state.needsStatusShake = false;
                state.last = { text, format };
                try{ _controls.stop(); }catch{}
                try{ reader.reset(); }catch{}
                await applyTorch(false); await detectTorchSupport();
                state.running = false; clearInactivity();
                try{ navigator.vibrate?.(30); }catch{}
              }
            }
          );
        }catch(e){
          if(e && (e.name==='OverconstrainedError' || e.name==='NotFoundError')){
            constraints = { video: true, audio:false };
            controls = await reader.decodeFromConstraints(constraints, video.value, ()=>{});
          }else{ throw e; }
        }

        await enhanceTrack(); await detectTorchSupport(); startInactivityCountdown();
      }catch(e){
        console.error(e);
        alert('Camera error: ' + (e?.name || '') + (e?.message ? (' - ' + e.message) : ''));
        state.running = false;
      }
    };

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
      state.running=false; state.locked=false; clearInactivity();
    };

    const resume = async ()=>{
      state.last=null; state.locked=false; state.isValid=false;
      state.duStatus=""; state.remark=""; clearPhoto();
      state.submitMsg=""; state.submitOk=false;
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

    const submitUpdate = async ()=>{
      if(!state.isValid){ state.submitOk=false; state.submitMsg=t('invalidId'); return }
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
        fd.append('duId', state.last.text);
        fd.append('status', state.duStatus); // 提交中文值以兼容现有后端
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
            state.uploadPct = 100; if(ok){ setTimeout(()=>{ resume() }, 600); }
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
      setLang('id');
      video.value?.setAttribute('playsinline','true');
      video.value?.setAttribute('muted','muted');
      document.addEventListener('visibilitychange', ()=>{ if (document.hidden) stop() });
      window.addEventListener('pagehide', stop);
      await start();
    });

    onBeforeUnmount(()=>{ stop() });

    return { state, video, t, setLang, start, stop, resume, toggleTorch: async ()=>{ if(state.torchSupported) await applyTorch(!state.torchOn) }, submitUpdate, onPickPhoto, clearPhoto };
  }
}).mount('#app');