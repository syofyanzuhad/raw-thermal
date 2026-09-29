package com.rawthermal.app.plugin

import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.rawthermal.app.config.PendingPrintJob
import com.rawthermal.app.config.PrinterConfigManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

@CapacitorPlugin(name = "PrinterConfig")
class PrinterConfigPlugin : Plugin() {

    private lateinit var configManager: PrinterConfigManager

    /**
     * Reading a queued PDF means file IO, so it must not run on the main thread: a multi-MB
     * document would ANR the app.
     */
    private val ioScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun load() {
        configManager = PrinterConfigManager(context)
    }

    @PluginMethod
    fun syncPrinterConfig(call: PluginCall) {
        try {
            val printersArray = call.getArray("printers") ?: JSONArray()
            val currentPrinterId = call.getString("currentPrinterId")
            val settingsObj = call.getObject("settings")

            configManager.syncFromCapacitor(
                printersJson = printersArray,
                currentPrinterId = currentPrinterId,
                settingsJson = settingsObj
            )

            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to sync config: ${e.message}")
        }
    }

    @PluginMethod
    fun getPrinterConfig(call: PluginCall) {
        try {
            val result = JSObject()
            result.put("printers", configManager.getSavedPrintersJson())
            result.put("currentPrinterId", configManager.getCurrentPrinterId())
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to get config: ${e.message}")
        }
    }

    @PluginMethod
    fun setCurrentPrinter(call: PluginCall) {
        try {
            val printerId = call.getString("printerId")
            configManager.setCurrentPrinter(printerId)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to set current printer: ${e.message}")
        }
    }

    @PluginMethod
    fun hasPrinterConfigured(call: PluginCall) {
        try {
            val currentPrinter = configManager.getCurrentPrinter()
            val result = JSObject()
            result.put("configured", currentPrinter != null)
            result.put("printerName", currentPrinter?.name)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to check config: ${e.message}")
        }
    }

    @PluginMethod
    fun hasPendingPrintJobs(call: PluginCall) {
        try {
            val pendingJobs = configManager.getPendingJobs()
            val result = JSObject()
            result.put("hasPending", pendingJobs.isNotEmpty())
            result.put("count", pendingJobs.size)

            val jobsArray = JSONArray()
            pendingJobs.forEach { job ->
                val jobObj = JSONObject().apply {
                    put("id", job.id)
                    put("title", job.title)
                    put("timestamp", job.timestamp)
                }
                jobsArray.put(jobObj)
            }
            result.put("jobs", jobsArray)

            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to check pending jobs: ${e.message}")
        }
    }

    @PluginMethod
    fun clearPendingPrintJobs(call: PluginCall) {
        try {
            configManager.clearPendingJobs()
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to clear pending jobs: ${e.message}")
        }
    }

    @PluginMethod
    fun getPendingJobDocumentPath(call: PluginCall) {
        try {
            val jobId = call.getString("jobId")
                ?: return call.reject("Job ID is required")

            val pendingJobs = configManager.getPendingJobs()
            val job = pendingJobs.find { it.id == jobId }

            if (job != null) {
                val result = JSObject()
                result.put("path", job.documentPath)
                result.put("title", job.title)
                call.resolve(result)
            } else {
                call.reject("Job not found: $jobId")
            }
        } catch (e: Exception) {
            call.reject("Failed to get job path: ${e.message}")
        }
    }

    @PluginMethod
    fun removePendingPrintJob(call: PluginCall) {
        try {
            val jobId = call.getString("jobId")
                ?: return call.reject("Job ID is required")

            configManager.removePendingJob(jobId)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to remove job: ${e.message}")
        }
    }

    /**
     * The queued document itself, base64 encoded.
     *
     * ThermalPrintService saves the blocked job as a PDF in the cache directory and keeps only
     * the path, which the web layer cannot open — it has no filesystem access. This hands over
     * the bytes so the existing in-app print pipeline can render and print them.
     */
    @PluginMethod
    fun getPendingJobData(call: PluginCall) {
        val jobId = call.getString("jobId")
        if (jobId.isNullOrBlank()) {
            call.reject("Job ID is required")
            return
        }

        val job = configManager.getPendingJobs().find { it.id == jobId }
        if (job == null) {
            call.reject("Job not found: $jobId")
            return
        }

        ioScope.launch {
            var payload: JSObject? = null
            var failure: String? = null

            try {
                val file = File(job.documentPath)
                when {
                    !file.exists() -> failure = "Queued document is no longer available"
                    file.length() > MAX_JOB_BYTES -> failure = "Queued document is too large to print"
                    else -> payload = encodeJob(job, file.readBytes())
                }
            } catch (e: Exception) {
                failure = "Failed to read queued document: ${e.message}"
            }

            // PluginCall must be resolved on the main thread.
            withContext(Dispatchers.Main) {
                val value = payload
                val error = failure
                if (value != null) {
                    call.resolve(value)
                } else {
                    call.reject(error ?: "Failed to read queued document")
                }
            }
        }
    }

    private fun encodeJob(job: PendingPrintJob, bytes: ByteArray): JSObject {
        val result = JSObject()
        // The title is the print framework's document label (e.g. "document.pdf"), which the
        // web layer uses as the file name; the MIME type is always PDF because that is what
        // ThermalPrintService writes to the cache.
        result.put("title", job.title)
        result.put("mimeType", "application/pdf")
        result.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
        return result
    }

    override fun handleOnDestroy() {
        ioScope.cancel()
        super.handleOnDestroy()
    }

    companion object {
        /** Matches ShareIntentReader's ceiling: the payload is base64'd, so it grows ~33%. */
        private const val MAX_JOB_BYTES = 25L * 1024 * 1024
    }
}
