<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePrinterStore } from '@/stores/printer'

const router = useRouter()
const printerStore = usePrinterStore()

const connectionStatus = computed(() => {
  if (printerStore.isConnected) return { text: 'Connected', color: 'text-green-600', bg: 'bg-green-50' }
  if (printerStore.isConnecting) return { text: 'Connecting...', color: 'text-yellow-600', bg: 'bg-yellow-50' }
  return { text: 'Disconnected', color: 'text-gray-600', bg: 'bg-gray-50' }
})

const quickActions = [
  { label: 'Print Text', icon: 'text', action: () => router.push('/print') },
  { label: 'Print File', icon: 'file', action: () => router.push('/file-print') },
  { label: 'Scan Printers', icon: 'scan', action: () => router.push('/printer') },
  { label: 'Settings', icon: 'settings', action: () => router.push('/settings') }
]

onMounted(() => {
  printerStore.loadSavedPrinters()
})
</script>

<template>
  <div class="p-4 space-y-6">
    <!-- Printer Status Card -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-800">Printer Status</h2>
        <span
          class="px-3 py-1 rounded-full text-sm font-medium"
          :class="[connectionStatus.color, connectionStatus.bg]"
        >
          {{ connectionStatus.text }}
        </span>
      </div>

      <div v-if="printerStore.currentPrinter" class="space-y-2">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
          </div>
          <div>
            <p class="font-medium text-gray-900">{{ printerStore.currentPrinter.name }}</p>
            <p class="text-sm text-gray-500">{{ printerStore.currentPrinter.address }}</p>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-6">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
        </div>
        <p class="text-gray-500 mb-4">No printer connected</p>
        <button
          @click="router.push('/printer')"
          class="btn btn-primary"
        >
          Connect Printer
        </button>
      </div>
    </div>

    <!-- Quick Actions -->
    <div>
      <h2 class="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h2>
      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="action in quickActions"
          :key="action.label"
          @click="action.action"
          class="card flex flex-col items-center justify-center py-6 hover:bg-gray-50 transition-colors"
        >
          <div class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-2">
            <svg v-if="action.icon === 'text'" class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"/>
            </svg>
            <svg v-if="action.icon === 'file'" class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <svg v-if="action.icon === 'scan'" class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <svg v-if="action.icon === 'settings'" class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <span class="text-sm font-medium text-gray-700">{{ action.label }}</span>
        </button>
      </div>
    </div>

    <!-- Saved Printers -->
    <div v-if="printerStore.savedPrinters.length > 0">
      <h2 class="text-lg font-semibold text-gray-800 mb-3">Saved Printers</h2>
      <div class="space-y-2">
        <div
          v-for="printer in printerStore.savedPrinters"
          :key="printer.id"
          class="card flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
              </svg>
            </div>
            <div>
              <p class="font-medium text-gray-900">{{ printer.name }}</p>
              <p class="text-xs text-gray-500">{{ printer.type }} - {{ printer.paperWidth }}mm</p>
            </div>
          </div>
          <button class="btn btn-outline text-sm py-1">Connect</button>
        </div>
      </div>
    </div>
  </div>
</template>
