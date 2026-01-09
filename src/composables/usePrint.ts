import { ref } from 'vue'
import { usePrinterStore } from '@/stores/printer'
import { useSettingsStore } from '@/stores/settings'
import { useBluetoothService } from './useBluetooth'
import { EscPosEncoder, createEncoder } from '@/services/escpos/EscPosEncoder'
import type { Alignment } from '@/services/escpos/EscPosEncoder'

export interface PrintTextOptions {
  align?: Alignment
  bold?: boolean
  underline?: boolean
  doubleSize?: boolean
}

export function usePrintService() {
  const printerStore = usePrinterStore()
  const settingsStore = useSettingsStore()
  const { write } = useBluetoothService()

  const isPrinting = ref(false)

  /**
   * Send raw ESC/POS data to printer
   */
  async function printRaw(data: Uint8Array): Promise<void> {
    if (!printerStore.isConnected) {
      throw new Error('No printer connected')
    }

    isPrinting.value = true
    try {
      await write(data)
    } finally {
      isPrinting.value = false
    }
  }

  /**
   * Print text with formatting options
   */
  async function printText(text: string, options: PrintTextOptions = {}): Promise<void> {
    const encoder = createEncoder()

    encoder.initialize()

    // Apply alignment
    if (options.align) {
      encoder.align(options.align)
    }

    // Apply formatting
    if (options.bold) {
      encoder.bold(true)
    }

    if (options.underline) {
      encoder.underline(true)
    }

    if (options.doubleSize) {
      encoder.setFontSize('double')
    }

    // Print the text
    encoder.line(text)

    // Reset formatting
    encoder.bold(false)
    encoder.underline(false)
    encoder.setFontSize('normal')
    encoder.align('left')

    // Feed lines based on settings
    encoder.feed(settingsStore.settings.feedLinesAfterPrint)

    // Cut if enabled
    if (settingsStore.settings.autoCut) {
      encoder.cut()
    }

    await printRaw(encoder.encode())
  }

  /**
   * Print a test page
   */
  async function printTestPage(): Promise<void> {
    const encoder = createEncoder()
    const paperWidth = printerStore.currentPrinter?.paperWidth ?? settingsStore.settings.defaultPaperWidth
    const lineWidth = paperWidth === 58 ? 32 : 48

    encoder
      .initialize()
      .align('center')
      .setFontSize('double')
      .bold(true)
      .line('Raw Thermal')
      .setFontSize('normal')
      .bold(false)
      .line('Test Print')
      .horizontalRule('=', lineWidth)
      .newline()
      .align('left')
      .line('Normal text')
      .bold(true)
      .line('Bold text')
      .bold(false)
      .underline(true)
      .line('Underlined text')
      .underline(false)
      .newline()
      .setFontSize('double-height')
      .line('Double Height')
      .setFontSize('double-width')
      .line('Double Width')
      .setFontSize('double')
      .line('Double Size')
      .setFontSize('normal')
      .newline()
      .align('left')
      .line('Left aligned')
      .align('center')
      .line('Center aligned')
      .align('right')
      .line('Right aligned')
      .align('left')
      .newline()
      .horizontalRule('-', lineWidth)
      .keyValue('Item 1', '$10.00', lineWidth)
      .keyValue('Item 2', '$25.50', lineWidth)
      .keyValue('Item 3', '$5.25', lineWidth)
      .horizontalRule('-', lineWidth)
      .bold(true)
      .keyValue('TOTAL', '$40.75', lineWidth)
      .bold(false)
      .newline()
      .align('center')
      .line(new Date().toLocaleString())
      .newline()
      .line('Printer is working!')
      .newline()
      .feed(settingsStore.settings.feedLinesAfterPrint)

    if (settingsStore.settings.autoCut) {
      encoder.cut()
    }

    await printRaw(encoder.encode())
  }

  /**
   * Print a receipt template
   */
  async function printReceipt(options: {
    header: string
    subheader?: string
    items: Array<{ name: string; price: string }>
    total: string
    footer?: string
  }): Promise<void> {
    const encoder = createEncoder()
    const paperWidth = printerStore.currentPrinter?.paperWidth ?? settingsStore.settings.defaultPaperWidth
    const lineWidth = paperWidth === 58 ? 32 : 48

    encoder
      .initialize()
      .header(options.header, options.subheader)
      .newline()

    // Print items
    for (const item of options.items) {
      encoder.keyValue(item.name, item.price, lineWidth)
    }

    encoder
      .horizontalRule('-', lineWidth)
      .bold(true)
      .keyValue('TOTAL', options.total, lineWidth)
      .bold(false)
      .newline()

    if (options.footer) {
      encoder.align('center').line(options.footer).align('left')
    }

    encoder.feed(settingsStore.settings.feedLinesAfterPrint)

    if (settingsStore.settings.autoCut) {
      encoder.cut()
    }

    await printRaw(encoder.encode())
  }

  /**
   * Print a QR code
   */
  async function printQRCode(content: string, size: number = 6): Promise<void> {
    const encoder = createEncoder()

    encoder
      .initialize()
      .align('center')
      .qrcode(content, size)
      .newline()
      .feed(settingsStore.settings.feedLinesAfterPrint)

    if (settingsStore.settings.autoCut) {
      encoder.cut()
    }

    await printRaw(encoder.encode())
  }

  /**
   * Print a barcode
   */
  async function printBarcode(content: string, type: 'CODE128' | 'EAN13' | 'CODE39' = 'CODE128'): Promise<void> {
    const encoder = createEncoder()

    encoder
      .initialize()
      .align('center')
      .barcode(content, type)
      .newline()
      .feed(settingsStore.settings.feedLinesAfterPrint)

    if (settingsStore.settings.autoCut) {
      encoder.cut()
    }

    await printRaw(encoder.encode())
  }

  /**
   * Get an encoder for custom printing
   */
  function getEncoder(): EscPosEncoder {
    return createEncoder()
  }

  return {
    isPrinting,
    printRaw,
    printText,
    printTestPage,
    printReceipt,
    printQRCode,
    printBarcode,
    getEncoder
  }
}
