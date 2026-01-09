package com.rawthermal.app.printservice

import java.io.ByteArrayOutputStream

/**
 * ESC/POS command encoder for thermal printers
 * Ported from TypeScript EscPosEncoder.ts
 */
class EscPosEncoder {
    private val buffer = ByteArrayOutputStream()

    companion object {
        // Control codes
        private const val ESC: Byte = 0x1B
        private const val GS: Byte = 0x1D
        private const val LF: Byte = 0x0A
        private const val NUL: Byte = 0x00

        // Alignment
        const val ALIGN_LEFT = 0
        const val ALIGN_CENTER = 1
        const val ALIGN_RIGHT = 2
    }

    /**
     * Initialize printer (reset to default state)
     */
    fun initialize(): EscPosEncoder {
        buffer.write(byteArrayOf(ESC, 0x40))
        return this
    }

    /**
     * Set text alignment
     */
    fun align(alignment: Int): EscPosEncoder {
        buffer.write(byteArrayOf(ESC, 0x61, alignment.toByte()))
        return this
    }

    /**
     * Set bold mode
     */
    fun bold(enabled: Boolean): EscPosEncoder {
        buffer.write(byteArrayOf(ESC, 0x45, if (enabled) 1 else 0))
        return this
    }

    /**
     * Set underline mode
     */
    fun underline(enabled: Boolean): EscPosEncoder {
        buffer.write(byteArrayOf(ESC, 0x2D, if (enabled) 1 else 0))
        return this
    }

    /**
     * Set double-height and double-width
     */
    fun setFontSize(doubleWidth: Boolean, doubleHeight: Boolean): EscPosEncoder {
        val mode = (if (doubleWidth) 0x20 else 0) or (if (doubleHeight) 0x10 else 0)
        buffer.write(byteArrayOf(GS, 0x21, mode.toByte()))
        return this
    }

    /**
     * Print text
     */
    fun text(content: String): EscPosEncoder {
        buffer.write(content.toByteArray(Charsets.UTF_8))
        return this
    }

    /**
     * Print text followed by newline
     */
    fun line(content: String): EscPosEncoder {
        text(content)
        newline()
        return this
    }

    /**
     * Print newline
     */
    fun newline(): EscPosEncoder {
        buffer.write(byteArrayOf(LF))
        return this
    }

    /**
     * Feed paper by specified number of lines
     */
    fun feed(lines: Int): EscPosEncoder {
        buffer.write(byteArrayOf(ESC, 0x64, minOf(lines, 255).toByte()))
        return this
    }

    /**
     * Print raster image
     * Uses GS v 0 command for raster bit image
     *
     * @param imageData 1-bit packed image data (8 pixels per byte, MSB first)
     * @param width Image width in pixels
     * @param height Image height in pixels
     */
    fun image(imageData: ByteArray, width: Int, height: Int): EscPosEncoder {
        // Calculate width in bytes (8 pixels per byte)
        val widthBytes = (width + 7) / 8

        // GS v 0 command parameters
        val xL = widthBytes and 0xFF
        val xH = (widthBytes shr 8) and 0xFF
        val yL = height and 0xFF
        val yH = (height shr 8) and 0xFF

        // GS v 0 mode xL xH yL yH [image data]
        // mode 0 = normal mode
        buffer.write(byteArrayOf(
            GS, 0x76, 0x30, 0x00,
            xL.toByte(), xH.toByte(), yL.toByte(), yH.toByte()
        ))
        buffer.write(imageData)

        return this
    }

    /**
     * Cut paper (full cut)
     */
    fun cut(): EscPosEncoder {
        buffer.write(byteArrayOf(GS, 0x56, 0x00))
        return this
    }

    /**
     * Partial cut paper
     */
    fun partialCut(): EscPosEncoder {
        buffer.write(byteArrayOf(GS, 0x56, 0x01))
        return this
    }

    /**
     * Open cash drawer
     */
    fun openCashDrawer(): EscPosEncoder {
        buffer.write(byteArrayOf(ESC, 0x70, 0x00, 0x19, 0x78))
        return this
    }

    /**
     * Beep
     */
    fun beep(times: Int = 1, duration: Int = 100): EscPosEncoder {
        val t = minOf(times, 9)
        val d = minOf(duration / 50, 9)
        buffer.write(byteArrayOf(ESC, 0x42, t.toByte(), d.toByte()))
        return this
    }

    /**
     * Set print density
     * @param density 0-7 (0=lightest, 7=darkest)
     */
    fun setDensity(density: Int): EscPosEncoder {
        val d = density.coerceIn(0, 7)
        buffer.write(byteArrayOf(GS, 0x7C, d.toByte()))
        return this
    }

    /**
     * Print horizontal rule
     */
    fun horizontalRule(char: Char = '-', width: Int = 32): EscPosEncoder {
        line(char.toString().repeat(width))
        return this
    }

    /**
     * Get encoded data as ByteArray
     */
    fun encode(): ByteArray = buffer.toByteArray()

    /**
     * Clear the buffer
     */
    fun clear(): EscPosEncoder {
        buffer.reset()
        return this
    }

    /**
     * Get current buffer size
     */
    fun size(): Int = buffer.size()
}
