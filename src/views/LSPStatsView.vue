<template>
  <div class="stats-view">
    <div class="stats-container">
      <div class="stats-header">
        <div class="header-content">
          <div class="mode-toggle">
            <RadioGroup v-model:value="dateMode" button-style="solid">
              <RadioButton value="plan">按上站日期</RadioButton>
              <RadioButton value="update">按更新日期</RadioButton>
              <RadioButton value="driver">按司机</RadioButton>
            </RadioGroup>
          </div>
          <h1 class="stats-title">LSP 统计分析</h1>
          <p class="stats-subtitle">Last Mile Delivery Performance Overview</p>
        </div>
        <div class="metric-toggle" v-if="isPlanMode">
          <RadioGroup v-model:value="metric" button-style="solid">
            <RadioButton value="rate">完成率</RadioButton>
            <RadioButton value="status_not_empty">更新数</RadioButton>
            <RadioButton value="total_dn">总数</RadioButton>
          </RadioGroup>
        </div>
      </div>
      <div class="chart-wrapper" v-if="dateMode !== 'driver'">
        <div ref="chartContainer" class="chart-container"></div>
      </div>
      <div class="table-wrapper" v-else>
        <div class="table-header">
          <h2 class="table-title">司机统计数据</h2>
          <div class="table-summary">
            共 <span class="highlight">{{ totalDrivers }}</span> 位司机
          </div>
        </div>
        <Table
          :columns="driverColumns"
          :data-source="driverData"
          :loading="loadingDriverData"
          :pagination="{ pageSize: 20, showTotal: (total) => `共 ${total} 条` }"
          :scroll="{ x: 600 }"
          bordered
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'index'">
              {{ index + 1 }}
            </template>
            <template v-if="column.key === 'phone_number'">
              <span class="phone-number">{{ record.phone_number }}</span>
            </template>
            <template v-if="column.key === 'unique_dn_count'">
              <span class="count-badge primary">{{ record.unique_dn_count }}</span>
            </template>
            <template v-if="column.key === 'record_count'">
              <span class="count-badge secondary">{{ record.record_count }}</span>
            </template>
            <template v-if="column.key === 'avg_updates'">
              <span class="avg-value">{{ record.avg_updates }}</span>
            </template>
          </template>
        </Table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import { Table, RadioGroup, RadioButton } from 'ant-design-vue';
import { getApiBase } from '../utils/env';

const chartContainer = ref(null);
let chartInstance = null;
let echarts = null;
let isEChartsLoaded = false;

// 数据源
const raw = ref([]);
const rawUpdate = ref([]);
const driverData = ref([]);
const totalDrivers = ref(0);
const loadingDriverData = ref(false);
const metric = ref('rate'); // 'rate' | 'status_not_empty' | 'total_dn'
const dateMode = ref('plan'); // 'plan' | 'update' | 'driver'

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
    const LSP_PATTERN = /^HTM\.[A-Za-z0-9]+-IDN$/;

    const arr = (json?.data.by_plan_mos_date ?? [])
      .map((item) => ({
        time: getTimeValue(item.recorded_at),
        lsp: item.lsp,
        status_not_empty: Number(item.status_not_empty ?? 0),
        total_dn: Number(item.total_dn ?? 0),
      }))
      .filter((item) => Number.isFinite(item.time) && LSP_PATTERN.test(String(item.lsp)))
      .sort((a, b) => a.time - b.time);
    raw.value = arr;

    const updateArr = (json?.data.by_update_date ?? [])
      .map((item) => ({
        time: getTimeValue(item.recorded_at),
        lsp: item.lsp,
        updated_dn: Number(item.updated_dn ?? 0),
      }))
      .filter((item) => Number.isFinite(item.time) && LSP_PATTERN.test(String(item.lsp)))
      .sort((a, b) => a.time - b.time);
    rawUpdate.value = updateArr;
  } catch (error) {
    console.error('Failed to fetch data:', error);
  }
};

