<template>
  <div class="wrap inventory-view">
    <div class="lang-switcher-container">
      <LanguageSwitcher v-model="state.lang" @change="setLang" />
    </div>

    <!-- Header Section -->
    <div class="inventory-header">
      <h2 class="pm-title">{{ pmName || '-' }}</h2>
      <div class="mode-switcher">
        <a-button
          :type="mode === 'inventory' ? 'primary' : 'default'"
          @click="setMode('inventory')"
        >
          {{ t('viewInventory') }}
        </a-button>
        <a-button
          :type="mode === 'manage' ? 'primary' : 'default'"
          @click="setMode('manage')"
        >
          {{ t('manageInOut') }}
        </a-button>
      </div>
    </div>

    <!-- Inventory Mode -->
    <div v-if="mode === 'inventory'" class="content-section">
      <a-spin :spinning="loading">
        <div v-if="!loading && !data.ok">
          <a-alert
            v-if="data?.message && !isCameraError(data.message)"
            type="error"
            :message="data?.message || 'Failed to load'"
          />
          <div v-else class="status-box muted">({{ t('loadingError') }})</div>
        </div>

        <div v-if="!loading && data.ok">
          <div class="total-count">{{ t('totalCount') }}: {{ data.total }}</div>
          <a-table
            :columns="columns"
            :dataSource="data.items"
            :rowKey="rowKeyName"
            :pagination="{ pageSize: 10 }"
          />
        </div>
      </a-spin>
    </div>

    <!-- Manage Mode -->
    <div v-else-if="mode === 'manage'" class="content-section">
      <!-- Scanner container -->
      <section
        id="container-manage"
        class="scan-area container"
        v-show="!manageState.hasDN"
      >
        <div id="div-ui-container-manage">
          <div class="dce-video-container"></div>
        </div>
      </section>

      <!-- DN input + controls -->
      <div class="dn-input-section">
        <label for="dnInputManage">{{ t('dnCode') }}</label>
        <div class="dn-input-row">
          <span v-if="!manageState.isValid" class="status-icon error">❌</span>
          <span v-if="manageState.isValid" class="status-icon success">✅</span>
          <input
            id="dnInputManage"
            ref="dnInputManage"
            maxlength="40"
            v-model="manageState.dnNumber"
            @input="onDNInputManage"
            :class="{ 'dn-highlight': highlightPulse }"
          />
        </div>
      </div>

      <!-- Action buttons -->
      <div v-if="manageState.isValid" class="action-section">
        <div class="action-buttons">
          <a-button
            type="primary"
            class="flex-btn inbound-btn"
            @click="performInbound"
            :loading="manageState.actionLoading === 'inbound'"
            :disabled="(manageState.actionLoading && manageState.actionLoading !== 'inbound') || !manageState.isValid"
          >
            {{ t('inbound') }}
          </a-button>

          <a-button
            type="default"
            class="flex-btn outbound-btn"
            @click="performOutbound"
            :loading="manageState.actionLoading === 'outbound'"
            :disabled="(manageState.actionLoading && manageState.actionLoading !== 'outbound') || !manageState.isValid"
          >
            {{ t('outbound') }}
          </a-button>
        </div>
      </div>

      <!-- Messages -->
      <div v-if="manageState.msg" class="message-section">
        <a-alert
          v-if="!isCameraError(manageState.msg)"
          :message="manageState.msg"
          :type="manageState.ok ? 'success' : 'error'"
          show-icon
        />
        <div v-else class="status-box muted">({{ t('cameraError') }})</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, computed } from 'vue';
import { getApiBase } from '../utils/env.js';
import { useI18n } from '../i18n/useI18n';
import { isValidDn } from '../utils/dn.js';
import { createScanner } from '../composables/useScanner';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import '../assets/css/scan.css';

const pmName = ref('');
const mode = ref('inventory');
const loading = ref(false);
const data = ref({ ok: false, pm_name: '', total: 0, items: [] });

