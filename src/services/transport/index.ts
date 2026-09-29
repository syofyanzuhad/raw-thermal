import type { TransportKind } from '@/types/printer'
import { BleTransport } from './BleTransport'
import { ClassicSppTransport } from './ClassicSppTransport'
import type { PrinterTransport } from './PrinterTransport'

/**
 * Lazily created singletons, mirroring the existing `getBluetoothService()` pattern so that
 * importing this module has no side effects (no plugin registration, no BLE client setup).
 */
let bleInstance: BleTransport | null = null
let classicInstance: ClassicSppTransport | null = null

export function getBleTransport(): BleTransport {
  if (!bleInstance) {
    bleInstance = new BleTransport()
  }
  return bleInstance
}

export function getClassicTransport(): ClassicSppTransport {
  if (!classicInstance) {
    classicInstance = new ClassicSppTransport()
  }
  return classicInstance
}

export function getTransport(kind: TransportKind): PrinterTransport {
  return kind === 'classic' ? getClassicTransport() : getBleTransport()
}

/**
 * The transport the current printer is connected over.
 *
 * Printing code only needs `write()`, so it reads the active transport instead of having to
 * know which radio is in play.
 */
let activeTransport: PrinterTransport | null = null

export function setActiveTransport(transport: PrinterTransport | null): void {
  activeTransport = transport
}

export function getActiveTransport(): PrinterTransport | null {
  return activeTransport
}
