import { getBluetoothService } from '@/services/bluetooth/BluetoothService'
import type { TransportDevice } from '@/types/printer'
import type { ScannableTransport } from './PrinterTransport'

/**
 * Bluetooth Low Energy, via the Capacitor BLE plugin.
 *
 * Thin wrapper over the existing BluetoothService singleton — it already handles service
 * discovery, characteristic selection and MTU-aware chunking, so nothing is reimplemented here.
 */
export class BleTransport implements ScannableTransport {
  readonly kind = 'ble' as const

  private service = getBluetoothService()

  /** Idempotent; the underlying service ignores repeat calls. */
  async initialize(): Promise<void> {
    await this.service.initialize()
  }

  async isAvailable(): Promise<boolean> {
    await this.service.initialize()
    return this.service.isAvailable()
  }

  async startScan(onDeviceFound: (device: TransportDevice) => void): Promise<void> {
    await this.service.initialize()
    await this.service.startScan(device => {
      onDeviceFound({
        deviceId: device.deviceId,
        name: device.name,
        rssi: device.rssi,
        kind: 'ble'
      })
    })
  }

  async stopScan(): Promise<void> {
    await this.service.stopScan()
  }

  async connect(deviceId: string): Promise<void> {
    await this.service.connect(deviceId)
  }

  async write(data: Uint8Array): Promise<void> {
    await this.service.write(data)
  }

  async disconnect(): Promise<void> {
    await this.service.disconnect()
  }

  isConnected(): boolean {
    return this.service.isConnected()
  }
}
