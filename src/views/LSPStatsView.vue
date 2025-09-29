<template>
  <div class="admin-page lsp-stats-view">
    <div class="container admin-container">
      <header class="page-header lsp-stats-view__header">
        <div class="lsp-stats-view__title-group">
          <h1 class="lsp-stats-view__title">LSP 统计</h1>
          <p class="lsp-stats-view__subtitle">基于配送状态的 DN 更新概览</p>
        </div>
        <div class="lsp-stats-view__actions">
          <router-link to="/admin" class="btn ghost">返回管理页</router-link>
        </div>
      </header>

      <section class="card lsp-stats-view__card">
        <div v-if="isLoading" class="lsp-stats-view__state">正在加载统计数据…</div>
        <div v-else-if="error" class="lsp-stats-view__state lsp-stats-view__state--error">{{ error }}</div>
        <div v-else-if="!chartData.length" class="lsp-stats-view__state">暂无统计数据</div>
        <div v-else class="lsp-stats-view__content">
          <div class="lsp-stats-view__controls">
            <a-radio-group v-model:value="selectedMetric" button-style="solid">
              <a-radio-button value="updateRate">更新率</a-radio-button>
              <a-radio-button value="statusNotEmpty">更新记录数</a-radio-button>
              <a-radio-button value="totalDn">总记录数</a-radio-button>
            </a-radio-group>
          </div>
          <div ref="chartContainer" class="lsp-stats-view__chart" aria-label="LSP 统计折线图"></div>
          <footer class="lsp-stats-view__footer">数据来源：/api/dn/status-delivery/lsp-summary-records</footer>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { Line as LinePlot } from '@ant-design/plots/es/core/plots/line';
import { getApiBase } from '../utils/env';
import { useBodyTheme } from '../composables/useBodyTheme';

useBodyTheme('admin-theme');

const chartContainer = ref(null);
const chartInstance = ref(null);
const isLoading = ref(false);
const error = ref('');
const rawRecords = ref([]);
const selectedMetric = ref('updateRate');
const numberFormatter = new Intl.NumberFormat('en-US');

const metrics = {
  updateRate: {
    key: 'updateRate',
    label: '更新率',
    axisTitle: '更新率（%）',
    valueAccessor: (record) => {
      const percent = record.totalDn > 0 ? (record.statusNotEmpty / record.totalDn) * 100 : 0;
      return Number.isFinite(percent) ? Number(percent.toFixed(2)) : 0;
    },
    valueFormatter: (value) => `${value.toFixed(2)}%`,
  },
  statusNotEmpty: {
    key: 'statusNotEmpty',
    label: '更新记录数',
    axisTitle: '更新记录数',
    valueAccessor: (record) => record.statusNotEmpty,
    valueFormatter: (value) => numberFormatter.format(value),
  },
  totalDn: {
    key: 'totalDn',
    label: '总记录数',
    axisTitle: '总记录数',
    valueAccessor: (record) => record.totalDn,
    valueFormatter: (value) => numberFormatter.format(value),
  },
};

const metricConfig = computed(() => metrics[selectedMetric.value] ?? metrics.updateRate);

const normalizedRecords = computed(() => {
  return rawRecords.value
    .map((item) => {
      const lspName = String(item?.lsp ?? '').trim() || '未命名 LSP';
      const totalDn = Number.parseFloat(item?.total_dn ?? 0);
      const statusNotEmpty = Number.parseFloat(item?.status_not_empty ?? 0);
      const recordedAt = dayjs(item?.recorded_at);
      const recordedAtDate = recordedAt.isValid()
        ? recordedAt.toDate()
        : new Date(item?.recorded_at || Date.now());
      const timestamp = recordedAt.isValid()
        ? recordedAt.valueOf()
        : recordedAtDate.getTime();
      const recordedAtLabel = recordedAt.isValid()
        ? recordedAt.format('YYYY-MM-DD HH:mm')
        : String(item?.recorded_at ?? '未知时间');

      return {
        id: item?.id ?? `${lspName}-${timestamp}`,
        lsp: lspName,
        totalDn: Number.isFinite(totalDn) ? totalDn : 0,
        statusNotEmpty: Number.isFinite(statusNotEmpty) ? statusNotEmpty : 0,
        recordedAt: recordedAtDate,
        recordedAtLabel,
        recordedAtTimestamp: timestamp,
      };
    })
    .sort((a, b) => a.recordedAtTimestamp - b.recordedAtTimestamp);
});

