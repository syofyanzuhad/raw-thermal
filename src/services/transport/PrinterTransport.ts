import type { TransportDevice, TransportKind } from '@/types/printer'

/**
 * What every printer connection has in common.
 *
 * BLE and Bluetooth Classic differ enormously underneath — one writes 20-512 byte
 * characteristics, the other streams into an RFCOMM socket — but everything above this
 * interface only ever needs connect / write / disconnect.
 */
export interface PrinterTransport {
  readonly kind: TransportKind

  /** True when the radio is on and usable. */
  isAvailable(): Promise<boolean>

  connect(deviceId: string): Promise<void>

  write(data: Uint8Array): Promise<void>

  disconnect(): Promise<void>

  /** Synchronous, so UI state can be computed without awaiting. */
  isConnected(): boolean
}

/** A transport that can also enumerate devices, used by the printer picker. */
export interface ScannableTransport extends PrinterTransport {
  startScan(onDeviceFound: (device: TransportDevice) => void): Promise<void>
  stopScan(): Promise<void>
}

/** A transport backed by devices the user already paired in Android settings. */
export interface BondedTransport extends PrinterTransport {
  listBondedDevices(): Promise<TransportDevice[]>
}
