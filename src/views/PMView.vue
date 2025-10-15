<template>
  <div class="wrap pm-view">
    <a-card :title="t('pm.title')" :bordered="false" class="pm-card">
      <template #extra>
        <LanguageSwitcher v-model="state.lang" @change="setLang" />
      </template>
      <a-space direction="vertical" :size="16" style="width: 100%">
        <!-- Mode toggle -->
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px">
          <a-button :type="mode === 'use' ? 'primary' : 'default'" @click="setMode('use')">
            {{ t('pm.use_existing') || 'Use existing PM' }}
          </a-button>
          <a-button :type="mode === 'create' ? 'primary' : 'default'" @click="setMode('create')">
            {{ t('pm.create_mode') || 'Create PM' }}
          </a-button>
        </div>
        <!-- Map Container (only visible in create mode) -->
        <div class="map-container" v-if="mode === 'create'">
          <div ref="mapContainer" class="map-box">
            <!-- visual marker overlay: always centered (fixed during move/zoom) -->
            <div class="map-center-marker" aria-hidden="true"></div>
          </div>

          <!-- Editable address textbox (fills with current location when available) -->
          <div class="address-edit search-bar" style="margin-top:12px">
            <!-- Two buttons: use current location, or open address input / search -->
            <a-button :loading="isGettingLocation" :disabled="isGettingLocation" type="default" size="large" @click="useCurrentLocationAsPM" class="use-current-button">
              {{ t('pm.use_current') || '使用当前位置' }}
            </a-button>

            <!-- Address input is hidden by default. It will be shown when the second button is clicked. -->
            <a-input
              v-if="showAddressInput"
              ref="addressInputRef"
              v-model:value="addressQuery"
              @keyup.enter="searchAddress"
              :placeholder="t('pm.search.placeholder')"
              size="large"
              allow-clear
              class="search-input"
            >
              <template #prefix>
                <EnvironmentOutlined />
              </template>
              <template #suffix>
                <a-button type="primary" size="small" class="pm-suffix-btn" @click="searchAddress">
                  {{ t('pm.search.button') || '搜索' }}
                </a-button>
              </template>
            </a-input>
          </div>

          <div class="address-hint" style="margin-top:8px;color:#334155;font-size:13px">
            {{ t('pm.address.hint') || '请确认地图中展示的Pool Mover 位置正确。如果位置不准确，点击地址，输入正确的位置并搜索。' }}
          </div>
        
        </div>

        <!-- PM List / Create area: show table when mode is 'use', else show create UI below -->
        <div class="pm-list" style="margin-top:16px">
          <div v-if="mode === 'use'">
            <div class="pm-list-header" style="display:flex; align-items:center; justify-content:space-between">
              <div class="pm-list-title">{{ t('pm.list.title') || 'Available PMs' }}</div>
              <a-button class="pm-refresh-btn" size="small" @click="fetchPMList">{{ t('pm.list.refresh') || 'Refresh' }}</a-button>
            </div>
            <div v-if="pmLoading" style="margin-top:8px">
              <a-spin class="pm-loading" />
              <span class="pm-loading-text">{{ t('loading') || 'Loading...' }}</span>
            </div>

            <!-- Card grid instead of table -->
            <a-row v-else :gutter="16" class="pm-card-grid" style="margin-top:12px">
              <a-col v-for="item in pmList" :key="item.id" :xs="24" :sm="12" :md="8" :lg="6">
                <a-card class="pm-item-card" :body-style="{ padding: '12px' }">
                  <div class="pm-item-content">
                    <div class="pm-item-name">{{ item.pm_name || '-' }}</div>
                    <div class="pm-item-location">{{ formatLocation(item.lng, item.lat) }}</div>
                  </div>
                  <template #actions>
                    <a-button class="pm-select-btn" type="primary" size="small" @click="doSelectPM(item)">{{ t('pm.select') || 'Select' }}</a-button>
                  </template>
                </a-card>
              </a-col>
            </a-row>
          </div>
          <div v-else>
            <!-- Create PM UI stays here (keep existing create UI visible when mode === 'create') -->
          </div>
        </div>

        <!-- PM Name Input -->
        <a-form-item style="margin-bottom: 0" v-show="mode === 'create'">
          <a-input
            v-model:value="pmName"
            :placeholder="t('pm.name.placeholder')"
            size="large"
            allow-clear
          />
        </a-form-item>

        <!-- Submit Button -->
        <a-button
          type="primary"
          size="large"
          :disabled="submitting || !pmName"
          :loading="submitting"
          @click="submitPM"
          block
          v-show="mode === 'create'"
        >
          {{ t('pm.confirm') }}
        </a-button>

        <!-- Success/Error Message -->
        <a-alert
          v-if="submitMsg && !isCameraError(submitMsg)"
          :message="submitMsg"
          :type="submitOk ? 'success' : 'error'"
          show-icon
          closable
          @close="submitMsg = ''"
        />
        <div v-else-if="submitMsg && isCameraError(submitMsg)" class="status-box muted">(摄像头错误，已记录)</div>
      </a-space>
    </a-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, h, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '../i18n/useI18n';
