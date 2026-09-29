export interface BluetoothDevice {
  deviceId: string
  name: string | null
  rssi?: number
}

/**
 * How we talk to the printer.
 *
 * `ble` is Bluetooth Low Energy (the Capacitor BLE plugin). `classic` is Bluetooth Classic
 * SPP/RFCOMM, which most cheap ESC/POS printers use and BLE cannot reach.
 */
export type TransportKind = 'ble' | 'classic'

export interface TransportDevice {
  deviceId: string
  name: string | null
  kind: TransportKind
  rssi?: number
  /** Classic only: already paired in Android's Bluetooth settings. */
  bonded?: boolean
}

export interface Printer {
  id: string
  name: string
  type: 'bluetooth' | 'wifi' | 'usb'
  address: string
  isConnected: boolean
  paperWidth: 58 | 80
  /**
   * Optional so printers saved before Bluetooth Classic support existed keep working:
   * a missing value means BLE, which is what those printers were connected over.
   */
  transport?: TransportKind
  lastConnected?: Date
}

export interface PrinterStatus {
  isConnected: boolean
  isPrinting: boolean
  error: string | null
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface PrintJob {
  id: string
  data: Uint8Array
  status: 'pending' | 'printing' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
  error?: string
}
