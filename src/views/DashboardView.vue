<template>
  <div class="wrap dashboard-view" ref="dashboardRoot">
    <header class="header">
      <div>
        <div class="title"><span class="big">Overall Deliveries</span></div>
        <div class="sub" id="meta">Date：— ・ Total: —</div>
      </div>
      <div class="controls">
        <input id="q" class="input" placeholder="Filter Region/Project…" />
        <select id="datePicker" class="select"></select>
        <button
          id="toggleZero"
          class="btn primary"
          title="切换是否弱化为 0 的单元格"
        >
          Highlight Non-Zero
        </button>
        <button id="dl" class="btn">Export CSV</button>
      </div>
    </header>

    <section class="grid cols-3" style="margin: 16px 0">
      <div class="infocard">
        <div>
          <div class="k">POD</div>
          <div id="podTotal" class="v">—</div>
          <div class="k">Successful Delivery</div>
        </div>
      </div>
      <div class="infocard">
        <div>
          <div class="k">Replan</div>
          <div id="replanTotal" class="v">—</div>
          <div class="k">REPLANs made by LSP or Project</div>
        </div>
      </div>
      <div class="infocard">
        <div>
          <div class="k">Closed</div>
          <div id="closedTotal" class="v">—</div>
          <div class="k">Closed or cancelled</div>
        </div>
      </div>
    </section>

    <section class="table-section card">
      <div class="table-scroll">
        <table id="tbl">
          <thead>
            <tr id="thead-row"></tr>
          </thead>
          <tbody id="tbody"></tbody>
          <tfoot>
            <tr id="tfoot-row"></tr>
          </tfoot>
        </table>
      </div>
      <div
        class="grid cols-3"
        style="padding: 12px; border-top: 1px solid var(--line); background: #f8fafc"
      >
        <div class="legend">
          <span class="chip">POD</span><span class="desc">已交付证明</span>
        </div>
        <div class="legend">
          <span class="chip">WAITING PIC FEEDBACK</span
          ><span class="desc">等待图片反馈</span>
        </div>
        <div class="legend">
          <span class="chip">REPLAN MOS…</span
          ><span class="desc">因项目/LSP 延误需要重排</span>
        </div>
      </div>
    </section>

    <section class="cards-section">
      <div id="cards"></div>
    </section>

    <div id="loading">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { setupDashboardPage } from './dashboard/setupDashboardPage';

const dashboardRoot = ref(null);
let cleanup = () => {};

onMounted(() => {
  cleanup = setupDashboardPage(dashboardRoot.value);
});

onBeforeUnmount(() => {
  cleanup?.();
});
</script>

<style src="../assets/css/dashboard.css"></style>
