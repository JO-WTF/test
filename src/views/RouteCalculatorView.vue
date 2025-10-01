<template>
  <div class="route-calculator-view">
    <section class="card upload-card">
      <h1>Route Calculator</h1>
      <p class="description">
        Upload an Excel file with warehouse and destination coordinates to calculate driving distance
        and duration.
      </p>
      <div class="actions">
        <label class="upload-button">
          <input
            ref="fileInput"
            type="file"
            accept=".xlsx,.xls"
            @change="onFileChange"
            :disabled="isProcessing"
          />
          <span>{{ isProcessing ? 'Processing…' : 'Select Excel File' }}</span>
        </label>
        <button v-if="rows.length" class="clear-button" @click="reset" :disabled="isProcessing">
          Clear Data
        </button>
      </div>
      <p v-if="uploadError" class="error">{{ uploadError }}</p>
      <p v-if="rows.length" class="hint">
        Showing {{ rows.length }} row{{ rows.length === 1 ? '' : 's' }} from the first worksheet.
      </p>
    </section>

    <section v-if="rows.length" class="card table-card">
      <header class="table-header">
        <h2>Calculated Routes</h2>
        <p class="status" v-if="progressMessage">{{ progressMessage }}</p>
      </header>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Warehouse Name</th>
              <th>Warehouse Coordinates (lon, lat)</th>
              <th>Destination Name</th>
              <th>Destination Coordinates (lon, lat)</th>
              <th>Distance (km)</th>
              <th>Duration (h)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>{{ row.warehouseName }}</td>
              <td>{{ row.warehouseCoordsRaw }}</td>
              <td>{{ row.destinationName }}</td>
              <td>{{ row.destinationCoordsRaw }}</td>
              <td>
                <span v-if="row.distanceKm !== null">{{ row.distanceKm }}</span>
                <span v-else-if="row.status === 'processing'">Loading…</span>
                <span v-else-if="row.status === 'pending'">Waiting…</span>
                <span v-else>—</span>
                <small v-if="row.error" class="cell-error">{{ row.error }}</small>
              </td>
              <td>
                <span v-if="row.durationHours !== null">{{ row.durationHours }}</span>
                <span v-else-if="row.status === 'processing'">Loading…</span>
                <span v-else-if="row.status === 'pending'">Waiting…</span>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue';
// 延迟加载 XLSX，只在需要时导入
import { useBodyTheme } from '../composables/useBodyTheme';
import { getMapboxAccessToken } from '../utils/env.js';

const MAPBOX_ACCESS_TOKEN = getMapboxAccessToken();

if (!MAPBOX_ACCESS_TOKEN) {
  console.warn('Mapbox access token is not configured. Route calculations will fail.');
}

useBodyTheme(null);

const fileInput = ref(null);
const rows = ref([]);
const uploadError = ref('');
const isProcessing = ref(false);
const currentIndex = ref(-1);

// 并发控制
const BATCH_SIZE = 5; // 每批处理 5 个请求
let abortController = null;

const completedCount = computed(() =>
  rows.value.filter((row) => row.status === 'done').length
);
const processedCount = computed(() =>
  rows.value.filter((row) => row.status !== 'pending' && row.status !== 'processing').length
);
const progressMessage = computed(() => {
  if (!rows.value.length) return '';
  if (isProcessing.value) {
    const processed = processedCount.value;
    const current = currentIndex.value >= 0 ? currentIndex.value + 1 : processed;
    return `Processing ${Math.min(current, rows.value.length)} of ${rows.value.length}`;
  }
  if (!processedCount.value) {
    return '';
  }
  return `Processed ${processedCount.value} of ${rows.value.length} rows (${completedCount.value} succeeded)`;
});

const onFileChange = async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;

  uploadError.value = '';
  rows.value = [];

  try {
    const parsedRows = await readExcelFile(file);
    if (!parsedRows.length) {
      uploadError.value = 'No data found in the first worksheet.';
      return;
    }
    rows.value = parsedRows;
    await nextTick();
    await processRowsSequentially();
  } catch (error) {
    uploadError.value = error?.message || 'Failed to read the uploaded file.';
  } finally {
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  }
};

const reset = () => {
  // 取消正在进行的请求
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  rows.value = [];
  uploadError.value = '';
  isProcessing.value = false;
  currentIndex.value = -1;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const readExcelFile = (file) =>
  new Promise(async (resolve, reject) => {
    try {
      // 动态导入 XLSX，只在实际使用时加载
      const XLSX = await import('xlsx');
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          if (!workbook.SheetNames.length) {
            resolve([]);
            return;
          }
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
          const parsed = rawRows
            .map((cells, index) => parseRow(cells, index))
            .filter((row) => row !== null);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.readAsArrayBuffer(file);
    } catch (err) {
      reject(new Error('Failed to load XLSX library'));
    }
  });

const parseRow = (cells = [], index) => {
  const hasValue = Array.isArray(cells)
    ? cells.some((cell) => !(cell === undefined || cell === null || String(cell).trim() === ''))
    : false;
  if (!hasValue) {
    return null;
  }

  const warehouseName = formatCellValue(cells[0]);
  const warehouseCoordsRaw = formatCellValue(cells[1]);
  const destinationName = formatCellValue(cells[2]);
  const destinationCoordsRaw = formatCellValue(cells[3]);

  return {
    id: index,
    warehouseName,
    warehouseCoordsRaw,
    destinationName,
    destinationCoordsRaw,
    distanceKm: null,
    durationHours: null,
    status: 'pending',
    error: '',
    origin: parseCoordinatePair(warehouseCoordsRaw),
    destination: parseCoordinatePair(destinationCoordsRaw),
  };
};

const formatCellValue = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
};