// small shared i18n helper (cached instance)
const _i18n = await useI18n({ namespaces: ['core', 'index', 'pm', 'inventory'], fallbackLang: 'en' });
const i18nVersion = ref(0);

// state for language switcher
const state = reactive({
  lang: _i18n.state.lang || 'en',
});

// Setup onChange listener after state is defined
_i18n.onChange((lang) => { state.lang = lang; i18nVersion.value++; });
const t = (key, vars) => { i18nVersion.value; return _i18n.t(key, vars); };

// manage mode state (scan + inbound/outbound)
const manageState = ref({
  dnNumber: '',
  isValid: false,
  hasDN: false,
  running: false,
  // actionLoading: '' | 'inbound' | 'outbound'
  actionLoading: '',
  msg: '',
  ok: false,
});

// filter camera/scanner related errors so they are not shown in <a-alert>
const isCameraError = (m) => {
  try {
    const s = String(m || '');
    return /\b(camera|摄像头|scanner|dynamsoft|getUserMedia|NotAllowedError|NotFoundError|NotReadableError|OverconstrainedError|Camera start failed|Scanner SDK not loaded|Camera stop failed|Scanner init failed)\b/i.test(s);
  } catch (e) { return false; }
};

// Map backend error messages to i18n keys (simple, best-effort mapping)
const mapBackendErrorToTranslation = (raw) => {
  if (!raw) return '';
  const s = String(raw).toLowerCase();
  // common cases
  if (s.includes('dn already in inventory') || s.includes('already in inventory')) return 'pm.inventory.error.dn_already_in_inventory';
  if (s.includes('not found') && s.includes('dn')) return 'pm.inventory.error.dn_not_found';
  if (s.includes('invalid') && s.includes('dn')) return 'pm.inventory.error.dn_invalid';
  // fallback: try to normalize spaces and punctuation to form a key-like string
  const normalized = s.replace(/[\s\.\/,:]+/g, '_').replace(/[^a-z0-9_]/g, '');
  return `pm.inventory.error.${normalized}`;
};

let scannerManage = null;
let scannerManageApi = null;
const dnInputManage = ref(null);
const successTimer = { id: null };
const highlightPulse = ref(false);
let highlightTimer = null;
// simple dedupe to avoid repeated handling of same code in short period
const lastScanned = ref('');
const lastScannedAt = ref(0);
const scanCooldownMs = 500; // ms

const setMode = (m) => {
  mode.value = m;
  if (m === 'inventory') fetchInventory();
  if (m === 'manage') initManageScanner();
};

const formatDate = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch (e) {
    return iso;
  }
};

// Table columns for inventory
const columns = computed(() => {
  // Depend on i18nVersion to re-compute when language changes
  i18nVersion.value;
  return [
    { title: t('dnNumber'), dataIndex: 'dn_number', key: 'dn_number' },
    { title: t('inboundTime'), dataIndex: 'in_time', key: 'in_time', customRender: ({ text }) => formatDate(text) },
  ];
});

const rowKeyName = (record) => record.id || record.dn_number || JSON.stringify(record);

