<!-- DemoLine.vue -->
<template>
  <div class="p-3">
    <!-- 指标切换（按钮样式、充满一行） -->
    <div style="margin-bottom: 8px;">
      <a-radio-group
        v-model:value="metric"
        button-style="solid"
        style="width: 100%; display: flex; gap: 8px; flex-wrap: wrap;"
      >
        <a-radio-button :value="'status_not_empty'" style="flex: 1 1 200px; text-align: center;">
          status_not_empty
        </a-radio-button>
        <a-radio-button :value="'total_dn'" style="flex: 1 1 200px; text-align: center;">
          total_dn
        </a-radio-button>
        <a-radio-button :value="'rate'" style="flex: 1 1 200px; text-align: center;">
          更新率（status_not_empty / total_dn）
        </a-radio-button>
      </a-radio-group>
    </div>

    <div ref="containerRef" style="height: 420px;"></div>
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
  }
  return [min, max];
});

/** 统一的时间格式化 */
const fmtTime = (t) =>
  new Date(t).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

/** 初始化图表 */
onMounted(async () => {
  await fetchData();

  chartRef.value = new Line(containerRef.value, {
    data: data.value,
    xField: 'time',
    yField: 'value',
    seriesField: 'category',

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
.p-3 {
  padding: 12px;
}
</style>
