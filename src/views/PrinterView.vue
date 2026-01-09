<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { usePrinterStore } from '@/stores/printer'
import { useBluetoothService } from '@/composables/useBluetooth'

const printerStore = usePrinterStore()
const { startScan, stopScan, connect, disconnect, isAvailable, platformInfo } = useBluetoothService()

const bluetoothAvailable = ref(true)
const scanError = ref<string | null>(null)

async function handleStartScan() {
  scanError.value = null
  try {
    await startScan()
  } catch (err) {
    scanError.value = err instanceof Error ? err.message : 'Failed to start scanning'
  }
}

async function handleStopScan() {
  try {
    await stopScan()
  } catch (err) {
    console.error('Failed to stop scan:', err)
  }
}

async function handleConnect(deviceId: string, name: string | null) {
  try {
    await connect(deviceId, name)
  } catch (err) {
    printerStore.setError(err instanceof Error ? err.message : 'Failed to connect')
  }
}

async function handleDisconnect() {
  try {
    await disconnect()
  } catch (err) {
    console.error('Failed to disconnect:', err)
  }
}

onMounted(async () => {
  bluetoothAvailable.value = await isAvailable()
  printerStore.loadSavedPrinters()
})

onUnmounted(() => {
  if (printerStore.isScanning) {
    handleStopScan()
  }
})
</script>

<template>
  <div class="p-4 space-y-6">
    <!-- Platform Warning (Web Browser) -->
    <div v-if="platformInfo.isWeb && platformInfo.message" class="card bg-amber-50 border-amber-200">
      <div class="flex items-start gap-3 text-amber-700">
        <svg class="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <div>
          <p class="font-medium">Mode Browser</p>
          <p class="text-sm">{{ platformInfo.message }}</p>
          <a
            v-if="!platformInfo.hasWebBluetooth"
            href="#"
            class="inline-block mt-2 text-sm font-medium text-amber-800 underline"
          >
            Download APK Android
          </a>
        </div>
      </div>
    </div>

    <!-- Bluetooth Status -->
    <div v-if="!bluetoothAvailable && platformInfo.supported" class="card bg-red-50 border-red-200">
      <div class="flex items-center gap-3 text-red-700">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <div>
          <p class="font-medium">Bluetooth Not Available</p>
          <p class="text-sm">Please enable Bluetooth on your device</p>
        </div>
      </div>
    </div>

    <!-- Connected Printer -->
    <div v-if="printerStore.currentPrinter && printerStore.isConnected" class="card bg-green-50 border-green-200">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div>
            <p class="font-medium text-green-800">{{ printerStore.currentPrinter.name }}</p>
            <p class="text-sm text-green-600">Connected</p>
          </div>
        </div>
        <button
          @click="handleDisconnect"
          class="btn bg-red-100 text-red-700 hover:bg-red-200"
        >
          Disconnect
        </button>
      </div>
    </div>

    <!-- Scan Section -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-800">Find Printers</h2>
        <button
          v-if="!printerStore.isScanning"
          @click="handleStartScan"
          :disabled="!bluetoothAvailable || !platformInfo.supported"
          class="btn btn-primary"
          :class="{ 'opacity-50 cursor-not-allowed': !bluetoothAvailable || !platformInfo.supported }"
        >
          <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          Scan
        </button>
        <button
          v-else
          @click="handleStopScan"
          class="btn bg-red-100 text-red-700 hover:bg-red-200"
        >
          <svg class="w-4 h-4 mr-2 inline animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Stop
        </button>
      </div>

      <!-- Scan Error -->
      <div v-if="scanError" class="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
        {{ scanError }}
      </div>

      <!-- Scanning Animation -->
      <div v-if="printerStore.isScanning" class="text-center py-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 mb-4">
          <svg class="w-8 h-8 text-primary-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
          </svg>
        </div>
        <p class="text-gray-600">Scanning for Bluetooth printers...</p>
      </div>

      <!-- Discovered Devices -->
      <div v-else-if="printerStore.discoveredDevices.length > 0" class="space-y-2">
        <div
          v-for="device in printerStore.discoveredDevices"
          :key="device.deviceId"
          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
              </svg>
            </div>
            <div>
              <p class="font-medium text-gray-900">{{ device.name || 'Unknown Device' }}</p>
              <p class="text-xs text-gray-500">{{ device.deviceId }}</p>
            </div>
          </div>
          <button
            @click="handleConnect(device.deviceId, device.name)"
            :disabled="printerStore.isConnecting"
            class="btn btn-primary text-sm"
            :class="{ 'opacity-50 cursor-not-allowed': printerStore.isConnecting }"
          >
            {{ printerStore.isConnecting ? 'Connecting...' : 'Connect' }}
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-8">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
          </svg>
        </div>
        <p class="text-gray-500">No printers found</p>
        <p class="text-sm text-gray-400">Tap "Scan" to search for nearby printers</p>
      </div>
    </div>

    <!-- Saved Printers -->
    <div v-if="printerStore.savedPrinters.length > 0" class="card">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">Saved Printers</h2>
      <div class="space-y-2">
        <div
          v-for="printer in printerStore.savedPrinters"
          :key="printer.id"
          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
              </svg>
            </div>
            <div>
              <p class="font-medium text-gray-900">{{ printer.name }}</p>
              <p class="text-xs text-gray-500">{{ printer.paperWidth }}mm paper</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="handleConnect(printer.address, printer.name)"
              class="btn btn-outline text-sm py-1"
            >
              Connect
            </button>
            <button
              @click="printerStore.removeSavedPrinter(printer.id)"
              class="p-2 text-red-500 hover:bg-red-50 rounded-lg"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