const chartData = computed(() => {
  const metric = metricConfig.value;
  return normalizedRecords.value.map((record) => ({
    lsp: record.lsp,
    recordedAt: record.recordedAt,
    recordedAtLabel: record.recordedAtLabel,
    value: metric.valueAccessor(record),
  }));
});

const buildRequestUrl = () => {
  const apiBase = getApiBase();
  if (apiBase) {
    try {
      const url = new URL('/api/dn/status-delivery/lsp-summary-records', apiBase);
      return url.toString();
    } catch (err) {
      console.error(err);
    }
  }
  return '/api/dn/status-delivery/lsp-summary-records';
};

const fetchLspStats = async () => {
  isLoading.value = true;
  error.value = '';
  try {
    const response = await fetch(buildRequestUrl(), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`获取统计数据失败（${response.status}）`);
    }

    const payload = await response.json();
    if (!payload?.ok || !Array.isArray(payload?.data)) {
      throw new Error('接口返回数据格式不符合预期');
    }

    rawRecords.value = payload.data;
  } catch (err) {
    console.error(err);
    error.value = err?.message || '无法获取 LSP 统计数据';
    rawRecords.value = [];
  } finally {
    isLoading.value = false;
  }
};

const renderChart = async () => {
  if (!chartContainer.value) return;

  await nextTick();

  if (!chartData.value.length) {
    if (chartInstance.value) {
      chartInstance.value.destroy();
      chartInstance.value = null;
    }
    return;
  }

  const metric = metricConfig.value;
  const options = {
    data: chartData.value,
    xField: 'recordedAt',
    yField: 'value',
    seriesField: 'lsp',
    colorField: 'lsp',
    connectNulls: true,
    shape: 'smooth',
    axis: {
      x: {
        title: '记录时间',
        labelFormatter: (value) => dayjs(value).format('HH:mm'),
      },
      y: {
        title: metric.axisTitle,
        labelFormatter: (value) => metric.valueFormatter(Number(value)),
      },
    },
    legend: {
      color: {
        position: 'top',
        title: 'LSP',
      },
    },
    tooltip: {
      title: 'recordedAtLabel',
      items: [
        {
          channel: 'y',
          name: metric.label,
          valueFormatter: (value) => metric.valueFormatter(Number(value)),
        },
      ],
    },
    meta: {
      recordedAt: {
        type: 'time',
      },
      value: {
        formatter: (value) => metric.valueFormatter(Number(value)),
      },
    },
  };

  if (chartInstance.value) {
    chartInstance.value.update(options);
  } else {
    chartInstance.value = new LinePlot(chartContainer.value, options);
  }

  chartInstance.value.render();
};

onMounted(async () => {
  await fetchLspStats();
  await renderChart();
});

watch(chartData, () => {
  renderChart();
});

watch(metricConfig, () => {
  renderChart();
});

onBeforeUnmount(() => {
  chartInstance.value?.destroy();
  chartInstance.value = null;
});
</script>

<style scoped>
.lsp-stats-view {
  min-height: 100vh;
  padding: 16px 0 48px;
  color: #eaf2ff;
}

.lsp-stats-view__header {
  align-items: flex-start;
  margin-bottom: 16px;
}

.lsp-stats-view__title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #f5f9ff;
}

.lsp-stats-view__subtitle {
  margin: 4px 0 0;
  color: #9cc6ff;
  font-size: 14px;
}

.lsp-stats-view__actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.lsp-stats-view__card {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lsp-stats-view__state {
  text-align: center;
  padding: 80px 16px;
  color: #c7d9ff;
}

.lsp-stats-view__state--error {
  color: #ff9aa6;
}

.lsp-stats-view__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lsp-stats-view__controls {
  display: flex;
  justify-content: flex-end;
}

.lsp-stats-view__chart {
  width: 100%;
  min-height: 360px;
}

.lsp-stats-view__footer {
  font-size: 12px;
  color: #5f7ba8;
  text-align: right;
}

:deep(.ant-radio-group-solid .ant-radio-button-wrapper) {
  background: #162348;
  border-color: #24345c;
  color: #cfe2ff;
}

:deep(.ant-radio-group-solid .ant-radio-button-wrapper:not(.ant-radio-button-wrapper-checked):hover) {
  color: #f5f9ff;
}

:deep(.ant-radio-group-solid .ant-radio-button-wrapper-checked) {
  background: #69a8ff;
  border-color: #69a8ff;
  color: #08142c;
}
</style>
