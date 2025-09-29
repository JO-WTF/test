<template>
  <a-modal
    :open="isVisible"
    title="LSP 统计"
    :footer="null"
    :destroy-on-close="false"
    :mask-closable="true"
    width="90%"
    wrap-class-name="lsp-summary-modal__dialog"
    @cancel="handleClose"
    @update:open="updateVisibility"
  >
    <div class="lsp-summary-modal">
      <div v-if="isLoading" class="lsp-summary-modal__state">正在加载统计数据…</div>
      <div v-else-if="error" class="lsp-summary-modal__state lsp-summary-modal__state--error">
        {{ error }}
      </div>
      <div v-else-if="!chartData.length" class="lsp-summary-modal__state">暂无统计数据</div>
      <div v-else class="lsp-summary-modal__chart">
        <div class="lsp-summary-chart__container">
          <div
            ref="chartContainer"
            class="lsp-summary-chart"
            role="img"
            aria-label="LSP 状态占比随时间变化折线图"
          ></div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Line } from '@ant-design/plots/es/core/plots/line';
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

const chartContainer = ref(null);
const chartInstance = ref(null);

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
      return {
        id: item.id,
        lsp: item.lsp || '未命名 LSP',
        totalDn,
        statusNotEmpty,
        recordedAt,
        timeKey: recordedAt.format('YYYY-MM-DD HH:mm'),
        recordedAtLabel: recordedAt.format('DD MMM HH:mm'),
        recordedAtTooltip: recordedAt.format('YYYY-MM-DD HH:mm'),
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

const chartData = computed(() =>
  processedSummary.value.map((item) => ({
    id: item.id,
    lsp: item.lsp,
    percentage: Number.isFinite(item.percentage) ? item.percentage : 0,
    recordedAt: item.recordedAt.toDate(),
    recordedAtLabel: item.recordedAtLabel,
    recordedAtTooltip: item.recordedAtTooltip,
    statusNotEmpty: item.statusNotEmpty,
    totalDn: item.totalDn,
  }))
);

const buildChartConfig = (data) => ({
  data,
  xField: 'recordedAt',
  yField: 'percentage',
  seriesField: 'lsp',
  colorField: 'lsp',
  color: ({ lsp }) => colorForLsp(lsp),
  scale: {
    x: { type: 'time' },
    y: { domain: [0, 100] },
  },
  axis: {
    x: {
      labelFormatter: (value) => dayjs(value).tz('Asia/Jakarta').format('DD MMM HH:mm'),
    },
    y: {
      labelFormatter: (value) => `${value}%`,
    },
  },
  legend: {
    color: {
      position: 'top',
      title: false,
    },
  },
  tooltip: {
    title: (datum) => datum.recordedAtTooltip,
    items: [
      {
        channel: 'y',
        name: '占比',
        valueFormatter: (value) => `${Number(value).toFixed(2)}%`,
      },
      {
        name: 'Status Not Empty',
        value: (datum) => `${datum.statusNotEmpty}`,
      },
      {
        name: 'Total DN',
        value: (datum) => `${datum.totalDn}`,
      },
    ],
  },
  line: {
    style: {
      lineWidth: 2,
    },
  },
  point: {
    shapeField: 'circle',
    sizeField: 4,
  },
  animate: false,
});

const destroyChart = () => {
  if (chartInstance.value) {
    chartInstance.value.destroy();
    chartInstance.value = null;
  }
};

const createChart = (data) => {
  if (!chartContainer.value || chartInstance.value || !data.length) {
    if (!data.length) {
      destroyChart();
    }
    return;
  }

  chartInstance.value = new Line(chartContainer.value, buildChartConfig(data));
  chartInstance.value.render();
};

const updateChartData = (data) => {
  if (!chartInstance.value) {
    createChart(data);
    return;
  }
  chartInstance.value.changeData(data);
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      if (!hasFetched.value) {
        fetchLspSummary();
      }
      nextTick(() => {
        if (chartData.value.length) {
          createChart(chartData.value);
        }
      });
    } else {
      destroyChart();
    }
  }
);

watch(
  chartData,
  (data) => {
    if (!props.open) {
      return;
    }

    if (!data.length) {
      destroyChart();
      return;
    }

    nextTick(() => {
      updateChartData(data);
    });
  }
);

watch(
  () => chartContainer.value,
  (el) => {
    if (el && props.open && chartData.value.length) {
      nextTick(() => {
        createChart(chartData.value);
      });
    }
  }
);

onBeforeUnmount(() => {
  destroyChart();
});

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
}

.lsp-summary-chart__container {
  width: 100%;
  overflow-x: auto;
}

.lsp-summary-chart {
  width: 100%;
  min-height: 360px;
}

:deep(.lsp-summary-modal__dialog .ant-modal) {
  width: 90% !important;
  max-width: none;
}

:deep(.lsp-summary-modal__dialog .ant-modal-content) {
  height: 90vh;
  display: flex;
  flex-direction: column;
}

:deep(.lsp-summary-modal__dialog .ant-modal-body) {
  flex: 1;
  overflow: auto;
}
</style>
