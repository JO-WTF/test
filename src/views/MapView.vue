<template>
  <div class="map-view">
    <aside class="map-view__sidebar">
      <header class="sidebar-header">
        <h1>DN 地图视图</h1>
        <p class="sidebar-summary">
          共 <strong>{{ dnItems.length }}</strong> 条记录
        </p>
      </header>
      <div class="sidebar-content" role="status" aria-live="polite">
        <div v-if="isLoading" class="sidebar-state">正在加载数据…</div>
        <div v-else-if="error" class="sidebar-state sidebar-state--error">{{ error }}</div>
        <div v-else-if="!dnItems.length" class="sidebar-state">暂无 DN 数据</div>
        <ul v-else class="dn-list">
          <li
            v-for="item in dnItems"
            :key="item.id || item.dn_number"
            class="dn-card"
            :class="{ 'dn-card--on-site': isOnSiteStatus(item.status) }"
          >
            <div class="dn-card__header">
              <span class="dn-number">{{ item.dn_number || '未命名 DN' }}</span>
              <span
                class="status-tag"
                :class="{ 'status-tag--on-site': isOnSiteStatus(item.status) }"
              >
                {{ item.status || '未填写' }}
              </span>
            </div>
            <div class="dn-card__meta">
              <div class="meta-row">
                <span class="meta-label">Region</span>
                <span class="meta-value">{{ formatField(item.region) }}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">LSP</span>
                <span class="meta-value">{{ formatField(item.lsp) }}</span>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </aside>
    <section class="map-view__map" aria-live="polite">
      <div v-if="!mapboxToken" class="map-placeholder">
        未配置 Mapbox access token，无法展示地图。
      </div>
      <div v-else ref="mapContainer" class="map-canvas"></div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getApiBase, getMapboxAccessToken } from '../utils/env';

const mapboxToken = getMapboxAccessToken();

const dnItems = ref([]);
const isLoading = ref(false);
const error = ref('');

const mapContainer = ref(null);
const mapInstance = shallowRef(null);
const mapLoaded = ref(false);
const activeMarkers = [];
const activeRoutes = [];
let pendingMarkerData = null;
let currentRouteGeneration = 0;

const ORIGIN_COORDINATES = [107.08, -6.29];
const ROUTE_SOURCE_PREFIX = 'dn-route-source-';
const ROUTE_LAYER_PREFIX = 'dn-route-layer-';

const apiBase = getApiBase();

const buildRequestUrl = (page) => {
  const params = new URLSearchParams({
    status_not_empty: 'true',
    date: '29 Sep 25',
    page: String(page),
  });

  if (apiBase) {
    const url = new URL('/api/dn/list/search', apiBase);
    url.search = params.toString();
    return url.toString();
  }

  return `/api/dn/list/search?${params.toString()}`;
};

const normalizeNumber = (value) => {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
};

const isOnSiteStatus = (status) => {
  if (!status) return false;
  const normalized = String(status).trim().toLowerCase();
  return normalized === 'on site' || normalized === 'arrived at site';
};