const parseCoordinatePair = (value) => {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, '');
  const parts = cleaned.split(',');
  if (parts.length !== 2) return null;
  const lon = Number.parseFloat(parts[0]);
  const lat = Number.parseFloat(parts[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return { lon, lat };
};

const processRowsSequentially = async () => {
  if (!rows.value.length) return;
  isProcessing.value = true;
  currentIndex.value = -1;

  // 创建新的取消控制器
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();

  try {
    await processInBatches(rows.value, abortController.signal);
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Processing error:', error);
    }
  } finally {
    currentIndex.value = -1;
    isProcessing.value = false;
  }
};

// 批量并行处理
const processInBatches = async (rowsArray, signal) => {
  for (let i = 0; i < rowsArray.length; i += BATCH_SIZE) {
    if (signal.aborted) {
      throw new DOMException('Processing cancelled', 'AbortError');
    }

    const batch = rowsArray.slice(i, i + BATCH_SIZE);
    
    // 并行处理当前批次
    await Promise.allSettled(
      batch.map(async (row) => {
        if (signal.aborted) return;

        if (!row.origin || !row.destination) {
          row.status = 'error';
          row.error = 'Invalid coordinate pair';
          return;
        }

        row.status = 'processing';
        row.error = '';

        try {
          const result = await fetchRoute(row.origin, row.destination, signal);
          row.distanceKm = formatDecimal(result.distance / 1000);
          row.durationHours = formatDecimal(result.duration / 3600);
          row.status = 'done';
        } catch (error) {
          if (error.name === 'AbortError') {
            row.status = 'pending';
            row.error = '';
          } else {
            row.status = 'error';
            row.error = error?.message || 'Failed to fetch route';
          }
        }
      })
    );
  }
};

const fetchRoute = async (origin, destination, signal) => {
  if (!MAPBOX_ACCESS_TOKEN) {
    throw new Error('Mapbox access token is not configured');
  }

  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}`
  );
  url.search = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    overview: 'false',
    geometries: 'geojson',
  }).toString();

  const response = await fetch(url.toString(), { signal });
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error('Unable to parse response from Mapbox');
  }

  if (!response.ok) {
    const message = data?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const route = Array.isArray(data?.routes) ? data.routes[0] : null;
  if (!route) {
    throw new Error('No route data returned');
  }

  const distance = Number(route.distance);
  const duration = Number(route.duration);
  if (!Number.isFinite(distance) || !Number.isFinite(duration)) {
    throw new Error('Route data is incomplete');
  }

  return {
    distance,
    duration,
  };
};

const formatDecimal = (value) => {
  if (!Number.isFinite(value)) return null;
  return value.toFixed(2);
};
</script>

<style scoped>
.route-calculator-view {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
  border: 1px solid #e2e8f0;
}

.upload-card h1 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: #0f172a;
}

.description {
  margin: 0 0 16px;
  color: #475569;
  line-height: 1.5;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.upload-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border-radius: 999px;
  background: #2563eb;
  color: #ffffff;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.upload-button:hover {
  background: #1d4ed8;
}

.upload-button input[type='file'] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-button input[type='file']:disabled {
  cursor: not-allowed;
}

.clear-button {
  appearance: none;
  border: 1px solid #cbd5f5;
  background: transparent;
  color: #2563eb;
  padding: 10px 18px;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.clear-button:hover {
  background: rgba(37, 99, 235, 0.08);
}

.clear-button:disabled,
.upload-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin-top: 12px;
  color: #dc2626;
}

.hint {
  margin-top: 12px;
  color: #64748b;
  font-size: 14px;
}

.table-card {
  overflow: hidden;
}

.table-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.table-header h2 {
  margin: 0;
  font-size: 20px;
  color: #0f172a;
}

.status {
  margin: 0;
  font-size: 14px;
  color: #475569;
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f8fafc;
}

th,
td {
  text-align: left;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
  font-size: 14px;
}

th {
  font-weight: 600;
  color: #1e293b;
}

tbody tr:nth-child(even) {
  background: #f8fafc;
}

.cell-error {
  display: block;
  margin-top: 4px;
  color: #dc2626;
  font-size: 12px;
}

@media (max-width: 768px) {
  .route-calculator-view {
    padding: 24px 12px;
  }

  th,
  td {
    padding: 10px 12px;
    font-size: 13px;
  }
}
</style>
