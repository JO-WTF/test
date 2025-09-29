<template>
  <a-modal
    :open="isVisible"
    title="LSP 统计"
    :footer="null"
    :destroy-on-close="false"
    :mask-closable="true"
    width="840px"
    @cancel="handleClose"
    @update:open="updateVisibility"
  >
    <div class="lsp-summary-modal">
      <div v-if="isLoading" class="lsp-summary-modal__state">正在加载统计数据…</div>
      <div v-else-if="error" class="lsp-summary-modal__state lsp-summary-modal__state--error">
        {{ error }}
      </div>
      <div v-else-if="!lspSeries.length" class="lsp-summary-modal__state">暂无统计数据</div>
      <div v-else class="lsp-summary-modal__chart">
        <div class="lsp-summary-legend" role="list">
          <div
            v-for="legend in lspLegendItems"
            :key="legend.lsp"
            class="lsp-summary-legend__item"
            role="listitem"
          >
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
              <path
                :d="series.path"
                fill="none"
                :stroke="series.color"
                stroke-width="2"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
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
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getApiBase } from '../utils/env';

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:open']);

const isVisible = computed({
  get: () => props.open,
  set: (value) => {
    emit('update:open', value);
  },
});

const isLoading = ref(false);
const error = ref('');
const lspSummaryItems = ref([]);
const hasFetched = ref(false);

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

const apiBase = getApiBase();

const buildLspSummaryUrl = () => {
  if (apiBase) {
    return new URL('/api/dn/status-delivery/lsp-summary-records', apiBase).toString();
  }
  return '/api/dn/status-delivery/lsp-summary-records';
};

dayjs.extend(utc);
dayjs.extend(timezone);

const processedSummary = computed(() => {
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
  processedSummary.value.forEach((item) => {
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
  processedSummary.value.forEach((item) => {
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
  processedSummary.value.forEach((item) => {
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

  const series = lspSeries.value
    .map(({ lsp, items }) => {
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
    })
    .filter((seriesItem) => seriesItem.points.length);

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

const fetchLspSummary = async () => {
  try {
    isLoading.value = true;
    error.value = '';
    const response = await fetch(buildLspSummaryUrl());
    if (!response.ok) {
      throw new Error(`统计数据获取失败（${response.status}）`);
    }
    const payload = await response.json();
    if (!payload?.ok) {
      throw new Error('统计数据返回异常');
    }
    lspSummaryItems.value = Array.isArray(payload.data) ? payload.data : [];
    hasFetched.value = true;
  } catch (err) {
    console.error(err);
    error.value = err?.message || '统计数据获取失败';
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => props.open,
  (open) => {
    if (open && !hasFetched.value) {
      fetchLspSummary();
    }
  },
  { immediate: false }
);

const handleClose = () => {
  isVisible.value = false;
};

const updateVisibility = (value) => {
  isVisible.value = value;
};
</script>

<style scoped>
.lsp-summary-modal {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.lsp-summary-modal__state {
  padding: 64px 24px;
  text-align: center;
  color: #475569;
}

.lsp-summary-modal__state--error {
  color: #dc2626;
}

.lsp-summary-modal__chart {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.lsp-summary-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
}

.lsp-summary-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #1e293b;
}

.lsp-summary-legend__swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.lsp-summary-chart__container {
  overflow-x: auto;
}

.lsp-summary-chart {
  width: 100%;
  min-width: 720px;
  height: auto;
}

.lsp-chart__axis {
  stroke: #94a3b8;
  stroke-width: 1;
}

.lsp-chart__grid {
  stroke: #e2e8f0;
  stroke-width: 1;
}

.lsp-chart__tick-label {
  font-size: 12px;
  fill: #475569;
}
</style>
