export interface BluetoothDevice {
  deviceId: string
  name: string | null
  rssi?: number
}

export interface Printer {
  id: string
  name: string
  type: 'bluetooth' | 'wifi' | 'usb'
  address: string
  isConnected: boolean
  paperWidth: 58 | 80
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