const fetchDriverData = async () => {
  loadingDriverData.value = true;
  try {
    const url = apiBase 
      ? new URL('/api/dn/status_delivery/by-driver', apiBase).toString()
      : '/api/dn/status_delivery/by-driver';
    const res = await fetch(url);
    const json = await res.json();
    
    if (json.ok && json.data) {
      const processedData = json.data.map((item) => ({
        phone_number: item.phone_number || '-',
        unique_dn_count: Number(item.unique_dn_count || 0),
        record_count: Number(item.record_count || 0),
        avg_updates: item.unique_dn_count > 0 
          ? (item.record_count / item.unique_dn_count).toFixed(2)
          : '0.00'
      }));
      
      // 按 unique_dn_count 降序排序
      processedData.sort((a, b) => b.unique_dn_count - a.unique_dn_count);
      
      driverData.value = processedData;
      totalDrivers.value = json.total_drivers || processedData.length;
      
      console.log('Driver data loaded:', processedData.length, 'drivers');
    }
  } catch (error) {
    console.error('Failed to fetch driver data:', error);
  } finally {
    loadingDriverData.value = false;
  }
};

// 定义表格列
const driverColumns = [
  {
    title: '序号',
    key: 'index',
    width: 80,
    align: 'center'
  },
  {
    title: '司机电话',
    dataIndex: 'phone_number',
    key: 'phone_number',
    width: 150,
    align: 'center'
  },
  {
    title: '唯一DN数',
    dataIndex: 'unique_dn_count',
    key: 'unique_dn_count',
    width: 120,
    align: 'center',
    sorter: (a, b) => a.unique_dn_count - b.unique_dn_count
  },
  {
    title: '总记录数',
    dataIndex: 'record_count',
    key: 'record_count',
    width: 120,
    align: 'center',
    sorter: (a, b) => a.record_count - b.record_count
  },
  {
    title: '平均更新次数',
    dataIndex: 'avg_updates',
    key: 'avg_updates',
    width: 140,
    align: 'center',
    sorter: (a, b) => parseFloat(a.avg_updates) - parseFloat(b.avg_updates)
  }
];

// 计算属性：根据指标处理数据
const isPlanMode = computed(() => dateMode.value === 'plan');

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

const processedUpdateData = computed(() => {
  return rawUpdate.value.map((d) => ({
    time: d.time,
    value: d.updated_dn,
    lsp: d.lsp,
  }));
});

// 计算属性：图表配置标题和格式化
const chartTitle = computed(() => {
  if (!isPlanMode.value) {
    return 'LSP 更新量统计';
  }
  return metric.value === 'total_dn'
    ? 'LSP 总数统计'
    : metric.value === 'status_not_empty'
    ? 'LSP 更新数统计'
    : 'LSP 完成率统计';
});

