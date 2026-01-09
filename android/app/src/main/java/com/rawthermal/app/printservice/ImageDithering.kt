package com.rawthermal.app.printservice

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint

/**
 * Data class for thermal printer image format
 * @param data 1-bit packed image data (8 pixels per byte, MSB first)
 * @param width Image width in pixels
 * @param height Image height in pixels
 */
data class ThermalImageData(
    val data: ByteArray,
    val width: Int,
    val height: Int
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as ThermalImageData
        return data.contentEquals(other.data) && width == other.width && height == other.height
    }

    override fun hashCode(): Int {
        var result = data.contentHashCode()
        result = 31 * result + width
        result = 31 * result + height
        return result
    }
}

/**
 * Image processing utilities for thermal printers
 * Implements Floyd-Steinberg dithering for high-quality 1-bit conversion
 */
object ImageDithering {

    /**
     * Convert Bitmap to 1-bit thermal printer format using Floyd-Steinberg dithering
     * Ported from TypeScript FileService.ts
     *
     * @param bitmap Input bitmap (any color format)
     * @return ThermalImageData with 1-bit packed data
     */
    fun bitmapToThermalFormat(bitmap: Bitmap): ThermalImageData {
        val width = bitmap.width
        val height = bitmap.height

        // Convert to grayscale float array for error diffusion
        val grayscale = FloatArray(width * height)

        for (y in 0 until height) {
            for (x in 0 until width) {
                val pixel = bitmap.getPixel(x, y)
                val r = Color.red(pixel)
                val g = Color.green(pixel)
                val b = Color.blue(pixel)

                // Luminance formula (same as TypeScript version)
                grayscale[y * width + x] = 0.299f * r + 0.587f * g + 0.114f * b
            }
        }

        // Floyd-Steinberg dithering
        val threshold = 128f

        for (y in 0 until height) {
            for (x in 0 until width) {
                val idx = y * width + x
                val oldPixel = grayscale[idx]
                val newPixel = if (oldPixel < threshold) 0f else 255f
                grayscale[idx] = newPixel

                val error = oldPixel - newPixel

                // Distribute error to neighbors using Floyd-Steinberg weights:
                // [   *    7/16 ]
                // [ 3/16  5/16  1/16 ]

                // Right neighbor (7/16)
                if (x + 1 < width) {
                    grayscale[idx + 1] += error * 7f / 16f
                }

                // Bottom row
                if (y + 1 < height) {
                    val nextRowBase = (y + 1) * width

                    // Bottom-left (3/16)
                    if (x > 0) {
                        grayscale[nextRowBase + (x - 1)] += error * 3f / 16f
                    }

                    // Bottom center (5/16)
                    grayscale[nextRowBase + x] += error * 5f / 16f

                    // Bottom-right (1/16)
                    if (x + 1 < width) {
                        grayscale[nextRowBase + (x + 1)] += error * 1f / 16f
                    }
                }
            }
        }

        // Convert to packed 1-bit format (8 pixels per byte)
        // For thermal printers: 1 = black (print), 0 = white (no print)
        val widthBytes = (width + 7) / 8
        val output = ByteArray(widthBytes * height)

        for (y in 0 until height) {
            for (x in 0 until width) {
                val idx = y * width + x
                val byteIdx = y * widthBytes + x / 8
                val bitIdx = 7 - (x % 8) // MSB first

                // Black pixels (grayscale < 128) should be printed (bit = 1)
                if (grayscale[idx] < 128f) {
                    output[byteIdx] = (output[byteIdx].toInt() or (1 shl bitIdx)).toByte()
                }
            }
        }

        return ThermalImageData(output, width, height)
    }

    /**
     * Resize bitmap to target width while maintaining aspect ratio
     *
     * @param bitmap Source bitmap
     * @param targetWidth Target width in pixels
     * @return Resized bitmap
     */
    fun resizeBitmap(bitmap: Bitmap, targetWidth: Int): Bitmap {
        val aspectRatio = bitmap.height.toFloat() / bitmap.width.toFloat()
        val targetHeight = (targetWidth * aspectRatio).toInt()

        return Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
    }

    /**
     * Create a bitmap with white background from source bitmap
     * Useful for images with transparency
     *
     * @param bitmap Source bitmap (may have transparency)
     * @return Bitmap with white background
     */
    fun ensureWhiteBackground(bitmap: Bitmap): Bitmap {
        val result = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(result)

        // Draw white background
        canvas.drawColor(Color.WHITE)

        // Draw original bitmap on top
        canvas.drawBitmap(bitmap, 0f, 0f, null)

        return result
    }

    /**
     * Convert bitmap to grayscale (optional preprocessing step)
     *
     * @param bitmap Source bitmap
     * @return Grayscale bitmap
     */
    fun toGrayscale(bitmap: Bitmap): Bitmap {
        val result = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(result)

        val paint = Paint()
        val colorMatrix = ColorMatrix()
        colorMatrix.setSaturation(0f)
        paint.colorFilter = ColorMatrixColorFilter(colorMatrix)

        canvas.drawBitmap(bitmap, 0f, 0f, paint)

        return result
    }

    /**
     * Apply contrast adjustment (optional preprocessing)
     *
     * @param bitmap Source bitmap
     * @param contrast Contrast factor (1.0 = no change, >1 = more contrast)
     * @return Adjusted bitmap
     */
    fun adjustContrast(bitmap: Bitmap, contrast: Float): Bitmap {
        val result = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(result)

        val scale = contrast
        val translate = (-.5f * scale + .5f) * 255f

        val colorMatrix = ColorMatrix(floatArrayOf(
            scale, 0f, 0f, 0f, translate,
            0f, scale, 0f, 0f, translate,
            0f, 0f, scale, 0f, translate,
            0f, 0f, 0f, 1f, 0f
        ))

        val paint = Paint()
        paint.colorFilter = ColorMatrixColorFilter(colorMatrix)

        canvas.drawBitmap(bitmap, 0f, 0f, paint)

        return result
    }
}
