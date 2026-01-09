import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/printer',
      name: 'printer',
      component: () => import('@/views/PrinterView.vue')
    },
    {
      path: '/print',
      name: 'print',
      component: () => import('@/views/PrintView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue')
    },
    {
      path: '/file-print',
      name: 'file-print',
      component: () => import('@/views/FilePrintView.vue')
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('@/views/LogView.vue')
    }
  ]
})

export default router
