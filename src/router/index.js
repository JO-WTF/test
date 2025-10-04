import { createRouter, createWebHistory } from 'vue-router';
import { getCookie } from '../utils/cookie.js';

const PHONE_COOKIE_KEY = 'phone_number';

const routes = [
  {
    path: '/',
    name: 'scan',
    component: () => import('../views/ScanView.vue'),
  },
  {
    path: '/phone',
    name: 'phone',
    component: () => import('../views/PhoneNumberView.vue'),
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/AdminView.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
  },
  {
    path: '/routes',
    name: 'routes',
    component: () => import('../views/RouteCalculatorView.vue'),
  },
  {
    path: '/map',
    name: 'map',
    component: () => import('../views/MapView.vue'),
  },
  {
    path: '/lsp-stats',
    name: 'lsp-stats',
    component: () => import('../views/LSPStatsView.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to, from, next) => {
  if (typeof document === 'undefined') {
    next();
    return;
  }

  const storedPhone = getCookie(PHONE_COOKIE_KEY);

  if (to.name === 'phone') {
    if (storedPhone) {
      next({ name: 'scan' });
      return;
    }
    next();
    return;
  }

  if (to.name === 'scan' && !storedPhone) {
    const query = to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : {};
    next({ name: 'phone', query });
    return;
  }

  next();
});

export default router;
