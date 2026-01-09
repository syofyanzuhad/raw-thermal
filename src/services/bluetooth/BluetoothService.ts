import { BleClient } from '@capacitor-community/bluetooth-le'
import type { ScanResult } from '@capacitor-community/bluetooth-le'
import type { BluetoothDevice } from '@/types/printer'

// Common printer service UUIDs
const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb'
const PRINTER_CHAR_UUID = '00002af1-0000-1000-8000-00805f9b34fb'

// Alternative UUIDs for some printers
const ALT_SERVICE_UUID = '49535343-fe7d-4ae5-8fa9-9fafd205e455'

// Serial Port Profile UUID (for classic BT emulation)
const SPP_SERVICE_UUID = '00001101-0000-1000-8000-00805f9b34fb'

export class BluetoothService {
  private connectedDeviceId: string | null = null
  private serviceUUID: string = PRINTER_SERVICE_UUID
  private characteristicUUID: string = PRINTER_CHAR_UUID
  private isInitialized: boolean = false

  constructor() {
    // Initialize with defaults
  }

  /**
   * Initialize Bluetooth and request permissions
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Initialize BLE client - this also handles permission requests on Android
      await BleClient.initialize({
        androidNeverForLocation: true // We don't need location, just Bluetooth
      })
      this.isInitialized = true
      console.log('[BT] Bluetooth initialized successfully')
    } catch (error) {
      console.error('[BT] Failed to initialize Bluetooth:', error)
      throw new Error('Failed to initialize Bluetooth. Please check permissions.')
    }
  }

  /**
   * Check if Bluetooth is available and enabled
   */
  async isAvailable(): Promise<boolean> {
    try {
      const enabled = await BleClient.isEnabled()
      console.log('[BT] Bluetooth enabled:', enabled)
      return enabled
    } catch (error) {
      console.error('[BT] Error checking Bluetooth status:', error)
      return false
    }
  }

  /**
   * Request to enable Bluetooth (Android only)
   */
  async requestEnable(): Promise<void> {
    try {
      // On Android, this will prompt the user to enable Bluetooth
      const enabled = await BleClient.isEnabled()
      if (!enabled) {
        console.log('[BT] Bluetooth is disabled, please enable it manually')
      }
    } catch (error) {
      console.error('[BT] Failed to request Bluetooth enable:', error)
    }
  }

  /**
   * Start scanning for BLE devices
   */
  async startScan(onDeviceFound: (device: BluetoothDevice) => void): Promise<void> {
    console.log('[BT] Starting scan...')

    try {
      // Request device (this triggers permission request on some platforms)
      await BleClient.requestLEScan(
        {
          // Empty options = scan for all devices
          // allowDuplicates: false - default, only report each device once
        },
        (result: ScanResult) => {
          console.log('[BT] Device found:', result.device.name || result.device.deviceId)

          const device: BluetoothDevice = {
            deviceId: result.device.deviceId,
            name: result.device.name ?? result.localName ?? null,
            rssi: result.rssi
          }

          // Filter to likely printer devices or show all named devices
          if (this.isProbablyPrinter(result) || result.device.name) {
            onDeviceFound(device)
          }
        }
      )
      console.log('[BT] Scan started successfully')
    } catch (error) {
      console.error('[BT] Failed to start scan:', error)
      throw new Error(`Failed to start Bluetooth scan: ${error}`)
    }
  }

  /**
   * Stop scanning
   */
  async stopScan(): Promise<void> {
    try {
      await BleClient.stopLEScan()
      console.log('[BT] Scan stopped')
    } catch (error) {
      console.error('[BT] Failed to stop scan:', error)
    }
  }

  /**
   * Connect to a BLE device
   */
  async connect(deviceId: string): Promise<void> {
    console.log('[BT] Connecting to:', deviceId)

    try {
      // Disconnect from any existing connection
      if (this.connectedDeviceId) {
        await this.disconnect()
      }

      await BleClient.connect(deviceId, (disconnectedDeviceId) => {
        console.log('[BT] Device disconnected:', disconnectedDeviceId)
        if (this.connectedDeviceId === disconnectedDeviceId) {
          this.connectedDeviceId = null
        }
      })

      console.log('[BT] Connected, discovering services...')

      // Discover services to find the right characteristic
      await this.discoverPrinterService(deviceId)

      this.connectedDeviceId = deviceId
      console.log('[BT] Connection complete')
    } catch (error) {
      console.error('[BT] Failed to connect:', error)
      throw new Error(`Failed to connect to printer: ${error}`)
    }
  }