const isRate = computed(() => isPlanMode.value && metric.value === 'rate');

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
  const source = isPlanMode.value ? processedData.value : processedUpdateData.value;
  if (!source.length) {
    return { xAxisData: [], series: [] };
  }

  const lspMap = new Map();
  source.forEach((d) => {
    if (!lspMap.has(d.lsp)) {
      lspMap.set(d.lsp, []);
    }
    lspMap.get(d.lsp).push(d);
  });

  const timePoints = [...new Set(source.map((d) => d.time))].sort((a, b) => a - b);
  const xAxisData = timePoints.map((t) => fmtTime(t));

  const series = [];
  lspMap.forEach((items, lsp) => {
    const itemMap = new Map(items.map((item) => [item.time, item]));
    const seriesData = timePoints.map((time) => {
      const item = itemMap.get(time);
      if (!item) return null;
      if (isPlanMode.value && isRate.value) {
        return Number((item.value * 100).toFixed(2));
      }
      return item.value;
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
  console.log('updateChart called, chartInstance:', !!chartInstance, 'echarts:', !!echarts);
  if (!chartInstance || !echarts) {
    console.warn('Cannot update chart: chartInstance or echarts not available');
    return;
  }

  const { xAxisData, series } = prepareChartData();
  console.log('Chart data prepared, xAxisData length:', xAxisData.length, 'series count:', series.length);

  const option = {
    title: {
      text: chartTitle.value
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        if (!params?.length) return '';
        let result = `${params[0].axisValue}<br/>`;
        params.forEach((param) => {
          const value = param.value;
          const formattedValue = value !== null && value !== undefined
            ? (isPlanMode.value && isRate.value ? `${value}%` : value)
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

watch(dateMode, async (newMode, oldMode) => {
  console.log('dateMode changed from', oldMode, 'to', newMode);
  
  if (newMode === 'driver') {
    // 切换到司机模式时，销毁图表实例释放资源
    if (chartInstance) {
      console.log('Disposing chart instance');
      chartInstance.dispose();
      chartInstance = null;
    }
    fetchDriverData();
  } else if (isEChartsLoaded) {
    // 切换回图表模式
    // 等待 DOM 更新完成后再更新图表
    await nextTick();
    
    console.log('Switching to chart mode, container exists:', !!chartContainer.value);
    console.log('Chart instance exists:', !!chartInstance);
    
    // 如果容器存在
    if (chartContainer.value) {
      // 无论图表实例是否存在，都重新初始化以确保正确绑定到DOM
      if (chartInstance) {
        console.log('Disposing existing chart instance');
        chartInstance.dispose();
      }
      
      console.log('Creating new chart instance');
      chartInstance = echarts.init(chartContainer.value);
      
      // 更新图表
      updateChart();
      console.log('Chart updated successfully');
    } else {
      console.error('Chart container not found after nextTick');
    }
  }
});

// 监听数据变化
watch(raw, () => {
  if (chartInstance && isEChartsLoaded) {
    updateChart();
  }
});

watch(rawUpdate, () => {
  if (chartInstance && isEChartsLoaded) {
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

.mode-toggle {
  margin-bottom: 12px;
}

.mode-toggle :deep(.ant-radio-group-solid) {
  display: inline-flex;
  gap: 8px;
  background: rgba(241, 245, 249, 0.8);
  padding: 4px;
  border-radius: 12px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);
}

.mode-toggle :deep(.ant-radio-button-wrapper) {
  min-width: 110px;
  border: none;
  background: transparent;
  color: #475569;
  font-weight: 600;
  font-size: 0.875rem;
  border-radius: 8px !important;
  padding: 6px 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1.5;
}

.mode-toggle :deep(.ant-radio-button-wrapper::before) {
  display: none;
}

.mode-toggle :deep(.ant-radio-button-wrapper:hover) {
  color: #667eea;
  background: rgba(102, 126, 234, 0.08);
}

.mode-toggle :deep(.ant-radio-button-wrapper-checked) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: #ffffff !important;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1) !important;
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

.table-wrapper {
  padding: clamp(24px, 4vw, 40px);
  background: #ffffff;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.table-title {
  margin: 0;
  font-size: clamp(1.25rem, 2vw, 1.5rem);
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.table-summary {
  font-size: 1rem;
  color: #64748b;
  font-weight: 500;
}

.table-summary .highlight {
  color: #667eea;
  font-weight: 700;
  font-size: 1.25rem;
}

.phone-number {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #334155;
  padding: 4px 8px;
  background: rgba(102, 126, 234, 0.05);
  border-radius: 6px;
  display: inline-block;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.875rem;
  min-width: 50px;
}

.count-badge.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.count-badge.secondary {
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.3);
}

.avg-value {
  font-weight: 600;
  color: #059669;
  font-size: 1rem;
}

.table-wrapper :deep(.ant-table) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.table-wrapper :deep(.ant-table-thead > tr > th) {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  font-weight: 700;
  color: #334155;
  border-bottom: 2px solid rgba(102, 126, 234, 0.2);
}

.table-wrapper :deep(.ant-table-tbody > tr:hover > td) {
  background: rgba(102, 126, 234, 0.03);
}

.table-wrapper :deep(.ant-table-tbody > tr > td) {
  padding: 16px;
  transition: background-color 0.3s ease;
}

.table-wrapper :deep(.ant-pagination) {
  margin-top: 24px;
}

@media (max-width: 768px) {
  .table-wrapper {
    padding: 20px;
  }

  .table-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .phone-number {
    font-size: 0.875rem;
  }

  .count-badge {
    font-size: 0.75rem;
    padding: 3px 8px;
    min-width: 40px;
  }
}
</style>
