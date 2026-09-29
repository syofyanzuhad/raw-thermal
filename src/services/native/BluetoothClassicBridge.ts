import { Capacitor, registerPlugin } from '@capacitor/core'

export interface ClassicDevice {
  address: string
  name: string | null
  bonded: boolean
}

/**
 * Bluetooth Classic (SPP/RFCOMM) bridge.
 *
 * BLE and Classic are different radios as far as Android is concerned: the Capacitor BLE
 * plugin cannot see a Classic-only printer at all. This plugin is a thin shell over
 * `BluetoothPrinterManager`, the RFCOMM implementation the Android PrintService already uses,
 * so the socket handling is shared rather than duplicated.
 */
interface BluetoothClassicPlugin {
  isEnabled(): Promise<{ enabled: boolean }>
  listBondedDevices(): Promise<{ devices: ClassicDevice[] }>
  connect(options: { address: string }): Promise<void>
  write(options: { data: string }): Promise<void>
  disconnect(): Promise<void>
}

const BluetoothClassic = registerPlugin<BluetoothClassicPlugin>('BluetoothClassic')

/** Bluetooth Classic only exists on Android; the web build has no equivalent. */
export function isClassicSupported(): boolean {
  return Capacitor.isNativePlatform()
}

export async function classicIsEnabled(): Promise<boolean> {
  if (!isClassicSupported()) return false
  try {
    const result = await BluetoothClassic.isEnabled()
    return result.enabled
  } catch (error) {
    console.error('[BluetoothClassicBridge] Failed to read adapter state:', error)
    return false
  }
}

export async function classicListBondedDevices(): Promise<ClassicDevice[]> {
  if (!isClassicSupported()) return []
  try {
    const result = await BluetoothClassic.listBondedDevices()
    return result.devices ?? []
  } catch (error) {
    console.error('[BluetoothClassicBridge] Failed to list bonded devices:', error)
    return []
  }
}

export async function classicConnect(address: string): Promise<void> {
  if (!isClassicSupported()) {
    throw new Error('Bluetooth Classic is only available in the Android app')
  }
  await BluetoothClassic.connect({ address })
}

export async function classicWriteBase64(data: string): Promise<void> {
  if (!isClassicSupported()) {
    throw new Error('Bluetooth Classic is only available in the Android app')
  }
  await BluetoothClassic.write({ data })
}

export async function classicDisconnect(): Promise<void> {
  if (!isClassicSupported()) return
  try {
    await BluetoothClassic.disconnect()
  } catch (error) {
    console.error('[BluetoothClassicBridge] Failed to disconnect:', error)
  }
}