const formatField = (value) => {
  if (value === undefined || value === null) return '—';
  const text = String(value).trim();
  return text.length ? text : '—';
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatForPopup = (value, fallback = '—') => {
  const formatted = formatField(value);
  const text = formatted === '—' ? fallback : formatted;
  return escapeHtml(text);
};

const createPointKey = (item, lat, lng, index) => {
  if (item?.id !== undefined && item?.id !== null) {
    return `id-${item.id}`;
  }

  if (item?.dn_number) {
    return `dn-${String(item.dn_number).replace(/\s+/g, '-')}`;
  }

  return `coord-${lng}-${lat}-${index}`;
};

const mapPoints = computed(() => {
  return dnItems.value
    .map((item, index) => {
      const lat = normalizeNumber(item.lat);
      const lng = normalizeNumber(item.lng);
      if (lat === null || lng === null) return null;
      return {
        id: item.id,
        dnNumber: item.dn_number,
        status: item.status,
        region: item.region,
        lsp: item.lsp,
        latitude: lat,
        longitude: lng,
        isOnSite: isOnSiteStatus(item.status),
        key: createPointKey(item, lat, lng, index),
      };
    })
    .filter(Boolean);
});

const clearMarkers = () => {
  while (activeMarkers.length) {
    const marker = activeMarkers.pop();
    try {
      marker.remove();
    } catch (err) {
      console.error(err);
    }
  }
};

const clearRoutes = () => {
  if (!mapInstance.value) return;

  while (activeRoutes.length) {
    const { layerId, sourceId } = activeRoutes.pop();
    try {
      if (mapInstance.value.getLayer(layerId)) {
        mapInstance.value.removeLayer(layerId);
      }
      if (mapInstance.value.getSource(sourceId)) {
        mapInstance.value.removeSource(sourceId);
      }
    } catch (err) {
      console.error(err);
    }
  }
};

const fetchRouteGeoJson = async (from, to) => {
  const coordinates = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=${mapboxToken}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`路线获取失败（${response.status}）`);
  }

  const payload = await response.json();
  const route = payload?.routes?.[0]?.geometry;
  if (!route) {
    throw new Error('未获取到路线数据');
  }

  return {
    type: 'Feature',
    geometry: route,
    properties: {},
  };
};

const addRouteToMap = (point, geojson) => {
  if (!mapInstance.value) return;

  const sourceId = `${ROUTE_SOURCE_PREFIX}${point.key}`;
  const layerId = `${ROUTE_LAYER_PREFIX}${point.key}`;

  try {
    if (mapInstance.value.getLayer(layerId)) {
      mapInstance.value.removeLayer(layerId);
    }
    if (mapInstance.value.getSource(sourceId)) {
      mapInstance.value.removeSource(sourceId);
    }

    mapInstance.value.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [geojson],
      },
    });

    mapInstance.value.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': point.isOnSite ? '#22c55e' : '#2563eb',
        'line-width': 4,
        'line-opacity': 0.7,
      },
    });

    activeRoutes.push({ layerId, sourceId });
  } catch (err) {
    console.error(err);
  }
};

const updateMarkers = async (points) => {
  if (!mapInstance.value || !mapLoaded.value) return;
  clearMarkers();
  clearRoutes();
  if (!Array.isArray(points) || !points.length) return;

  const bounds = new mapboxgl.LngLatBounds();

  points.forEach((point) => {
    const marker = new mapboxgl.Marker({
      color: point.isOnSite ? '#22c55e' : '#2563eb',
    })
      .setLngLat([point.longitude, point.latitude])
      .setPopup(
        new mapboxgl.Popup({ offset: 24 }).setHTML(
          `
            <div class="marker-popup">
              <strong>${formatForPopup(point.dnNumber, 'DN 未命名')}</strong>
              <div>状态：${formatForPopup(point.status, '未填写')}</div>
              <div>Region：${formatForPopup(point.region)}</div>
              <div>LSP：${formatForPopup(point.lsp)}</div>
            </div>
          `.trim()
        )
      )
      .addTo(mapInstance.value);

    activeMarkers.push(marker);
    bounds.extend([point.longitude, point.latitude]);
  });

  if (points.length === 1) {
    mapInstance.value.easeTo({
      center: [points[0].longitude, points[0].latitude],
      zoom: 9,
      duration: 800,
    });
  } else {
    mapInstance.value.fitBounds(bounds, {
      padding: 64,
      maxZoom: 10,
      duration: 800,
    });
  }

  const routeGeneration = ++currentRouteGeneration;

  await Promise.allSettled(
    points.map(async (point) => {
      try {
        const geojson = await fetchRouteGeoJson(ORIGIN_COORDINATES, [
          point.longitude,
          point.latitude,
        ]);

        if (routeGeneration !== currentRouteGeneration) {
          return;
        }

        addRouteToMap(point, geojson);
      } catch (err) {
        console.error(err);
      }
    })
  );
};

const scheduleMarkerUpdate = (points) => {
  if (!mapInstance.value) {
    pendingMarkerData = points;
    return;
  }

  if (!mapLoaded.value) {
    pendingMarkerData = points;
    return;
  }

  updateMarkers(points).catch((err) => {
    console.error(err);
  });
};