  /**
   * Discover and set the printer service/characteristic
   */
  private async discoverPrinterService(deviceId: string): Promise<void> {
    try {
      const services = await BleClient.getServices(deviceId)
      console.log('[BT] Found services:', services.length)

      // Look for known printer service UUIDs
      for (const service of services) {
        const serviceUuid = service.uuid.toLowerCase()
        console.log('[BT] Service:', serviceUuid)

        // Check for standard printer service
        if (serviceUuid.includes('18f0') || serviceUuid === PRINTER_SERVICE_UUID.toLowerCase()) {
          this.serviceUUID = service.uuid
          for (const char of service.characteristics) {
            if (char.uuid.toLowerCase().includes('2af1') ||
                char.properties.write ||
                char.properties.writeWithoutResponse) {
              this.characteristicUUID = char.uuid
              console.log('[BT] Using printer service:', service.uuid, 'char:', char.uuid)
              return
            }
          }
        }

        // Check for alternative service (serial port emulation)
        if (serviceUuid.includes('49535343') || serviceUuid === ALT_SERVICE_UUID.toLowerCase()) {
          this.serviceUUID = service.uuid
          for (const char of service.characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              this.characteristicUUID = char.uuid
              console.log('[BT] Using alt service:', service.uuid, 'char:', char.uuid)
              return
            }
          }
        }
      }

      // Fallback: Use first service with writable characteristic
      for (const service of services) {
        for (const char of service.characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            this.serviceUUID = service.uuid
            this.characteristicUUID = char.uuid
            console.log('[BT] Using fallback service:', service.uuid, 'char:', char.uuid)
            return
          }
        }
      }

      throw new Error('No suitable printer characteristic found')
    } catch (error) {
      console.error('[BT] Failed to discover services:', error)
      throw error
    }
  }

  /**
   * Disconnect from current device
   */
  async disconnect(): Promise<void> {
    if (!this.connectedDeviceId) return

    try {
      await BleClient.disconnect(this.connectedDeviceId)
      console.log('[BT] Disconnected')
      this.connectedDeviceId = null
    } catch (error) {
      console.error('[BT] Failed to disconnect:', error)
      this.connectedDeviceId = null
    }
  }

  /**
   * Write data to the printer
   */
  async write(data: Uint8Array): Promise<void> {
    if (!this.connectedDeviceId) {
      throw new Error('No printer connected')
    }

    console.log('[BT] Writing', data.length, 'bytes...')

    try {
      // BLE has MTU limitations, typically 20-512 bytes
      // We need to chunk the data
      const chunkSize = 20 // Safe default, could be increased after MTU negotiation

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, Math.min(i + chunkSize, data.length))
        // Convert Uint8Array to DataView for BleClient
        const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength)

        await BleClient.write(
          this.connectedDeviceId,
          this.serviceUUID,
          this.characteristicUUID,
          dataView
        )

        // Small delay between chunks to prevent buffer overflow
        if (i + chunkSize < data.length) {
          await this.delay(10)
        }
      }
      console.log('[BT] Write complete')
    } catch (error) {
      console.error('[BT] Failed to write:', error)
      throw new Error(`Failed to send data to printer: ${error}`)
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectedDeviceId !== null
  }

  /**
   * Get connected device ID
   */
  getConnectedDeviceId(): string | null {
    return this.connectedDeviceId
  }

  /**
   * Heuristic to identify likely printer devices
   */
  private isProbablyPrinter(result: ScanResult): boolean {
    const name = (result.device.name ?? result.localName ?? '').toLowerCase()

    // Common printer name patterns
    const printerPatterns = [
      'printer', 'print', 'pos', 'esc', 'thermal',
      'receipt', 'epson', 'star', 'bixolon', 'citizen',
      'zebra', 'tsc', 'xprinter', 'goojprt', 'netum',
      'pt-', 'mpt-', 'rpt', 'zj-', 'mtp-', 'mph-',
      'hm-', 'bt-', 'spp', 'serial'
    ]

    for (const pattern of printerPatterns) {
      if (name.includes(pattern)) {
        return true
      }
    }

    // Check service UUIDs if available
    if (result.uuids) {
      for (const uuid of result.uuids) {
        const lowerUuid = uuid.toLowerCase()
        if (lowerUuid.includes('18f0') || // Printer service
            lowerUuid.includes('49535343') || // Serial port
            lowerUuid === SPP_SERVICE_UUID.toLowerCase()) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Singleton instance
let bluetoothServiceInstance: BluetoothService | null = null

export function getBluetoothService(): BluetoothService {
  if (!bluetoothServiceInstance) {
    bluetoothServiceInstance = new BluetoothService()
  }
  return bluetoothServiceInstance
}
