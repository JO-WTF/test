<template>
  <div class="wrap pm-view">
    <a-card :title="t('pm.title')" :bordered="false" class="pm-card">
      <a-space direction="vertical" :size="16" style="width: 100%">
        <!-- Map Container -->
        <div class="map-container">
          <div ref="mapContainer" class="map-box"></div>

          <!-- Editable address textbox (fills with current location when available) -->
                  <div class="address-edit search-bar" style="margin-top:12px">
                    <!-- Two buttons: use current location, or open address input / search -->
                    <a-button type="default" size="large" @click="useCurrentLocationAsPM" class="use-current-button">
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

        <!-- PM Name Input -->
        <a-form-item style="margin-bottom: 0">
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
        >
          {{ t('pm.confirm') }}
        </a-button>

        <!-- Success/Error Message -->
        <a-alert
          v-if="submitMsg"
          :message="submitMsg"
          :type="submitOk ? 'success' : 'error'"
          show-icon
          closable
          @close="submitMsg = ''"
        />
      </a-space>
    </a-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, h, nextTick } from 'vue';
import { createI18n } from '../i18n/core';
import { getMapboxAccessToken, getApiBase } from '../utils/env.js';
import { EnvironmentOutlined } from '@ant-design/icons-vue';

// i18n
const i18n = createI18n({ namespaces: ['core', 'index', 'pm'], fallbackLang: 'id', defaultLang: 'id' });
await i18n.init();
const i18nVersion = ref(0);
i18n.onChange(() => {
  i18nVersion.value++;
});
const t = (key, vars) => {
  i18nVersion.value;
  return i18n.t(key, vars);
};

const mapContainer = ref(null);
const mapboxgl = ref(null);
const mapInstance = ref(null);
const marker = ref(null);

const addressQuery = ref('');
const displayAddress = ref('');
const showAddressInput = ref(true);
const addressInputRef = ref(null);
const pmName = ref('');
const submitting = ref(false);
const submitOk = ref(false);
const submitMsg = ref('');

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
  const mb = await ensureMapbox();
  if (!mb || !mapContainer.value) return;
  mapInstance.value = new mb.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [lng, lat],
    zoom,
  });

  marker.value = new mb.Marker({ draggable: true })
    .setLngLat([lng, lat])
    .addTo(mapInstance.value);

  marker.value.on('dragend', async () => {
    const lnglat = marker.value.getLngLat();
    await reverseGeocode(lnglat.lng, lnglat.lat);
  });
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


const useCurrentLocationAsPM = async () => {
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
    console.error('Failed to get current location', e);
  }
};

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
  } catch (e) {
    submitOk.value = false;
    submitMsg.value = `${t('pm.create.fail')}: ${e?.message || 'Error'}`;
    console.error(e);
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  // try to get browser geolocation
  try {
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
      navigator.geolocation.getCurrentPosition((p) => resolve(p), (err) => reject(err));
    });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    await initMap(lng, lat, 14);
    await reverseGeocode(lng, lat);
  } catch (e) {
    // fallback init
    await initMap();
  }
});

onBeforeUnmount(() => {
  try {
    if (mapInstance.value) mapInstance.value.remove();
  } catch {}
});
</script>

<style src="../assets/css/pm.css"></style>