import { getMapboxAccessToken, getApiBase } from '../utils/env.js';
import { EnvironmentOutlined } from '@ant-design/icons-vue';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';

// use shared i18n helper
const _i18n = await useI18n({ namespaces: ['core', 'index', 'pm'], fallbackLang: 'id', defaultLang: 'id' });
const i18nVersion = ref(0);
_i18n.onChange(() => { i18nVersion.value++; });
const t = (key, vars) => { i18nVersion.value; return _i18n.t(key, vars); };

const mapContainer = ref(null);
const mapboxgl = ref(null);
const mapInstance = ref(null);
const marker = ref(null);
const centerCoords = ref({ lng: null, lat: null });

const addressQuery = ref('');
const displayAddress = ref('');
const showAddressInput = ref(true);
const addressInputRef = ref(null);
const pmName = ref('');
const submitting = ref(false);
const isGettingLocation = ref(false);
const submitOk = ref(false);
const submitMsg = ref('');

// PM list state
const pmList = ref([]);
const pmLoading = ref(false);

const renderPMItem = (item) => {
  return h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' } }, [
    h('div', item.pm_name || '-'),
    h('div', [
      h('a-button', { type: 'link', size: 'small', onClick: () => selectPM(item) }, t('pm.select') || 'Select'),
    ]),
  ]);
};

const formatLocation = (lng, lat) => {
  const l1 = Number(lng);
  const l2 = Number(lat);
  const fmt = (v) => (Number.isFinite(v) ? Number(v).toFixed(2) : '-');
  return `${fmt(l1)}, ${fmt(l2)}`;
};

const fetchPMList = async () => {
  pmLoading.value = true;
  try {
    const API_BASE = getApiBase();
    const base = API_BASE ? API_BASE.replace(/\/+$|$/, '') : '';
    const url = base + '/api/pm/list_pm';
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (j && Array.isArray(j.items)) {
      pmList.value = j.items;
    } else {
      pmList.value = [];
    }
  } catch (e) {
    console.error('fetchPMList', e);
    pmList.value = [];
  } finally {
    pmLoading.value = false;
  }
};

const selectPM = async (p) => {
  try {
    if (!p) return;
    pmName.value = p.pm_name || '';
    // move map to pm location
    const lng = Number(p.lng);
    const lat = Number(p.lat);
    if (mapInstance.value && Number.isFinite(lng) && Number.isFinite(lat)) {
      mapInstance.value.flyTo({ center: [lng, lat], zoom: 14 });
      if (marker.value) marker.value.setLngLat([lng, lat]);
    } else {
      await initMap(lng, lat, 14);
    }
    try { localStorage.setItem('selected_pm_name', pmName.value); } catch (e) {}
  } catch (e) {
    console.error('selectPM', e);
  }
};

// mode: 'use' | 'create' (default 'use')
const mode = ref('use');
// language state for LanguageSwitcher
const state = reactive({ lang: _i18n.state.lang });

const setLang = async (lang) => {
  if (!lang || lang === _i18n.state.lang) return;
  await _i18n.setLang(lang);
  state.lang = lang;
};

