package com.rawthermal.app.plugin

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.rawthermal.app.config.PrinterConfigManager
import org.json.JSONArray
import org.json.JSONObject

@CapacitorPlugin(name = "PrinterConfig")
class PrinterConfigPlugin : Plugin() {

    private lateinit var configManager: PrinterConfigManager

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
}
