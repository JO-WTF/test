<!-- DemoLine.vue -->
<template>
  <div class="stats-view">
    <section class="stats-card">
      <header class="stats-header">
        <div>
          <p class="eyebrow">LSP performance overview</p>
          <h1 class="stats-title">Last mile delivery statistics</h1>
        </div>
        <p class="stats-meta">All timestamps in Asia/Jakarta (UTC+7)</p>
      </header>

      <div class="chart-shell">
        <div class="metric-toggle">
          <a-radio-group v-model:value="metric" button-style="solid">
            <a-radio-button :value="'status_not_empty'">status_not_empty</a-radio-button>
            <a-radio-button :value="'total_dn'">total_dn</a-radio-button>
            <a-radio-button :value="'rate'">更新率（status_not_empty / total_dn）</a-radio-button>
          </a-radio-group>
        </div>
        <div ref="containerRef" class="chart"></div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { Line } from '@antv/g2plot';
import { getApiBase } from '../utils/env';
// Ant Design Vue（确保在你的入口里已完成 app.use(Antd) 并引入样式）
/* import 'ant-design-vue/dist/antd.css' // 如果你还没全局引入样式，可在入口加上 */

const containerRef = ref(null);
const chartRef = ref(null);

const raw = ref([]);
const metric = ref('status_not_empty'); // 'status_not_empty' | 'total_dn' | 'rate'

const apiBase = getApiBase();
const buildRequestUrl = () => {
  if (apiBase) {
    return new URL('/api/dn/status-delivery/lsp-summary-records', apiBase).toString();
  }
  return '/api/dn/status-delivery/lsp-summary-records';
};

/** 拉取数据 */
const fetchData = async () => {
  const res = await fetch(buildRequestUrl());
  const json = await res.json();
  const arr = (json?.data ?? [])
    .map((item) => ({
      time: new Date(item.recorded_at),
      lsp: item.lsp,
      status_not_empty: Number(item.status_not_empty ?? 0),
      total_dn: Number(item.total_dn ?? 0),
    }))
    .sort((a, b) => a.time - b.time);
  raw.value = arr;
};

/** 根据当前指标生成绘图数据 */
const data = computed(() => {
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
    return { time: d.time, value: val, category: d.lsp };
  });
});

const isRate = computed(() => metric.value === 'rate');
const yTitle = computed(() =>
  metric.value === 'total_dn' ? 'total_dn' : metric.value === 'status_not_empty' ? 'status_not_empty' : '更新率',
);
const valueFormatter = (v) => (isRate.value ? `${(v * 100).toFixed(1)}%` : String(v));

/** y 轴范围（自动适配） */
const yDomain = computed(() => {
  const vals = data.value.map((d) => d.value).filter((v) => Number.isFinite(v));
  if (!vals.length) return undefined;
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  } else {
    const padMax = Math.abs(max) * 0.1 || 1;
    max += padMax;
  }
  return [min, max];
});

const TIME_ZONE = 'Asia/Jakarta';

/** 统一的时间格式化 */
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

/** 初始化图表 */
onMounted(async () => {
  await fetchData();

  chartRef.value = new Line(containerRef.value, {
    data: data.value,
    xField: 'time',
    yField: 'value',
    seriesField: 'category',
    autoFit: true,

    // 散点样式
    point: {
      size: 4,
      shape: 'circle',
      style: { lineWidth: 1, opacity: 0.9 },
    },

    xAxis: {
      type: 'time',
      title: { text: '时间' },
      label: {
        formatter: (v) => fmtTime(v),
      },
    },
    yAxis: {
      title: { text: yTitle.value },
      label: {
        formatter: (v) => (isRate.value ? `${(Number(v) * 100).toFixed(0)}%` : `${v}`),
      },
      // 动态范围
      min: yDomain.value?.[0],
      max: yDomain.value?.[1],
      nice: true,
    },

    legend: {
      // 不显示尺寸图例
      position: 'top',
    },

    tooltip: {
      // 自定义提示：将 y 值格式化
      formatter: (datum) => ({
        name: yTitle.value,
        value: valueFormatter(datum.value),
      }),
      title: (title, datum) => fmtTime(datum?.time ?? title),
    },
  });

  chartRef.value.render();
});