const setMode = async (m) => {
  if (!m) return;
  mode.value = m;
  // when switching to create mode, initialize map if not yet initialized
  if (m === 'create') {
    try {
      // try to get browser geolocation first
      let lat = null; let lng = null;
      try {
        const pos = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
          navigator.geolocation.getCurrentPosition((p) => resolve(p), (err) => reject(err));
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        // ignore geolocation failure; we'll init with defaults
      }

      // Always try to initialize a fresh map bound to the current container.
      try {
        if (lat !== null && lng !== null) {
          await initMap(lng, lat, 14);
          await reverseGeocode(lng, lat);
        } else {
          await initMap();
        }
      } catch (err) {
        console.error('setMode initMap', err);
      }
    } catch (err) {
      console.error('setMode initMap', err);
    }
  }
};

const doSelectPM = async (p) => {
  try {
    await selectPM(p);
    // after selection, navigate to inventory
    router.push({ path: '/inventory' }).catch(() => {});
  } catch (e) {
    console.error('doSelectPM', e);
  }
};

const pmColumns = [
  { title: t('pm.name.label') || 'PM Name', dataIndex: 'pm_name', key: 'pm_name' },
  {
    title: t('pm.list.location') || 'Location',
    key: 'location',
    customRender: ({ record }) => {
      const lng = Number(record.lng);
      const lat = Number(record.lat);
      const fmt = (v) => (Number.isFinite(v) ? Number(v).toFixed(2) : '-');
      return `${fmt(lng)}, ${fmt(lat)}`;
    },
  },
  {
    title: t('actions') || 'Actions',
    key: 'actions',
    customRender: ({ record }) => {
      return h('a-button', { type: 'primary', size: 'small', onClick: () => doSelectPM(record) }, t('pm.select') || 'Select');
    },
  },
];

// filter camera/scanner related errors so they are not shown in <a-alert>
const isCameraError = (m) => {
  try {
    const s = String(m || '');
    return /\b(camera|摄像头|scanner|dynamsoft|getUserMedia|NotAllowedError|NotFoundError|NotReadableError|OverconstrainedError|Camera start failed|Scanner SDK not loaded|Camera stop failed|Scanner init failed)\b/i.test(s);
  } catch (e) { return false; }
};

const accessToken = getMapboxAccessToken();

const ensureMapbox = async () => {
  if (!accessToken) {
    console.warn('Mapbox token missing');
    return null;
  }
  if (!mapboxgl.value) {
    const mod = await import('mapbox-gl');
    await import('mapbox-gl/dist/mapbox-gl.css');
    mapboxgl.value = mod.default || mod;
    mapboxgl.value.accessToken = accessToken;
  }
  return mapboxgl.value;
};

const initMap = async (lng = 106.827153, lat = -6.17511, zoom = 12) => {
  // If an existing map instance exists (e.g. container was destroyed when switching modes),
  // remove it first so we can safely create a fresh map bound to the current container.
  try {
    if (mapInstance.value && typeof mapInstance.value.remove === 'function') {
      try { mapInstance.value.remove(); } catch (e) { /* ignore */ }
    }
  } catch (e) {}
  mapInstance.value = null;
  marker.value = null;

  const mb = await ensureMapbox();
  if (!mb || !mapContainer.value) return;

  mapInstance.value = new mb.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [lng, lat],
    zoom,
  });

  // Use a non-draggable marker that always stays at the visual center.
  // When the user moves/pans the map, we'll read the map center and update the marker
  // and reverse-geocode that center location.
  // remove mapbox Marker usage; instead, we'll provide a centered overlay in the DOM
  marker.value = null;

  // initialize reactive center coords
  try { centerCoords.value = { lng: Number(lng), lat: Number(lat) }; } catch (e) { /* ignore */ }

  // During move, keep updating center coords so UI can reflect it; only call reverseGeocode on moveend
  try {
    mapInstance.value.on('move', () => {
      try {
        const c = mapInstance.value.getCenter();
        centerCoords.value = { lng: Number(c.lng), lat: Number(c.lat) };
      } catch (e) {}
    });

    mapInstance.value.on('moveend', async () => {
      try {
        const c = mapInstance.value.getCenter();
        centerCoords.value = { lng: Number(c.lng), lat: Number(c.lat) };
        await reverseGeocode(c.lng, c.lat);
      } catch (e) {
        console.error('map moveend handler error', e);
      }
    });
  } catch (e) { /* ignore attach errors */ }
};

