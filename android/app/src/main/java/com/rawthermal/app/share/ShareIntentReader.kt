package com.rawthermal.app.share

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import android.util.Log
import androidx.core.content.IntentCompat
import java.io.ByteArrayOutputStream

/**
 * Turns an incoming share/view intent into a [SharedIntentPayload].
 *
 * NOTE: this file has not been compiled. The machine this was written on has only JDK 8/12
 * while Capacitor 8 requires JDK 17+, and compileSdk 35 is not installed. See
 * docs/plans/2026-09-29-rawbt-parity-analysis.md.
 */
object ShareIntentReader {

    private const val TAG = "ShareIntentReader"

    /**
     * Upper bound for a shared file. Everything is read into memory and then base64 encoded
     * (~1.33x), so an unbounded read of a large PDF would be an out-of-memory crash rather
     * than a failed print.
     */
    private const val MAX_FILE_BYTES = 25 * 1024 * 1024

    fun read(context: Context, intent: Intent?): SharedIntentPayload? {
        if (intent == null) return null

        return when (intent.action) {
            Intent.ACTION_SEND -> readSend(context, intent)
            Intent.ACTION_VIEW -> readUri(context, intent.data, intent.type)
            else -> null
        }
    }

    private fun readSend(context: Context, intent: Intent): SharedIntentPayload? {
        // A share carrying both text and a stream is a file share whose text is only a
        // description, so the stream wins. The TypeScript side makes the same choice.
        val stream = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
        if (stream != null) {
            val fromStream = readUri(context, stream, intent.type)
            if (fromStream != null) return fromStream
        }

        val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
        if (text.isNullOrEmpty()) return null

        return SharedIntentPayload(
            text = text,
            name = intent.getStringExtra(Intent.EXTRA_SUBJECT),
            mimeType = intent.type ?: "text/plain"
        )
    }

    private fun readUri(context: Context, uri: Uri?, mimeType: String?): SharedIntentPayload? {
        if (uri == null) return null

        val bytes = readBytes(context, uri) ?: return null

        return SharedIntentPayload(
            name = displayName(context, uri),
            mimeType = mimeType ?: context.contentResolver.getType(uri) ?: "application/octet-stream",
            // NO_WRAP keeps the string free of newlines; the TS parser tolerates them anyway.
            base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
        )
    }

    private fun readBytes(context: Context, uri: Uri): ByteArray? {
        return try {
            context.contentResolver.openInputStream(uri)?.use { input ->
                val buffer = ByteArrayOutputStream()
                val chunk = ByteArray(16 * 1024)
                var total = 0

                while (true) {
                    val read = input.read(chunk)
                    if (read <= 0) break

                    total += read
                    if (total > MAX_FILE_BYTES) {
                        Log.w(TAG, "Shared file exceeds $MAX_FILE_BYTES bytes, ignoring")
                        return null
                    }
                    buffer.write(chunk, 0, read)
                }

                buffer.toByteArray()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read shared file: ${e.message}", e)
            null
        }
    }

    /**
     * The sender's file name, when the content provider exposes one. Without it the TS side
     * derives a name from the MIME type.
     */
    private fun displayName(context: Context, uri: Uri): String? {
        return try {
            context.contentResolver
                .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { cursor ->
                    val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (index >= 0 && cursor.moveToFirst()) cursor.getString(index) else null
                }
        } catch (e: Exception) {
            Log.w(TAG, "Could not read display name: ${e.message}")
            null
        }
    }
}
