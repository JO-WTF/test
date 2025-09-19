<template>
  <Suspense>
    <template #default>
      <router-view />
    </template>
    <template #fallback>
      <div class="app-loading">Loading…</div>
    </template>
  </Suspense>
</template>

<style scoped>
.app-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #8aa2c8;
  background: #0b1020;
  margin: 0;
}
</style>
