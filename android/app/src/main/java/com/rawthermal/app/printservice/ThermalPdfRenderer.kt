package com.rawthermal.app.printservice

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.util.Log
import java.io.Closeable

/**
 * PDF renderer for thermal printing
 * Uses Android's built-in PdfRenderer to convert PDF pages to bitmaps
 */
class ThermalPdfRenderer(
    private val fileDescriptor: ParcelFileDescriptor
) : Closeable {
    private val renderer: PdfRenderer = PdfRenderer(fileDescriptor)

    companion object {
        private const val TAG = "ThermalPdfRenderer"
    }

    /**
     * Get the number of pages in the PDF
     */
    val pageCount: Int
        get() = renderer.pageCount

    /**
     * Render a page at the specified target width
     * Maintains aspect ratio and uses white background
     *
     * @param pageIndex 0-based page index
     * @param targetWidth Target width in pixels (e.g., 384 for 58mm, 576 for 80mm)
     * @return Rendered bitmap
     */
    fun renderPage(pageIndex: Int, targetWidth: Int): Bitmap {
        if (pageIndex < 0 || pageIndex >= pageCount) {
            throw IllegalArgumentException("Page index $pageIndex out of range (0-${pageCount - 1})")
        }

        val page = renderer.openPage(pageIndex)

        try {
            // Calculate target height maintaining aspect ratio
            val aspectRatio = page.height.toFloat() / page.width.toFloat()
            val targetHeight = (targetWidth * aspectRatio).toInt()

            Log.d(TAG, "Rendering page $pageIndex at ${targetWidth}x$targetHeight")

            // Create bitmap with white background
            val bitmap = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(Color.WHITE)

            // Render PDF page to bitmap
            // RENDER_MODE_FOR_PRINT gives higher quality than RENDER_MODE_FOR_DISPLAY
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)

            Log.d(TAG, "Page $pageIndex rendered successfully")
            return bitmap
        } finally {
            page.close()
        }
    }

    /**
     * Render a page and convert directly to thermal format
     *
     * @param pageIndex 0-based page index
     * @param targetWidth Target width in pixels
     * @return ThermalImageData ready for printing
     */
    fun renderPageToThermal(pageIndex: Int, targetWidth: Int): ThermalImageData {
        val bitmap = renderPage(pageIndex, targetWidth)
        try {
            return ImageDithering.bitmapToThermalFormat(bitmap)
        } finally {
            bitmap.recycle()
        }
    }

    /**
     * Close the renderer and release resources
     */
    override fun close() {
        try {
            renderer.close()
        } catch (e: Exception) {
            Log.w(TAG, "Error closing renderer: ${e.message}")
        }

        try {
            fileDescriptor.close()
        } catch (e: Exception) {
            Log.w(TAG, "Error closing file descriptor: ${e.message}")
        }
    }
}