/** 数据或配置变化时更新图表 */
watch([data, isRate, yTitle, yDomain], () => {
  if (!chartRef.value) return;
  chartRef.value.update({
    data: data.value,
    yAxis: {
      title: { text: yTitle.value },
      label: {
        formatter: (v) => (isRate.value ? `${(Number(v) * 100).toFixed(0)}%` : `${v}`),
      },
      min: yDomain.value?.[0],
      max: yDomain.value?.[1],
      nice: true,
    },
    tooltip: {
      formatter: (datum) => ({
        name: yTitle.value,
        value: valueFormatter(datum.value),
      }),
    },
  });
});
</script>

<style scoped>
.stats-view {
  min-height: 100vh;
  padding: clamp(16px, 4vw, 48px);
  background: radial-gradient(circle at top, rgba(30, 64, 175, 0.25), transparent 55%),
    linear-gradient(180deg, #0f172a 0%, #111827 40%, #0f172a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f8fafc;
}

.stats-card {
  width: min(1200px, 100%);
  background: rgba(15, 23, 42, 0.72);
  border-radius: 20px;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.4);
  padding: clamp(20px, 3vw, 32px);
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2vw, 28px);
}

.stats-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px clamp(12px, 2vw, 48px);
  justify-content: space-between;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.32em;
  font-size: 0.68rem;
  font-weight: 600;
  color: rgba(148, 163, 184, 0.8);
  margin-bottom: 6px;
}

.stats-title {
  font-size: clamp(1.5rem, 4vw, 2.4rem);
  line-height: 1.1;
  margin: 0;
}

.stats-meta {
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.72);
  margin: 0;
  max-width: 220px;
  text-align: right;
}

.chart-shell {
  position: relative;
  min-height: clamp(420px, 55vh, 560px);
  border-radius: 16px;
  background: radial-gradient(circle at top left, rgba(79, 70, 229, 0.28), transparent 55%),
    rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.22);
  padding: clamp(20px, 3vw, 32px);
  overflow: hidden;
}

.metric-toggle {
  position: absolute;
  top: clamp(16px, 3vw, 24px);
  right: clamp(16px, 3vw, 24px);
  display: flex;
  justify-content: flex-end;
  width: min(420px, 100%);
  z-index: 2;
}

.chart {
  height: 100%;
}

.chart :deep(canvas) {
  border-radius: 12px;
}

.metric-toggle :deep(.ant-radio-group-solid) {
  display: flex;
  gap: 12px;
  width: 100%;
}

.metric-toggle :deep(.ant-radio-button-wrapper) {
  flex: 1;
  text-align: center;
  border-radius: 999px !important;
  border: none;
  background: rgba(30, 41, 59, 0.85);
  color: rgba(226, 232, 240, 0.9);
  padding: 6px 12px;
  transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.15);
}

.metric-toggle :deep(.ant-radio-button-wrapper:not(:first-child)) {
  margin-left: 0;
}

.metric-toggle :deep(.ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled)) {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(99, 102, 241, 0.95));
  color: #0f172a;
  box-shadow: 0 12px 30px rgba(59, 130, 246, 0.35);
  transform: translateY(-2px);
}

.metric-toggle :deep(.ant-radio-button-wrapper:hover) {
  transform: translateY(-1px);
  color: #e0f2fe;
}

@media (max-width: 768px) {
  .stats-view {
    padding: 16px;
  }

  .stats-meta {
    text-align: left;
    max-width: none;
  }

  .metric-toggle {
    position: static;
    margin-bottom: 16px;
    width: 100%;
  }

  .chart-shell {
    padding-top: clamp(24px, 8vw, 40px);
  }

  .metric-toggle :deep(.ant-radio-group-solid) {
    flex-direction: column;
  }
}
</style>
