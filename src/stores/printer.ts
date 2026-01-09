import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Printer, BluetoothDevice, ConnectionState, PrintJob } from '@/types/printer'
import { syncPrinterConfigToNative, setCurrentPrinterNative } from '@/services/native/PrinterConfigBridge'
import { useSettingsStore } from './settings'

export const usePrinterStore = defineStore('printer', () => {
  // State
  const discoveredDevices = ref<BluetoothDevice[]>([])
  const savedPrinters = ref<Printer[]>([])
  const currentPrinter = ref<Printer | null>(null)
  const connectionState = ref<ConnectionState>('disconnected')
  const isScanning = ref(false)
  const printQueue = ref<PrintJob[]>([])
  const error = ref<string | null>(null)

  // Getters
  const isConnected = computed(() => connectionState.value === 'connected')
  const isConnecting = computed(() => connectionState.value === 'connecting')
  const hasPendingJobs = computed(() => printQueue.value.some(job => job.status === 'pending'))

  // Actions
  function setDiscoveredDevices(devices: BluetoothDevice[]) {
    discoveredDevices.value = devices
  }

  function addDiscoveredDevice(device: BluetoothDevice) {
    const index = discoveredDevices.value.findIndex(d => d.deviceId === device.deviceId)
    if (index === -1) {
      discoveredDevices.value.push(device)
    } else {
      discoveredDevices.value[index] = device
    }
  }

  function clearDiscoveredDevices() {
    discoveredDevices.value = []
  }

  function setCurrentPrinter(printer: Printer | null) {
    currentPrinter.value = printer
    // Sync to native for Print Service
    setCurrentPrinterNative(printer?.id ?? null)
  }

  function setConnectionState(state: ConnectionState) {
    connectionState.value = state
  }

  function setScanning(scanning: boolean) {
    isScanning.value = scanning
  }

  function setError(err: string | null) {
    error.value = err
  }

  function addPrintJob(job: PrintJob) {
    printQueue.value.push(job)
  }

  function updatePrintJob(jobId: string, updates: Partial<PrintJob>) {
    const index = printQueue.value.findIndex(job => job.id === jobId)
    if (index !== -1) {
      const current = printQueue.value[index]!
      printQueue.value[index] = {
        id: updates.id ?? current.id,
        data: updates.data ?? current.data,
        status: updates.status ?? current.status,
        createdAt: updates.createdAt ?? current.createdAt,
        completedAt: updates.completedAt ?? current.completedAt,
        error: updates.error ?? current.error
      }
    }
  }

  function removePrintJob(jobId: string) {
    printQueue.value = printQueue.value.filter(job => job.id !== jobId)
  }

  function savePrinter(printer: Printer) {
    const index = savedPrinters.value.findIndex(p => p.id === printer.id)
    if (index === -1) {
      savedPrinters.value.push(printer)
    } else {
      savedPrinters.value[index] = printer
    }
    // Persist to localStorage
    localStorage.setItem('savedPrinters', JSON.stringify(savedPrinters.value))
    // Sync to native for Print Service
    syncToNative()
  }

  function syncToNative() {
    const settingsStore = useSettingsStore()
    syncPrinterConfigToNative(
      savedPrinters.value,
      currentPrinter.value?.id ?? null,
      settingsStore.settings as unknown as Record<string, unknown>
    )
  }

  function loadSavedPrinters() {
    const saved = localStorage.getItem('savedPrinters')
    if (saved) {
      savedPrinters.value = JSON.parse(saved)
    }
  }

  function removeSavedPrinter(printerId: string) {
    savedPrinters.value = savedPrinters.value.filter(p => p.id !== printerId)
    localStorage.setItem('savedPrinters', JSON.stringify(savedPrinters.value))
    // Sync to native for Print Service
    syncToNative()
  }

  return {
    // State
    discoveredDevices,
    savedPrinters,
    currentPrinter,
    connectionState,
    isScanning,
    printQueue,
    error,

    // Getters
    isConnected,
    isConnecting,
    hasPendingJobs,

    // Actions
    setDiscoveredDevices,
    addDiscoveredDevice,
    clearDiscoveredDevices,
    setCurrentPrinter,
    setConnectionState,
    setScanning,
    setError,
    addPrintJob,
    updatePrintJob,
    removePrintJob,
    savePrinter,
    loadSavedPrinters,
    removeSavedPrinter
  }
})
