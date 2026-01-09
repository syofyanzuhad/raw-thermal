import { ref, onMounted, computed } from 'vue'
import { Capacitor } from '@capacitor/core'
import { usePrinterStore } from '@/stores/printer'
import { getBluetoothService } from '@/services/bluetooth/BluetoothService'
import type { Printer } from '@/types/printer'

// Platform detection
const isNative = Capacitor.isNativePlatform()
const isWeb = !isNative

// Web Bluetooth support detection
const hasWebBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator

export function useBluetoothService() {
  const printerStore = usePrinterStore()
  const bluetoothService = getBluetoothService()
  const initialized = ref(false)
  const platformSupported = ref(isNative || hasWebBluetooth)

  // Platform info for UI
  const platformInfo = computed(() => ({
    isNative,
    isWeb,
    hasWebBluetooth,
    supported: platformSupported.value,
    message: getPlatformMessage()
  }))

  function getPlatformMessage(): string | null {
    if (isNative) return null
    if (!hasWebBluetooth) {
      return 'Bluetooth tidak tersedia di browser ini. Gunakan Chrome/Edge atau install aplikasi Android untuk fitur Bluetooth.'
    }
    return 'Mode Web: Bluetooth terbatas. Install aplikasi Android untuk pengalaman terbaik.'
  }

  async function initialize() {
    if (initialized.value) return

    // Skip initialization if platform doesn't support Bluetooth
    if (!platformSupported.value) {
      printerStore.setError(getPlatformMessage())
      return
    }

    try {
      await bluetoothService.initialize()
      initialized.value = true
    } catch (error) {
      console.error('Failed to initialize Bluetooth:', error)
      printerStore.setError('Failed to initialize Bluetooth')
    }
  }

  async function isAvailable(): Promise<boolean> {
    if (!platformSupported.value) return false
    await initialize()
    return bluetoothService.isAvailable()
  }

  async function startScan() {
    await initialize()
    printerStore.setScanning(true)
    printerStore.clearDiscoveredDevices()
    printerStore.setError(null)

    try {
      await bluetoothService.startScan((device) => {
        printerStore.addDiscoveredDevice(device)
      })

      // Auto-stop after timeout
      setTimeout(async () => {
        if (printerStore.isScanning) {
          await stopScan()
        }
      }, 10000)
    } catch (error) {
      printerStore.setScanning(false)
      throw error
    }
  }

  async function stopScan() {
    try {
      await bluetoothService.stopScan()
    } finally {
      printerStore.setScanning(false)
    }
  }

  async function connect(deviceId: string, deviceName: string | null) {
    printerStore.setConnectionState('connecting')
    printerStore.setError(null)

    try {
      await bluetoothService.connect(deviceId)

      const printer: Printer = {
        id: deviceId,
        name: deviceName || 'Unknown Printer',
        type: 'bluetooth',
        address: deviceId,
        isConnected: true,
        paperWidth: 58
      }

      printerStore.setCurrentPrinter(printer)
      printerStore.setConnectionState('connected')
      printerStore.savePrinter(printer)

      // Stop scanning if still running
      if (printerStore.isScanning) {
        await stopScan()
      }
    } catch (error) {
      printerStore.setConnectionState('error')
      printerStore.setError(error instanceof Error ? error.message : 'Connection failed')
      throw error
    }
  }

  async function disconnect() {
    try {
      await bluetoothService.disconnect()
    } finally {
      printerStore.setCurrentPrinter(null)
      printerStore.setConnectionState('disconnected')
    }
  }

  async function write(data: Uint8Array) {
    if (!bluetoothService.isConnected()) {
      throw new Error('No printer connected')
    }
    await bluetoothService.write(data)
  }

  // Initialize on mount
  onMounted(() => {
    initialize()
  })

  return {
    initialize,
    isAvailable,
    startScan,
    stopScan,
    connect,
    disconnect,
    write,
    platformInfo
  }
}
