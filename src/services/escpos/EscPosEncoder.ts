/**
 * ESC/POS Encoder for thermal printer commands
 * Reference: https://reference.epson-biz.com/modules/ref_escpos/index.php
 */

export type Alignment = 'left' | 'center' | 'right'
export type FontSize = 'normal' | 'double-height' | 'double-width' | 'double'
export type BarcodeType = 'UPC-A' | 'UPC-E' | 'EAN13' | 'EAN8' | 'CODE39' | 'ITF' | 'CODABAR' | 'CODE93' | 'CODE128'

// ESC/POS Command Constants
const ESC = 0x1B
const GS = 0x1D
const LF = 0x0A

export class EscPosEncoder {
  private buffer: number[] = []

  constructor(_encoding: string = 'utf-8') {
    // Encoding parameter reserved for future charset support
  }

  /**
   * Initialize the printer (ESC @)
   */
  initialize(): this {
    this.buffer.push(ESC, 0x40)
    return this
  }

  /**
   * Set text alignment (ESC a n)
   */
  align(alignment: Alignment): this {
    const alignMap: Record<Alignment, number> = {
      'left': 0,
      'center': 1,
      'right': 2
    }
    this.buffer.push(ESC, 0x61, alignMap[alignment])
    return this
  }

  /**
   * Enable/disable bold text (ESC E n)
   */
  bold(enabled: boolean = true): this {
    this.buffer.push(ESC, 0x45, enabled ? 1 : 0)
    return this
  }

  /**
   * Enable/disable underline (ESC - n)
   */
  underline(enabled: boolean = true): this {
    this.buffer.push(ESC, 0x2D, enabled ? 1 : 0)
    return this
  }

  /**
   * Set font size (GS ! n)
   */
  setFontSize(size: FontSize): this {
    const sizeMap: Record<FontSize, number> = {
      'normal': 0x00,
      'double-height': 0x01,
      'double-width': 0x10,
      'double': 0x11
    }
    this.buffer.push(GS, 0x21, sizeMap[size])
    return this
  }

  /**
   * Print text and convert to bytes
   */
  text(content: string): this {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(content)
    this.buffer.push(...bytes)
    return this
  }

  /**
   * Add newline (LF)
   */
  newline(): this {
    this.buffer.push(LF)
    return this
  }

  /**
   * Print text with newline
   */
  line(content: string): this {
    return this.text(content).newline()
  }

  /**
   * Feed n lines (ESC d n)
   */
  feed(lines: number = 1): this {
    this.buffer.push(ESC, 0x64, Math.min(lines, 255))
    return this
  }

  /**
   * Cut paper - full cut (GS V 0)
   */
  cut(): this {
    this.buffer.push(GS, 0x56, 0x00)
    return this
  }

  /**
   * Cut paper - partial cut (GS V 1)
   */
  partialCut(): this {
    this.buffer.push(GS, 0x56, 0x01)
    return this
  }

  /**
   * Print raster image (GS v 0)
   * @param imageData - Binary image data (1-bit per pixel)
   * @param width - Image width in pixels
   * @param height - Image height in pixels
   */
  image(imageData: Uint8Array, width: number, height: number): this {
    const widthBytes = Math.ceil(width / 8)
    const xL = widthBytes & 0xFF
    const xH = (widthBytes >> 8) & 0xFF
    const yL = height & 0xFF
    const yH = (height >> 8) & 0xFF

    // GS v 0 mode xL xH yL yH [image data]
    this.buffer.push(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH)
    this.buffer.push(...imageData)
    return this
  }

  /**
   * Print QR Code (GS ( k)
   */
  qrcode(content: string, size: number = 6): this {
    const data = new TextEncoder().encode(content)
    const pL = (data.length + 3) & 0xFF
    const pH = ((data.length + 3) >> 8) & 0xFF

    // Set QR code model
    this.buffer.push(GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)

    // Set QR code size
    this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, Math.min(size, 16))

    // Set QR code error correction level (L)
    this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30)

    // Store QR code data
    this.buffer.push(GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30, ...data)

    // Print QR code
    this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30)

    return this
  }

  /**
   * Print barcode (GS k)
   */
  barcode(content: string, type: BarcodeType = 'CODE128', height: number = 80): this {
    const typeMap: Record<BarcodeType, number> = {
      'UPC-A': 65,
      'UPC-E': 66,
      'EAN13': 67,
      'EAN8': 68,
      'CODE39': 69,
      'ITF': 70,
      'CODABAR': 71,
      'CODE93': 72,
      'CODE128': 73
    }

    const data = new TextEncoder().encode(content)

    // Set barcode height (GS h n)
    this.buffer.push(GS, 0x68, Math.min(height, 255))

    // Set barcode width (GS w n)
    this.buffer.push(GS, 0x77, 2) // 2 = medium width

    // Set HRI position (GS H n) - below barcode
    this.buffer.push(GS, 0x48, 2)

    // Print barcode (GS k m n d1...dn)
    this.buffer.push(GS, 0x6B, typeMap[type], data.length, ...data)

    return this
  }

  /**
   * Open cash drawer (ESC p m t1 t2)
   */
  openCashDrawer(pin: 0 | 1 = 0): this {
    this.buffer.push(ESC, 0x70, pin, 25, 250)
    return this
  }

  /**
   * Beep (ESC B n t) - if supported
   */
  beep(times: number = 1, duration: number = 3): this {
    this.buffer.push(ESC, 0x42, Math.min(times, 9), Math.min(duration, 9))
    return this
  }

  /**
   * Set print density (GS | n)
   */
  density(level: 'light' | 'normal' | 'dark'): this {
    const densityMap = {
      'light': 0xF8,
      'normal': 0x00,
      'dark': 0x08
    } as const
    // Note: This command varies by printer model
    this.buffer.push(GS, 0x7C, densityMap[level])
    return this
  }

  /**
   * Create a horizontal rule
   */
  horizontalRule(char: string = '-', width: number = 32): this {
    return this.line(char.repeat(width))
  }

  /**
   * Print a receipt header
   */
  header(title: string, subtitle?: string): this {
    this.align('center')
      .setFontSize('double')
      .bold(true)
      .line(title)
      .setFontSize('normal')
      .bold(false)

    if (subtitle) {
      this.line(subtitle)
    }

    return this.horizontalRule().align('left')
  }

  /**
   * Print a key-value pair
   */
  keyValue(key: string, value: string, width: number = 32): this {
    const spaces = width - key.length - value.length
    const padding = spaces > 0 ? ' '.repeat(spaces) : ' '
    return this.line(`${key}${padding}${value}`)
  }

  /**
   * Clear the buffer
   */
  clear(): this {
    this.buffer = []
    return this
  }

  /**
   * Get the buffer as Uint8Array
   */
  encode(): Uint8Array {
    return new Uint8Array(this.buffer)
  }

  /**
   * Get buffer length
   */
  get length(): number {
    return this.buffer.length
  }
}

// Factory function for convenience
export function createEncoder(encoding?: string): EscPosEncoder {
  return new EscPosEncoder(encoding)
}
