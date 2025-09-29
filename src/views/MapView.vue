<template>
  <div class="map-view">
    <aside class="map-view__sidebar">
      <header class="sidebar-header">
        <div class="sidebar-header__top">
          <h1>DN 地图视图</h1>
          <button type="button" class="btn ghost" @click="handleOpenLspSummary">
            LSP 统计
          </button>
        </div>
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

    <a-modal
      v-model:open="isLspSummaryModalVisible"
      title="LSP 统计"
      :footer="null"
      :destroy-on-close="false"
      :mask-closable="true"
      width="840px"
      @cancel="handleCloseLspSummary"
    >
      <div class="lsp-summary-modal">
        <div v-if="isLspSummaryLoading" class="lsp-summary-modal__state">正在加载统计数据…</div>
        <div v-else-if="lspSummaryError" class="lsp-summary-modal__state lsp-summary-modal__state--error">
          {{ lspSummaryError }}
        </div>
        <div v-else-if="!lspSeries.length" class="lsp-summary-modal__state">暂无统计数据</div>
        <div v-else class="lsp-summary-modal__chart">
          <div class="lsp-summary-legend" role="list">
            <div v-for="legend in lspLegendItems" :key="legend.lsp" class="lsp-summary-legend__item" role="listitem">
              <span class="lsp-summary-legend__swatch" :style="{ backgroundColor: legend.color }"></span>
              <span class="lsp-summary-legend__label">{{ legend.lsp }}</span>
            </div>
          </div>
          <div class="lsp-summary-chart__container">
            <svg
              v-if="chartConfig"
              class="lsp-summary-chart"
              :viewBox="`0 0 ${chartConfig.width} ${chartConfig.height}`"
              role="img"
              aria-labelledby="lsp-chart-title"
            >
              <title id="lsp-chart-title">LSP 状态占比随时间变化折线图</title>
              <desc>
                展示各 LSP 在不同统计时间点的 status_not_empty / total_dn 百分比。
              </desc>
              <g class="lsp-chart__axes">
                <line
                  :x1="chartConfig.padding.left"
                  :y1="chartConfig.height - chartConfig.padding.bottom"
                  :x2="chartConfig.width - chartConfig.padding.right"
                  :y2="chartConfig.height - chartConfig.padding.bottom"
                  class="lsp-chart__axis"
                />
                <line
                  :x1="chartConfig.padding.left"
                  :y1="chartConfig.padding.top"
                  :x2="chartConfig.padding.left"
                  :y2="chartConfig.height - chartConfig.padding.bottom"
                  class="lsp-chart__axis"
                />
                <g class="lsp-chart__y-ticks">
                  <template v-for="tick in chartConfig.yTicks" :key="tick.value">
                    <line
                      :x1="chartConfig.padding.left"
                      :x2="chartConfig.width - chartConfig.padding.right"
                      :y1="tick.y"
                      :y2="tick.y"
                      class="lsp-chart__grid"
                    />
                    <text
                      :x="chartConfig.padding.left - 12"
                      :y="tick.y + 4"
                      text-anchor="end"
                      class="lsp-chart__tick-label"
                    >
                      {{ tick.value }}%
                    </text>
                  </template>
                </g>
                <g class="lsp-chart__x-ticks">
                  <template v-for="tick in chartConfig.xTicks" :key="tick.key">
                    <text
                      :x="tick.x"
                      :y="chartConfig.height - chartConfig.padding.bottom + 36"
                      text-anchor="middle"
                      class="lsp-chart__tick-label"
                    >
                      {{ tick.label }}
                    </text>
                  </template>
                </g>
              </g>
              <g class="lsp-chart__series" v-for="series in chartConfig.series" :key="series.lsp">
                <path :d="series.path" fill="none" :stroke="series.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
                <g>
                  <circle
                    v-for="point in series.points"
                    :key="`${series.lsp}-${point.timeKey}`"
                    :cx="point.x"
                    :cy="point.y"
                    r="5"
                    :fill="series.color"
                  >
                    <title>
                      {{ series.lsp }}
                      {{ '\n' }}统计时间：{{ point.recordedAtLabel }}
                      {{ '\n' }}Status Not Empty：{{ point.statusNotEmpty }}
                      {{ '\n' }}Total DN：{{ point.totalDn }}
                      {{ '\n' }}占比：{{ point.percentage.toFixed(2) }}%
                    </title>
                  </circle>
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getApiBase, getMapboxAccessToken } from '../utils/env';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

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

