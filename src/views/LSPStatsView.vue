<template>
  <div class="stats-view">
    <div class="stats-container">
      <div class="stats-header">
        <div class="header-content">
          <h1 class="stats-title">LSP 统计分析</h1>
          <p class="stats-subtitle">Last Mile Delivery Performance Overview</p>
        </div>
        <div class="metric-toggle">
          <a-radio-group v-model:value="metric" button-style="solid">
            <a-radio-button value="rate">完成率</a-radio-button>
            <a-radio-button value="status_not_empty">更新数</a-radio-button>
            <a-radio-button value="total_dn">总数</a-radio-button>
          </a-radio-group>
        </div>
      </div>
      <div class="chart-wrapper">
        <div ref="chartContainer" class="chart-container"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { getApiBase } from '../utils/env';

const chartContainer = ref(null);
let chartInstance = null;
let echarts = null;
let isEChartsLoaded = false;

// 数据源
const raw = ref([]);
const metric = ref('rate'); // 'rate' | 'status_not_empty' | 'total_dn'

const apiBase = getApiBase();
const buildRequestUrl = () => {
  if (apiBase) {
    return new URL('/api/dn/status-delivery/lsp-summary-records', apiBase).toString();
  }
  return '/api/dn/status-delivery/lsp-summary-records';
};

const TZ_PATTERN = /([zZ])|([+-]\d{2}:?\d{2})$/;

const normalizeToJakartaDate = (value) => {
  if (!value && value !== 0) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const replaced = trimmed.replace(' ', 'T');
    const hasTime = replaced.includes('T');
    const hasTimezone = TZ_PATTERN.test(replaced);
    let candidate = replaced;

    if (!hasTimezone) {
      candidate = `${hasTime ? replaced : `${replaced}T00:00:00`}+07:00`;
    }

    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
};

const getTimeValue = (input) => {
  const parsed = normalizeToJakartaDate(input);
  return parsed ? parsed.getTime() : NaN;
};

const fetchData = async () => {
  try {
    const res = await fetch(buildRequestUrl());
    const json = await res.json();
    const arr = (json?.data.by_plan_mos_date ?? [])
      .map((item) => ({
        time: getTimeValue(item.recorded_at),
        lsp: item.lsp,
        status_not_empty: Number(item.status_not_empty ?? 0),
        total_dn: Number(item.total_dn ?? 0),
      }))
      .filter((item) => Number.isFinite(item.time))
      .sort((a, b) => a.time - b.time);
    raw.value = arr;
  } catch (error) {
    console.error('Failed to fetch data:', error);
  }
};

// 计算属性：根据指标处理数据
const processedData = computed(() => {
  return raw.value.map((d) => {
    const total = d.total_dn || 0;
    const filled = d.status_not_empty || 0;
    const val =
      metric.value === 'total_dn'
        ? total
        : metric.value === 'status_not_empty'
        ? filled
        : total > 0
        ? filled / total
        : 0; // rate
    return { time: d.time, value: val, lsp: d.lsp };
  });
});

// 计算属性：图表配置标题和格式化
const chartTitle = computed(() => {
  return metric.value === 'total_dn' ? 'LSP 总数统计' 
    : metric.value === 'status_not_empty' ? 'LSP 更新数统计' 
    : 'LSP 完成率统计';
});

const isRate = computed(() => metric.value === 'rate');

const valueFormatter = computed(() => {
  return isRate.value ? '{value}%' : '{value}';
});

// 时间格式化
const TIME_ZONE = 'Asia/Jakarta';
const fmtTime = (input) => {
  let millis;
  if (input instanceof Date) {
    millis = input.getTime();
  } else if (typeof input === 'number') {
    millis = input;
  } else if (typeof input === 'string') {
    const numeric = Number(input);
    millis = Number.isNaN(numeric) ? Date.parse(input) : numeric;
  } else {
    millis = NaN;
  }

  if (!Number.isFinite(millis)) {
    return '';
  }

  return new Date(millis).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIME_ZONE,
  });
};

// 准备图表数据
const prepareChartData = () => {
  const lspMap = new Map();
  processedData.value.forEach((d) => {
    if (!lspMap.has(d.lsp)) {
      lspMap.set(d.lsp, []);
    }
    lspMap.get(d.lsp).push(d);
  });

  const timePoints = [...new Set(processedData.value.map((d) => d.time))].sort((a, b) => a - b);
  const xAxisData = timePoints.map((t) => fmtTime(t));

  const series = [];
  lspMap.forEach((items, lsp) => {
    const seriesData = timePoints.map((time) => {
      const item = items.find((d) => d.time === time);
      if (!item) return null;
      return isRate.value ? (item.value * 100).toFixed(2) : item.value;
    });

    series.push({
      name: lsp,
      type: 'line',
      data: seriesData
    });
  });

  return { xAxisData, series };
};