const reverseGeocode = async (lng, lat) => {
  if (!accessToken) return;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    const place = (data?.features && data.features[0]?.place_name) || '';
    displayAddress.value = place;
    // fill editable textbox so user can view/modify before searching
    addressQuery.value = place;
  } catch (e) {
    console.error(e);
    displayAddress.value = '';
  }
};

const searchAddress = async () => {
  if (!addressQuery.value || !accessToken) return;
  try {
    const q = encodeURIComponent(addressQuery.value);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${encodeURIComponent(accessToken)}&limit=5`;
    const res = await fetch(url);
    const data = await res.json();
    const first = data?.features?.[0];
    if (first) {
      const [lng, lat] = first.center;
      const place = first.place_name || '';
      displayAddress.value = place;
      // also populate addressQuery so input shows chosen address
      addressQuery.value = place;
      if (mapInstance.value) {
        mapInstance.value.flyTo({ center: [lng, lat], zoom: 14 });
      }
      if (marker.value) marker.value.setLngLat([lng, lat]);
    }
  } catch (e) {
    console.error(e);
  }
};

// helper to read current map center coords
const getCenterCoords = () => {
  if (mapInstance.value && typeof mapInstance.value.getCenter === 'function') {
    const c = mapInstance.value.getCenter();
    return { lng: Number(c.lng), lat: Number(c.lat) };
  }
  return centerCoords.value;
};


const useCurrentLocationAsPM = async () => {
  isGettingLocation.value = true;
  try {
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
      navigator.geolocation.getCurrentPosition((p) => resolve(p), (err) => reject(err));
    });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    if (!mapInstance.value) {
      await initMap(lng, lat, 14);
    } else {
      mapInstance.value.flyTo({ center: [lng, lat], zoom: 14 });
      if (marker.value) marker.value.setLngLat([lng, lat]);
    }
    await reverseGeocode(lng, lat);
  } catch (e) {
    console.warn('Failed to get current location; falling back to map center', e);
    // fallback: if map exists, use its center
    try {
      const c = getCenterCoords();
      if (c && Number.isFinite(c.lng) && Number.isFinite(c.lat)) {
        if (!mapInstance.value) {
          await initMap(c.lng, c.lat, 14);
        } else {
          mapInstance.value.flyTo({ center: [c.lng, c.lat], zoom: 14 });
          if (marker.value) marker.value.setLngLat([c.lng, c.lat]);
        }
        await reverseGeocode(c.lng, c.lat);
      }
    } catch (err) {
      console.error('Fallback to map center failed', err);
    }
  } finally {
    isGettingLocation.value = false;
  }
};

const router = useRouter();

const submitPM = async () => {
  if (!pmName.value) return;
  submitting.value = true;
  submitMsg.value = '';
  submitOk.value = false;
  try {
    const lnglat = marker.value ? marker.value.getLngLat() : null;
    const payload = {
      pm_name: pmName.value,
      lng: lnglat ? String(lnglat.lng) : null,
      lat: lnglat ? String(lnglat.lat) : null,
    };

    const API_BASE = getApiBase();
    const url = (API_BASE ? API_BASE.replace(/\/+$/, '') : '') + '/api/pm/create-pm';

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    submitOk.value = true;
    submitMsg.value = t('pm.create.success');
    try {
      // persist selected pm name locally
      localStorage.setItem('selected_pm_name', pmName.value);
      // navigate to inventory view
      // refresh pm list and select newly created pm
      await fetchPMList();
      try { selectPM({ pm_name: pmName.value, lng: marker.value ? marker.value.getLngLat().lng : null, lat: marker.value ? marker.value.getLngLat().lat : null }); } catch (e) {}
      router.push({ path: '/inventory' }).catch(() => {});
    } catch (err) {
      console.warn('Failed to persist or navigate', err);
    }
  } catch (e) {
    submitOk.value = false;
    submitMsg.value = `${t('pm.create.fail')}: ${e?.message || 'Error'}`;
    console.error(e);
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  // fetch PM list on mount
  try { await fetchPMList(); } catch (e) {}
});

onBeforeUnmount(() => {
  try {
    if (mapInstance.value) mapInstance.value.remove();
  } catch {}
});
</script>

<style src="../assets/css/pm.css"></style>