const isLspSummaryModalVisible = ref(false);
const isLspSummaryLoading = ref(false);
const lspSummaryError = ref('');
const lspSummaryItems = ref([]);
const hasFetchedLspSummary = ref(false);

const ORIGIN_COORDINATES = [107.08, -6.29];
const ROUTE_SOURCE_PREFIX = 'dn-route-source-';
const ROUTE_LAYER_PREFIX = 'dn-route-layer-';

const apiBase = getApiBase();

const colorPalette = [
  '#5B8FF9',
  '#5AD8A6',
  '#F6BD16',
  '#E86452',
  '#6DC8EC',
  '#9270CA',
  '#FF9D4D',
  '#269A99',
  '#FF99C3',
  '#B4EBBF',
];

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

const buildLspSummaryUrl = () => {
  if (apiBase) {
    return new URL('/api/dn/status-delivery/lsp-summary-records', apiBase).toString();
  }
  return '/api/dn/status-delivery/lsp-summary-records';
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

const processedLspSummary = computed(() => {
  const items = Array.isArray(lspSummaryItems.value) ? lspSummaryItems.value : [];
  return items
    .map((item) => {
      const totalDnRaw = Number(item.total_dn);
      const statusNotEmptyRaw = Number(item.status_not_empty);
      const totalDn = Number.isFinite(totalDnRaw) ? totalDnRaw : 0;
      const statusNotEmpty = Number.isFinite(statusNotEmptyRaw) ? statusNotEmptyRaw : 0;
      const recordedAt = item.recorded_at ? dayjs(item.recorded_at).tz('Asia/Jakarta') : null;
      if (!recordedAt || !recordedAt.isValid()) return null;
      const percentage = totalDn > 0 ? (statusNotEmpty / totalDn) * 100 : 0;
      const timeKey = recordedAt.format('YYYY-MM-DD HH:mm');
      return {
        id: item.id,
        lsp: item.lsp || '未命名 LSP',
        totalDn,
        statusNotEmpty,
        recordedAt,
        timeKey,
        recordedAtLabel: recordedAt.format('YYYY-MM-DD HH:mm'),
        label: recordedAt.format('DD MMM HH:mm'),
        percentage,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.recordedAt.valueOf() - b.recordedAt.valueOf());
});

const uniqueLsps = computed(() => {
  const set = new Set();
  processedLspSummary.value.forEach((item) => {
    set.add(item.lsp);
  });
  return Array.from(set);
});

const colorMap = computed(() => {
  const map = new Map();
  uniqueLsps.value.forEach((lsp, index) => {
    map.set(lsp, colorPalette[index % colorPalette.length]);
  });
  return map;
});

const colorForLsp = (lsp) => colorMap.value.get(lsp) ?? '#888888';

const timePoints = computed(() => {
  const map = new Map();
  processedLspSummary.value.forEach((item) => {
    if (!map.has(item.timeKey)) {
      map.set(item.timeKey, {
        key: item.timeKey,
        label: item.label,
        recordedAt: item.recordedAt,
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => a.recordedAt.valueOf() - b.recordedAt.valueOf());
});

const lspSeries = computed(() => {
  const groups = new Map();
  processedLspSummary.value.forEach((item) => {
    if (!groups.has(item.lsp)) {
      groups.set(item.lsp, []);
    }
    groups.get(item.lsp).push(item);
  });

  return Array.from(groups.entries()).map(([lsp, items]) => ({
    lsp,
    items: items.sort((a, b) => a.recordedAt.valueOf() - b.recordedAt.valueOf()),
  }));
});

const chartConfig = computed(() => {
  if (!timePoints.value.length || !lspSeries.value.length) {
    return null;
  }

  const width = 720;
  const height = 360;
  const padding = { top: 24, right: 32, bottom: 80, left: 72 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const times = timePoints.value;
  const timeIndexMap = new Map(times.map((time, index) => [time.key, index]));

  const getX = (timeKey) => {
    if (times.length === 1) {
      return padding.left + innerWidth / 2;
    }
    const index = timeIndexMap.get(timeKey) ?? 0;
    return padding.left + (index * innerWidth) / (times.length - 1);
  };

  const getY = (percentage) => {
    const clamped = Math.max(0, Math.min(percentage, 100));
    return padding.top + innerHeight * (1 - clamped / 100);
  };

  const series = lspSeries.value.map(({ lsp, items }) => {
    const points = items
      .filter((item) => timeIndexMap.has(item.timeKey))
      .map((item) => ({
        x: getX(item.timeKey),
        y: getY(item.percentage),
        timeKey: item.timeKey,
        percentage: item.percentage,
        totalDn: item.totalDn,
        statusNotEmpty: item.statusNotEmpty,
        recordedAtLabel: item.recordedAtLabel,
      }));

    const path = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
      .join(' ');

    return {
      lsp,
      color: colorForLsp(lsp),
      points,
      path,
    };
  }).filter((seriesItem) => seriesItem.points.length);

  if (!series.length) {
    return null;
  }

  const yTicks = [0, 25, 50, 75, 100].map((value) => ({
    value,
    y: getY(value),
  }));

  const xTicks = times.map((time) => ({
    key: time.key,
    label: time.label,
    x: getX(time.key),
  }));

  return { width, height, padding, series, yTicks, xTicks };
});

const lspLegendItems = computed(() =>
  uniqueLsps.value.map((lsp) => ({
    lsp,
    color: colorForLsp(lsp),
  }))
);

const handleOpenLspSummary = async () => {
  isLspSummaryModalVisible.value = true;
  if (hasFetchedLspSummary.value) return;
  await fetchLspSummary();
};

const handleCloseLspSummary = () => {
  isLspSummaryModalVisible.value = false;
};

const fetchLspSummary = async () => {
  try {
    isLspSummaryLoading.value = true;
    lspSummaryError.value = '';
    const response = await fetch(buildLspSummaryUrl());
    if (!response.ok) {
      throw new Error(`统计数据获取失败（${response.status}）`);
    }
    const payload = await response.json();
    if (!payload?.ok) {
      throw new Error('统计数据返回异常');
    }
    lspSummaryItems.value = Array.isArray(payload.data) ? payload.data : [];
    hasFetchedLspSummary.value = true;
  } catch (err) {
    console.error(err);
    lspSummaryError.value = err?.message || '统计数据获取失败';
  } finally {
    isLspSummaryLoading.value = false;
  }
};

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

.sidebar-header__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sidebar-header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.sidebar-header__top .btn {
  white-space: nowrap;
}

.sidebar-summary {
  margin: 12px 0 0;
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

.lsp-summary-modal {
  min-height: 280px;
}

.lsp-summary-modal__state {
  padding: 32px 16px;
  text-align: center;
  color: #475569;
}

.lsp-summary-modal__state--error {
  color: #b91c1c;
}

.lsp-summary-modal__chart {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lsp-summary-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
}

.lsp-summary-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #0f172a;
}

.lsp-summary-legend__swatch {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #94a3b8;
}

.lsp-summary-chart__container {
  overflow-x: auto;
  padding-bottom: 8px;
}

.lsp-summary-chart {
  width: 100%;
  height: auto;
  min-width: 680px;
  color: #0f172a;
}

.lsp-chart__axis {
  stroke: #94a3b8;
  stroke-width: 1;
}

.lsp-chart__grid {
  stroke: rgba(148, 163, 184, 0.35);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.lsp-chart__tick-label {
  fill: #475569;
  font-size: 12px;
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
