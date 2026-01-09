import { BleClient, ConnectionPriority } from '@capacitor-community/bluetooth-le'
import type { ScanResult } from '@capacitor-community/bluetooth-le'
import type { BluetoothDevice } from '@/types/printer'
import { logger } from '@/services/LogService'

const TAG = 'Bluetooth'

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
  private negotiatedMtu: number = 20 // Default BLE MTU payload size

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
      logger.info(TAG, 'Bluetooth initialized successfully')
    } catch (error) {
      logger.error(TAG, 'Failed to initialize Bluetooth', error)
      throw new Error('Failed to initialize Bluetooth. Please check permissions.')
    }
  }

  /**
   * Check if Bluetooth is available and enabled
   */
  async isAvailable(): Promise<boolean> {
    try {
      const enabled = await BleClient.isEnabled()
      logger.debug(TAG, `Bluetooth enabled: ${enabled}`)
      return enabled
    } catch (error) {
      logger.error(TAG, 'Error checking Bluetooth status', error)
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
        logger.info(TAG, 'Bluetooth is disabled, please enable it manually')
      }
    } catch (error) {
      logger.error(TAG, 'Failed to request Bluetooth enable', error)
    }
  }

  /**
   * Start scanning for BLE devices
   */
  async startScan(onDeviceFound: (device: BluetoothDevice) => void): Promise<void> {
    logger.info(TAG, 'Starting scan...')

    try {
      // Request device (this triggers permission request on some platforms)
      await BleClient.requestLEScan(
        {
          // Empty options = scan for all devices
          // allowDuplicates: false - default, only report each device once
        },
        (result: ScanResult) => {
          logger.debug(TAG, `Device found: ${result.device.name || result.device.deviceId}`)

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
      logger.info(TAG, 'Scan started successfully')
    } catch (error) {
      logger.error(TAG, 'Failed to start scan', error)
      throw new Error(`Failed to start Bluetooth scan: ${error}`)
    }
  }

  /**
   * Stop scanning
   */
  async stopScan(): Promise<void> {
    try {
      await BleClient.stopLEScan()
      logger.info(TAG, 'Scan stopped')
    } catch (error) {
      logger.error(TAG, 'Failed to stop scan', error)
    }
  }

  /**
   * Connect to a BLE device
   */
  async connect(deviceId: string): Promise<void> {
    logger.info(TAG, `Connecting to: ${deviceId}`)

    try {
      // Disconnect from any existing connection
      if (this.connectedDeviceId) {
        await this.disconnect()
      }

      await BleClient.connect(deviceId, (disconnectedDeviceId) => {
        logger.info(TAG, `Device disconnected: ${disconnectedDeviceId}`)
        if (this.connectedDeviceId === disconnectedDeviceId) {
          this.connectedDeviceId = null
        }
      })

      logger.info(TAG, 'Connected, requesting larger MTU...')

      // Request high connection priority for faster data transfer
      try {
        await BleClient.requestConnectionPriority(deviceId, ConnectionPriority.CONNECTION_PRIORITY_HIGH)
        logger.info(TAG, 'Connection priority set to high')
      } catch {
        logger.debug(TAG, 'Could not set connection priority (optional)')
      }

      // Try to get MTU - some devices support larger MTU
      // Default BLE MTU is 23 (20 bytes payload), but many devices support up to 512
      this.negotiatedMtu = 512 // Optimistic, will be limited by actual device

      logger.info(TAG, 'Discovering services...')

      // Discover services to find the right characteristic
      await this.discoverPrinterService(deviceId)

      this.connectedDeviceId = deviceId
      logger.info(TAG, `Connection complete, using MTU: ${this.negotiatedMtu}`)
    } catch (error) {
      logger.error(TAG, 'Failed to connect', error)
      throw new Error(`Failed to connect to printer: ${error}`)
    }
  }

  /**
   * Discover and set the printer service/characteristic
   */
  private async discoverPrinterService(deviceId: string): Promise<void> {
    try {
      const services = await BleClient.getServices(deviceId)
      logger.info(TAG, `Found ${services.length} services`)

      // Look for known printer service UUIDs
      for (const service of services) {
        const serviceUuid = service.uuid.toLowerCase()
        logger.debug(TAG, `Service: ${serviceUuid}`)

        // Check for standard printer service
        if (serviceUuid.includes('18f0') || serviceUuid === PRINTER_SERVICE_UUID.toLowerCase()) {
          this.serviceUUID = service.uuid
          for (const char of service.characteristics) {
            if (char.uuid.toLowerCase().includes('2af1') ||
                char.properties.write ||
                char.properties.writeWithoutResponse) {
              this.characteristicUUID = char.uuid
              logger.info(TAG, `Using printer service: ${service.uuid}, char: ${char.uuid}`)
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
              logger.info(TAG, `Using alt service: ${service.uuid}, char: ${char.uuid}`)
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
            logger.info(TAG, `Using fallback service: ${service.uuid}, char: ${char.uuid}`)
            return
          }
        }
      }

      throw new Error('No suitable printer characteristic found')
    } catch (error) {
      logger.error(TAG, 'Failed to discover services', error)
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
      logger.info(TAG, 'Disconnected')
      this.connectedDeviceId = null
    } catch (error) {
      logger.error(TAG, 'Failed to disconnect', error)
      this.connectedDeviceId = null
    }
  }

  /**
   * Write data to the printer
   * Uses writeWithoutResponse for faster throughput when available
   */
  async write(data: Uint8Array): Promise<void> {
    if (!this.connectedDeviceId) {
      throw new Error('No printer connected')
    }

    logger.info(TAG, `Writing ${data.length} bytes...`)

    try {
      // Use negotiated MTU for chunk size (minus 3 bytes for ATT header)
      const chunkSize = Math.min(this.negotiatedMtu - 3, 512)
      const totalChunks = Math.ceil(data.length / chunkSize)

      logger.debug(TAG, `Sending in ${totalChunks} chunks of ${chunkSize} bytes`)

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, Math.min(i + chunkSize, data.length))
        // Convert Uint8Array to DataView for BleClient
        const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength)

        // Try writeWithoutResponse first (faster), fall back to write
        try {
          await BleClient.writeWithoutResponse(
            this.connectedDeviceId,
            this.serviceUUID,
            this.characteristicUUID,
            dataView
          )
        } catch {
          // Fallback to regular write if writeWithoutResponse not supported
          await BleClient.write(
            this.connectedDeviceId,
            this.serviceUUID,
            this.characteristicUUID,
            dataView
          )
        }

        // Minimal delay - BLE stack handles flow control
        if (i + chunkSize < data.length) {
          await this.delay(1)
        }
      }
      logger.info(TAG, 'Write complete')
    } catch (error) {
      logger.error(TAG, 'Failed to write', error)
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
