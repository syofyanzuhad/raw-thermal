import { ref, onMounted } from 'vue'
import { usePrinterStore } from '@/stores/printer'
import { getBluetoothService } from '@/services/bluetooth/BluetoothService'
import type { Printer } from '@/types/printer'

export function useBluetoothService() {
  const printerStore = usePrinterStore()
  const bluetoothService = getBluetoothService()
  const initialized = ref(false)

  async function initialize() {
    if (initialized.value) return
    try {
      await bluetoothService.initialize()
      initialized.value = true
    } catch (error) {
      console.error('Failed to initialize Bluetooth:', error)
      printerStore.setError('Failed to initialize Bluetooth')
    }
  }

  async function isAvailable(): Promise<boolean> {
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
    write
  }
}