const initializeMap = () => {
  if (!mapboxToken || !mapContainer.value) return;

  mapboxgl.accessToken = mapboxToken;

  const map = new mapboxgl.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [106.8456, -6.2088],
    zoom: 5,
  });

  map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }));

  map.on('load', () => {
    mapLoaded.value = true;
    updateMarkers(pendingMarkerData || mapPoints.value).catch((err) => {
      console.error(err);
    });
    pendingMarkerData = null;
  });

  mapInstance.value = map;
};

const fetchAllDnItems = async () => {
  isLoading.value = true;
  error.value = '';
  dnItems.value = [];

  try {
    const aggregated = [];
    let total = Infinity;
    let page = 1;

    while (aggregated.length < total) {
      const response = await fetch(buildRequestUrl(page));
      let payload;
      try {
        payload = await response.json();
      } catch (err) {
        throw new Error('无法解析服务器返回的数据');
      }

      if (!response.ok || payload?.ok === false) {
        const message =
          payload?.message || payload?.msg || `请求失败（${response.status}）`;
        throw new Error(message);
      }

      const items = Array.isArray(payload?.items) ? payload.items : [];
      aggregated.push(...items);

      const reportedTotal = Number(payload?.total);
      if (Number.isFinite(reportedTotal) && reportedTotal >= 0) {
        total = reportedTotal;
      }

      const pageSize = Number(payload?.page_size);
      if (!items.length || (Number.isFinite(pageSize) && items.length < pageSize)) {
        break;
      }

      page += 1;
      if (page > 200) {
        break;
      }
    }

    dnItems.value = aggregated;
    scheduleMarkerUpdate(mapPoints.value);
  } catch (err) {
    console.error(err);
    error.value = err?.message || '加载 DN 数据失败';
  } finally {
    isLoading.value = false;
  }
};

watch(
  mapPoints,
  (points) => {
    scheduleMarkerUpdate(points);
  },
  { deep: false }
);

onMounted(() => {
  if (mapboxToken) {
    initializeMap();
  }
  fetchAllDnItems();
});

onBeforeUnmount(() => {
  clearMarkers();
  clearRoutes();
  if (mapInstance.value) {
    try {
      mapInstance.value.remove();
    } catch (err) {
      console.error(err);
    }
    mapInstance.value = null;
  }
});
</script>

<style scoped>
.map-view {
  display: grid;
  grid-template-columns: minmax(320px, 360px) 1fr;
  height: 100vh;
  background: #f8fafc;
  color: #0f172a;
}

.map-view__sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e2e8f0;
  background: #ffffff;
  overflow: hidden;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid #e2e8f0;
}

.sidebar-header h1 {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 600;
}

.sidebar-summary {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-state {
  padding: 16px;
  border-radius: 12px;
  background: #f1f5f9;
  color: #475569;
  text-align: center;
  font-size: 14px;
}

.sidebar-state--error {
  background: #fee2e2;
  color: #b91c1c;
}

.dn-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dn-card {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 16px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.dn-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
}

.dn-card--on-site {
  border-color: #22c55e;
  box-shadow: 0 16px 32px rgba(34, 197, 94, 0.15);
}

.dn-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.dn-number {
  font-weight: 600;
  font-size: 16px;
  color: #0f172a;
  word-break: break-all;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.status-tag--on-site {
  background: #dcfce7;
  color: #15803d;
}

.dn-card__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.meta-label {
  color: #64748b;
}

.meta-value {
  color: #0f172a;
  text-align: right;
}

.map-view__map {
  position: relative;
}

.map-canvas {
  width: 100%;
  height: 100%;
}

.map-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
  color: #b91c1c;
  height: 100%;
  background: #fef2f2;
  font-weight: 500;
}

.marker-popup {
  font-size: 13px;
  color: #0f172a;
}

.marker-popup strong {
  display: block;
  margin-bottom: 6px;
}

@media (max-width: 960px) {
  .map-view {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    height: auto;
    min-height: 100vh;
  }

  .map-view__sidebar {
    border-right: none;
    border-bottom: 1px solid #e2e8f0;
  }

  .map-canvas {
    min-height: 400px;
  }
}
</style>
