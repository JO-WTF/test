import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'scan',
    component: () => import('../views/ScanView.vue'),
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/DnAdminView.vue'),
  },
  {
    path: '/du-admin',
    name: 'du-admin',
    component: () => import('../views/AdminView.vue'),
    alias: ['/duadmin'],
  },
  {
    path: '/dn-admin',
    name: 'dn-admin',
    component: () => import('../views/DnAdminView.vue'),
    alias: ['/dnadmin'],
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