// 更新图表
const updateChart = () => {
  if (!chartInstance || !echarts) return;

  const { xAxisData, series } = prepareChartData();

  const option = {
    title: {
      text: chartTitle.value
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        let result = `${params[0].axisValue}<br/>`;
        params.forEach((param) => {
          const value = param.value;
          const formattedValue = value !== null && value !== undefined
            ? (isRate.value ? `${value}%` : value)
            : '-';
          result += `${param.marker}${param.seriesName}: ${formattedValue}<br/>`;
        });
        return result;
      }
    },
    legend: {},
    toolbox: {
      show: true,
      feature: {
        dataZoom: {
          yAxisIndex: 'none'
        },
        dataView: { readOnly: false },
        magicType: { type: ['line', 'bar'] },
        restore: {},
        saveAsImage: {}
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: valueFormatter.value
      }
    },
    series: series
  };

  chartInstance.setOption(option, true);
};

onMounted(async () => {
  await fetchData();

  // 动态导入 ECharts (只在客户端)
  if (typeof window !== 'undefined') {
    try {
      const echartsModule = await import('echarts');
      echarts = echartsModule.default || echartsModule;
      isEChartsLoaded = true;

      if (!echarts || typeof echarts.init !== 'function') {
        throw new Error('ECharts init function not available');
      }

      chartInstance = echarts.init(chartContainer.value);
      updateChart();

      // 窗口大小改变时自动调整图表
      window.addEventListener('resize', () => {
        chartInstance?.resize();
      });
    } catch (error) {
      console.error('Failed to load ECharts:', error);
    }
  }
});

// 监听指标变化，更新图表
watch(metric, () => {
  if (isEChartsLoaded) {
    updateChart();
  }
});

// 监听数据变化
watch(raw, () => {
  if (chartInstance && raw.value.length > 0 && isEChartsLoaded) {
    console.log('Data loaded:', raw.value);
    updateChart();
  }
});
</script>

<style scoped>
.stats-view {
  min-height: 100vh;
  padding: clamp(20px, 4vw, 48px);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-attachment: fixed;
}

.stats-container {
  max-width: 1400px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  overflow: hidden;
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stats-header {
  padding: clamp(24px, 4vw, 40px);
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-bottom: 2px solid rgba(102, 126, 234, 0.15);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.header-content {
  flex: 1;
  min-width: 250px;
}

.stats-title {
  margin: 0 0 8px 0;
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}

.stats-subtitle {
  margin: 0;
  font-size: clamp(0.875rem, 1.5vw, 1rem);
  color: #64748b;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-toggle {
  display: flex;
  align-items: center;
}

.metric-toggle :deep(.ant-radio-group-solid) {
  display: flex;
  gap: 8px;
  background: rgba(241, 245, 249, 0.8);
  padding: 6px;
  border-radius: 12px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);
}

.metric-toggle :deep(.ant-radio-button-wrapper) {
  min-width: 90px;
  text-align: center;
  border: none;
  background: transparent;
  color: #64748b;
  font-weight: 600;
  font-size: 0.875rem;
  border-radius: 8px !important;
  padding: 8px 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1.5;
}

.metric-toggle :deep(.ant-radio-button-wrapper:not(:first-child)) {
  margin-left: 0;
}

.metric-toggle :deep(.ant-radio-button-wrapper:hover) {
  color: #667eea;
  background: rgba(102, 126, 234, 0.08);
}

.metric-toggle :deep(.ant-radio-button-wrapper-checked) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: #ffffff !important;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1) !important;
  transform: translateY(-1px);
}

.metric-toggle :deep(.ant-radio-button-wrapper-checked:hover) {
  color: #ffffff !important;
}

.chart-wrapper {
  padding: clamp(24px, 4vw, 40px);
  background: #ffffff;
}

.chart-container {
  width: 100%;
  height: clamp(450px, 60vh, 650px);
  border-radius: 16px;
  background: linear-gradient(to bottom, #fafafa 0%, #ffffff 100%);
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.3s ease;
}

.chart-container:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

@media (max-width: 768px) {
  .stats-view {
    padding: 16px;
  }

  .stats-header {
    padding: 20px;
    flex-direction: column;
    align-items: flex-start;
  }

  .header-content {
    width: 100%;
  }

  .metric-toggle {
    width: 100%;
  }

  .metric-toggle :deep(.ant-radio-group-solid) {
    width: 100%;
    flex-direction: column;
  }

  .metric-toggle :deep(.ant-radio-button-wrapper) {
    width: 100%;
  }

  .chart-wrapper {
    padding: 20px;
  }

  .chart-container {
    height: 400px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stats-container {
    animation: none;
  }

  .metric-toggle :deep(.ant-radio-button-wrapper) {
    transition: none;
  }
}
</style>
