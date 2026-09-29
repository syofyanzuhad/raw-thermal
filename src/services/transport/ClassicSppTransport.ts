import {
  classicConnect,
  classicDisconnect,
  classicIsEnabled,
  classicListBondedDevices,
  classicWriteBase64,
  isClassicSupported
} from '@/services/native/BluetoothClassicBridge'
import type { TransportDevice } from '@/types/printer'
import { bytesToBase64 } from './base64'
import type { BondedTransport } from './PrinterTransport'

/**
 * Bluetooth Classic SPP/RFCOMM.
 *
 * This is the transport that reaches the cheap ESC/POS printers most people actually own:
 * they expose a Serial Port Profile and nothing else, so a BLE scan never finds them.
 *
 * Chunking and flow control live in the native manager (8 KB chunks with a short delay);
 * the bridge only carries base64.
 */
export class ClassicSppTransport implements BondedTransport {
  readonly kind = 'classic' as const

  /**
   * Local view of the connection.
   *
   * The socket lives in native code, so this is the app's intent rather than a live probe.
   * It is cleared on any write failure, which is how a powered-off or out-of-range printer
   * shows up in practice.
   */
  private connectedAddress: string | null = null

  async isAvailable(): Promise<boolean> {
    if (!isClassicSupported()) return false
    return classicIsEnabled()
  }

  async listBondedDevices(): Promise<TransportDevice[]> {
    const devices = await classicListBondedDevices()
    return devices.map(device => ({
      deviceId: device.address,
      name: device.name,
      kind: 'classic' as const,
      bonded: device.bonded
    }))
  }

  async connect(deviceId: string): Promise<void> {
    await classicConnect(deviceId)
    this.connectedAddress = deviceId
  }

  async write(data: Uint8Array): Promise<void> {
    try {
      await classicWriteBase64(bytesToBase64(data))
    } catch (error) {
      // The socket is gone; stop claiming we are connected.
      this.connectedAddress = null
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      await classicDisconnect()
    } finally {
      this.connectedAddress = null
    }
  }

  isConnected(): boolean {
    return this.connectedAddress !== null
  }

  getConnectedAddress(): string | null {
    return this.connectedAddress
  }
}
