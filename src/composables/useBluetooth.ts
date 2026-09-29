import { ref, onMounted, computed } from 'vue'
import { Capacitor } from '@capacitor/core'
import { usePrinterStore } from '@/stores/printer'
import {
  getActiveTransport,
  getBleTransport,
  getClassicTransport,
  getTransport,
  setActiveTransport
} from '@/services/transport'
import { isClassicSupported } from '@/services/native/BluetoothClassicBridge'
import type { PrinterTransport } from '@/services/transport/PrinterTransport'
import type { Printer, TransportDevice, TransportKind } from '@/types/printer'

// Platform detection
const isNative = Capacitor.isNativePlatform()
const isWeb = !isNative

// Web Bluetooth support detection
const hasWebBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator

export function useBluetoothService() {
  const printerStore = usePrinterStore()
  const bluetoothService = getBleTransport()
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

  /** Bluetooth Classic is Android-only and independent of the BLE radio state. */
  async function isClassicAvailable(): Promise<boolean> {
    if (!isClassicSupported()) return false
    return getClassicTransport().isAvailable()
  }

  async function startScan() {
    await initialize()
    printerStore.setScanning(true)
    printerStore.clearDiscoveredDevices()
    printerStore.setError(null)

    try {
      await bluetoothService.startScan((device) => {
        printerStore.addDiscoveredDevice({
          deviceId: device.deviceId,
          name: device.name,
          rssi: device.rssi
        })
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

  /**
   * Devices already paired in Android's Bluetooth settings.
   *
   * Classic SPP printers cannot be found by a BLE scan, so the user pairs them in the system
   * settings first and we list them from there.
   */
  async function listPairedDevices(): Promise<TransportDevice[]> {
    if (!isClassicSupported()) return []

    try {
      return await getClassicTransport().listBondedDevices()
    } catch (error) {
      console.error('Failed to list paired devices:', error)
      printerStore.setError(error instanceof Error ? error.message : 'Failed to list paired devices')
      return []
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
        paperWidth: 58,
        transport: 'ble'
      }

      setActiveTransport(bluetoothService)
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

  /**
   * Connect over Bluetooth Classic SPP/RFCOMM.
   *
   * Separate from `connect()` on purpose: it targets a different radio, needs no scan (the
   * device is already paired), and uses a MAC address rather than a BLE device id.
   */
  async function connectClassic(address: string, deviceName: string | null) {
    printerStore.setConnectionState('connecting')
    printerStore.setError(null)

    const transport = getClassicTransport()

    try {
      await transport.connect(address)

      const printer: Printer = {
        id: address,
        name: deviceName || 'Unknown Printer',
        type: 'bluetooth',
        address,
        isConnected: true,
        paperWidth: 58,
        transport: 'classic'
      }

      setActiveTransport(transport)
      printerStore.setCurrentPrinter(printer)
      printerStore.setConnectionState('connected')
      printerStore.savePrinter(printer)
    } catch (error) {
      printerStore.setConnectionState('error')
      printerStore.setError(error instanceof Error ? error.message : 'Connection failed')
      throw error
    }
  }

  /** Connect a printer that was restored from storage, using the transport it was saved with. */
  async function connectSaved(printer: Printer) {
    if (printer.transport === 'classic') {
      return connectClassic(printer.address, printer.name)
    }
    return connect(printer.address, printer.name)
  }

  async function disconnect() {
    const transport = resolveTransport()

    try {
      await transport.disconnect()
    } finally {
      setActiveTransport(null)
      printerStore.setCurrentPrinter(null)
      printerStore.setConnectionState('disconnected')
    }
  }

  /**
   * The transport in play for the current printer.
   *
   * Falls back to the transport recorded on the saved printer, so printing still works after
   * a reload where no connect() ran in this session.
   */
  function resolveTransport(): PrinterTransport {
    const active = getActiveTransport()
    if (active) return active

    const kind: TransportKind = printerStore.currentPrinter?.transport ?? 'ble'
    return getTransport(kind)
  }

  async function write(data: Uint8Array) {
    const transport = resolveTransport()

    if (!transport.isConnected()) {
      throw new Error('No printer connected')
    }
    await transport.write(data)
  }

  // Initialize on mount
  onMounted(() => {
    initialize()
  })

  return {
    initialize,
    isAvailable,
    isClassicAvailable,
    startScan,
    stopScan,
    listPairedDevices,
    connect,
    connectClassic,
    connectSaved,
    disconnect,
    write,
    platformInfo
  }
}