const fetchInventory = async () => {
  loading.value = true;
  try {
    // ensure we have a pm_name (from pmName ref or localStorage)
    const pm = pmName.value || (typeof localStorage !== 'undefined' ? localStorage.getItem('selected_pm_name') : '') || '';
    if (!pm) {
      data.value = { ok: false, message: 'pm_name required. 请先创建或选择 PM。', total: 0, items: [] };
      loading.value = false;
      return;
    }

    const API_BASE = getApiBase();
    const base = (API_BASE ? API_BASE.replace(/\/+$/, '') : '');
    const url = base + '/api/pm/inventory' + '?pm_name=' + encodeURIComponent(pm);
    const res = await fetch(url, { method: 'GET' });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${text ? ': ' + text : ''}`);
    }

    // try parse JSON, but handle non-JSON gracefully
    let j;
    try {
      j = await res.json();
    } catch (parseErr) {
      const text = await res.text().catch(() => '');
      throw new Error('Invalid JSON response: ' + (text || parseErr.message));
    }

  // basic shape validation
    if (!j || typeof j !== 'object' || Array.isArray(j)) {
      throw new Error('Unexpected response shape');
    }

    // normalize values to expected shape
    data.value = {
      ok: !!j.ok,
      pm_name: j.pm_name || j.pm || '',
      total: typeof j.total === 'number' ? j.total : (Array.isArray(j.items) ? j.items.length : 0),
      items: Array.isArray(j.items) ? j.items : [],
      message: j.message || '',
    };

    if (data.value.pm_name) pmName.value = data.value.pm_name;
  } catch (e) {
    console.error('fetchInventory', e);
    data.value = { ok: false, message: e?.message || 'Error', total: 0, items: [] };
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  try {
    const stored = localStorage.getItem('selected_pm_name');
    if (stored) pmName.value = stored;
  } catch (e) {}
  fetchInventory();
});

onBeforeUnmount(async () => {
  try {
    if (scannerManage && typeof scannerManage.stop === 'function') await scannerManage.stop();
  } catch {}
  try {
    if (scannerManage && typeof scannerManage.destroyContext === 'function') await scannerManage.destroyContext();
  } catch {}
  try {
    if (successTimer.id) { clearTimeout(successTimer.id); successTimer.id = null; }
  } catch {}
});

const initManageScanner = async () => {
  // initialize scanner on demand
  try {
    scannerManageApi = await createScanner();
    await scannerManageApi.init();
    scannerManage = scannerManageApi;
    const container = document.getElementById('div-ui-container-manage');
    if (container) await scannerManageApi.setUIElement(container);
    scannerManageApi.setVideoFit('cover');
    try { scannerManageApi.barcodeFillStyle = 'rgba(73,245,73,0)'; } catch {}
    try { scannerManageApi.barcodeLineWidth = 5; } catch {}
    try { scannerManageApi.barcodeStrokeStyle = 'rgba(73,245,73,1)'; } catch {}
    scannerManageApi.setOnUniqueRead((txt) => onCodeScannedManage(txt));
    await scannerManageApi.show();
    manageState.value.running = true;
  } catch (e) {
    // Log the error for debugging but do not show raw scanner errors in the UI
    console.error('manage scanner init', e);
    manageState.value.ok = false;
  }
};

const stopManageScanner = async () => {
  try {
    if (scannerManageApi && typeof scannerManageApi.stop === 'function') await scannerManageApi.stop();
    manageState.value.running = false;
  } catch (e) {
    console.error(e);
  }
};

const onCodeScannedManage = async (code) => {
  try {
    const v = String(code || '').toUpperCase();
    // dedupe: ignore same code within cooldown window
    const now = Date.now();
    if (v && v === lastScanned.value && (now - lastScannedAt.value) < scanCooldownMs) return;
    lastScanned.value = v;
    lastScannedAt.value = now;

    manageState.value.isValid = isValidDn(v);
    manageState.value.dnNumber = v;

    // animate input to emphasize the scanned DN when valid
    try {
      if (manageState.value.isValid) {
        highlightPulse.value = false; // restart
        if (highlightTimer) { clearTimeout(highlightTimer); highlightTimer = null; }
        // small next tick to allow CSS reflow restart
        setTimeout(() => { highlightPulse.value = true; }, 10);
        highlightTimer = setTimeout(() => { highlightPulse.value = false; highlightTimer = null; }, 900);
      }
    } catch (e) {}

    // Keep scanner running so it continues to scan for new codes.
    // We intentionally do NOT stop the scanner or set hasDN here.
    // If the UI needs to explicitly pause scanning, user can press the rescan/controls.
  } catch (e) {
    console.error('onCodeScannedManage error', e);
  }
};

const onDNInputManage = () => {
  manageState.value.dnNumber = (dnInputManage.value?.value || '').toUpperCase();
  manageState.value.isValid = isValidDn(manageState.value.dnNumber);
};

// rescan removed per UI simplification: scanning now continues automatically

const performAction = async (path, actionName) => {
  if (!manageState.value.isValid) return;
  manageState.value.actionLoading = actionName;
  manageState.value.msg = '';
  try {
    const pm = pmName.value || (typeof localStorage !== 'undefined' ? localStorage.getItem('selected_pm_name') : '') || '';
    if (!pm) throw new Error('pm_name required');
    const API_BASE = getApiBase();
    const url = (API_BASE ? API_BASE.replace(/\/+$/, '') : '') + path;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pm_name: pm, dn_number: manageState.value.dnNumber }),
    });
    // Try to parse JSON body. If parsing fails, capture raw text.
    let j = {};
    let rawText = '';
    try {
      j = await res.json();
    } catch (parseErr) {
      try { rawText = await res.text(); } catch (tErr) { rawText = ''; }
    }

    if (!res.ok) {
      // Prefer `detail` then `message`, then raw text, then status
      let errMsg = j?.detail || j?.message || rawText || `HTTP ${res.status}`;
      if (typeof errMsg === 'object') errMsg = JSON.stringify(errMsg);
      manageState.value.ok = false;
      // try translate
      const transKey = mapBackendErrorToTranslation(errMsg);
      const translated = transKey ? t(transKey) : '';
      manageState.value.msg = (translated && translated !== transKey) ? translated : errMsg;
      return;
    }

    manageState.value.ok = !!j.ok || res.ok;
    if (manageState.value.ok) {
      // Use friendly i18n success message depending on action
      const successKey = actionName === 'inbound' ? 'pm.inventory.success.inbound' : actionName === 'outbound' ? 'pm.inventory.success.outbound' : 'pm.inventory.success.default';
      const translatedSuccess = t(successKey);
      // If action-specific translation missing, try generic success translation
      let finalMsg = '';
      if (translatedSuccess && translatedSuccess !== successKey) {
        finalMsg = translatedSuccess;
      } else {
        const generic = t('pm.inventory.success.default');
        if (generic && generic !== 'pm.inventory.success.default') {
          finalMsg = generic;
        } else {
          // fallback to backend-provided message/detail/rawText if available
          finalMsg = j?.message || j?.detail || rawText || '';
        }
      }
      // last resort hardcoded english
      if (!finalMsg) finalMsg = 'Success';
      manageState.value.msg = finalMsg;
      // auto-hide success message after 3s
      try { if (successTimer.id) clearTimeout(successTimer.id); } catch (e) {}
      successTimer.id = setTimeout(() => { manageState.value.msg = ''; successTimer.id = null; }, 3000);
    } else {
      // prefer backend message/detail, but try translate
      let successMsg = j?.message || j?.detail || rawText || (manageState.value.ok ? 'OK' : 'Failed');
      const transKey = mapBackendErrorToTranslation(successMsg);
      const translated = transKey ? t(transKey) : '';
      manageState.value.msg = (translated && translated !== transKey) ? translated : successMsg;
    }
  } catch (e) {
    manageState.value.ok = false;
    manageState.value.msg = e?.message || 'Error';
    console.error('performAction', e);
  } finally {
    // Ensure we always clear the specific action loading flag
    if (manageState.value.actionLoading === actionName) manageState.value.actionLoading = '';
  }
};

const performInbound = async () => performAction('/api/pm/inbound', 'inbound');
const performOutbound = async () => performAction('/api/pm/outbound', 'outbound');

const setLang = async (lang) => {
  if (!lang || lang === _i18n.state.lang) return;
  await _i18n.setLang(lang);
};
</script>

<style src="../assets/css/pm.css"></style>
