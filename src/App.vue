<script setup lang="ts">
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { computed, onMounted } from 'vue'
import { usePrinterStore } from '@/stores/printer'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

const route = useRoute()
const printerStore = usePrinterStore()

onMounted(async () => {
  // Configure status bar for native platforms
  if (Capacitor.isNativePlatform()) {
    try {
      await StatusBar.setStyle({ style: Style.Light })
      await StatusBar.setBackgroundColor({ color: '#2563eb' }) // primary-600
      await StatusBar.setOverlaysWebView({ overlay: false })
    } catch (e) {
      console.log('StatusBar configuration failed:', e)
    }
  }
})

const navItems = [
  { path: '/', name: 'Home', icon: 'home' },
  { path: '/printer', name: 'Printer', icon: 'print' },
  { path: '/print', name: 'Print', icon: 'document' },
  { path: '/settings', name: 'Settings', icon: 'settings' }
]

const isActive = (path: string) => route.path === path

const connectionStatus = computed(() => {
  if (printerStore.isConnected) return 'connected'
  if (printerStore.isConnecting) return 'connecting'
  return 'disconnected'
})
</script>

<template>
  <div class="flex flex-col min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-primary-600 text-white px-4 py-3 shadow-md safe-top">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold">Raw Thermal</h1>
        <div class="flex items-center gap-2">
          <span
            class="w-2 h-2 rounded-full"
            :class="{
              'bg-green-400': connectionStatus === 'connected',
              'bg-yellow-400 animate-pulse': connectionStatus === 'connecting',
              'bg-gray-400': connectionStatus === 'disconnected'
            }"
          ></span>
          <span class="text-sm">
            {{ printerStore.currentPrinter?.name || 'No printer' }}
          </span>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto pb-20">
      <RouterView />
    </main>

    <!-- Bottom Navigation -->
    <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom">
      <div class="flex justify-around items-center h-16">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex flex-col items-center justify-center flex-1 py-2 transition-colors"
          :class="isActive(item.path) ? 'text-primary-600' : 'text-gray-500'"
        >
          <!-- Home Icon -->
          <svg v-if="item.icon === 'home'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          <!-- Print Icon -->
          <svg v-if="item.icon === 'print'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          <!-- Document Icon -->
          <svg v-if="item.icon === 'document'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <!-- Settings Icon -->
          <svg v-if="item.icon === 'settings'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <span class="text-xs mt-1">{{ item.name }}</span>
        </RouterLink>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.safe-top {
  /* Fallback padding for Android + safe area for iOS */
  padding-top: max(env(safe-area-inset-top, 0px), 0px);
}
.safe-bottom {
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 0px);
}
</style>
