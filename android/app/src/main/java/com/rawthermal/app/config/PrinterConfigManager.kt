package com.rawthermal.app.config

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

data class PrinterConfig(
    val id: String,
    val name: String,
    val type: String,
    val address: String,
    val paperWidth: Int,
    val serviceUUID: String? = null,
    val characteristicUUID: String? = null
)

data class AppSettings(
    val defaultPaperWidth: Int = 58,
    val autoCut: Boolean = true,
    val feedLinesAfterPrint: Int = 3,
    val printDensity: String = "normal"
)

data class PendingPrintJob(
    val id: String,
    val documentPath: String,
    val timestamp: Long,
    val title: String = "Print Job"
)

class PrinterConfigManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences(
        PREFS_NAME, Context.MODE_PRIVATE
    )

    companion object {
        const val PREFS_NAME = "RawThermalPrefs"
        const val KEY_SAVED_PRINTERS = "savedPrinters"
        const val KEY_CURRENT_PRINTER_ID = "currentPrinterId"
        const val KEY_APP_SETTINGS = "appSettings"
        const val KEY_PENDING_JOBS = "pendingPrintJobs"
    }

    fun getSavedPrinters(): List<PrinterConfig> {
        val printersJson = prefs.getString(KEY_SAVED_PRINTERS, "[]") ?: "[]"
        return try {
            val jsonArray = JSONArray(printersJson)
            (0 until jsonArray.length()).map { i ->
                val obj = jsonArray.getJSONObject(i)
                PrinterConfig(
                    id = obj.getString("id"),
                    name = obj.getString("name"),
                    type = obj.optString("type", "bluetooth"),
                    address = obj.getString("address"),
                    paperWidth = obj.optInt("paperWidth", 58),
                    serviceUUID = obj.optString("serviceUUID", null),
                    characteristicUUID = obj.optString("characteristicUUID", null)
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun getCurrentPrinterId(): String? {
        return prefs.getString(KEY_CURRENT_PRINTER_ID, null)
    }

    fun getCurrentPrinter(): PrinterConfig? {
        val currentId = getCurrentPrinterId() ?: return null
        return getSavedPrinters().find { it.id == currentId }
    }

    fun getAppSettings(): AppSettings {
        val settingsJson = prefs.getString(KEY_APP_SETTINGS, null) ?: return AppSettings()
        return try {
            val obj = JSONObject(settingsJson)
            AppSettings(
                defaultPaperWidth = obj.optInt("defaultPaperWidth", 58),
                autoCut = obj.optBoolean("autoCut", true),
                feedLinesAfterPrint = obj.optInt("feedLinesAfterPrint", 3),
                printDensity = obj.optString("printDensity", "normal")
            )
        } catch (e: Exception) {
            AppSettings()
        }
    }

    fun syncFromCapacitor(printersJson: JSONArray, currentPrinterId: String?, settingsJson: JSONObject?) {
        prefs.edit().apply {
            putString(KEY_SAVED_PRINTERS, printersJson.toString())
            if (currentPrinterId != null) {
                putString(KEY_CURRENT_PRINTER_ID, currentPrinterId)
            } else {
                remove(KEY_CURRENT_PRINTER_ID)
            }
            if (settingsJson != null) {
                putString(KEY_APP_SETTINGS, settingsJson.toString())
            }
            apply()
        }
    }

    fun getSavedPrintersJson(): JSONArray {
        val printersJson = prefs.getString(KEY_SAVED_PRINTERS, "[]") ?: "[]"
        return try {
            JSONArray(printersJson)
        } catch (e: Exception) {
            JSONArray()
        }
    }

    fun savePrinter(config: PrinterConfig) {
        val printers = getSavedPrinters().toMutableList()
        val existingIndex = printers.indexOfFirst { it.id == config.id }
        if (existingIndex >= 0) {
            printers[existingIndex] = config
        } else {
            printers.add(config)
        }
        savePrintersList(printers)
    }

    fun setCurrentPrinter(printerId: String?) {
        prefs.edit().apply {
            if (printerId != null) {
                putString(KEY_CURRENT_PRINTER_ID, printerId)
            } else {
                remove(KEY_CURRENT_PRINTER_ID)
            }
            apply()
        }
    }

    private fun savePrintersList(printers: List<PrinterConfig>) {
        val jsonArray = JSONArray()
        printers.forEach { config ->
            val obj = JSONObject().apply {
                put("id", config.id)
                put("name", config.name)
                put("type", config.type)
                put("address", config.address)
                put("paperWidth", config.paperWidth)
                config.serviceUUID?.let { put("serviceUUID", it) }
                config.characteristicUUID?.let { put("characteristicUUID", it) }
            }
            jsonArray.put(obj)
        }
        prefs.edit().putString(KEY_SAVED_PRINTERS, jsonArray.toString()).apply()
    }

    // Pending Print Job Management

    fun getPendingJobs(): List<PendingPrintJob> {
        val jobsJson = prefs.getString(KEY_PENDING_JOBS, "[]") ?: "[]"
        return try {
            val jsonArray = JSONArray(jobsJson)
            (0 until jsonArray.length()).map { i ->
                val obj = jsonArray.getJSONObject(i)
                PendingPrintJob(
                    id = obj.getString("id"),
                    documentPath = obj.getString("documentPath"),
                    timestamp = obj.getLong("timestamp"),
                    title = obj.optString("title", "Print Job")
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun savePendingJob(job: PendingPrintJob) {
        val jobs = getPendingJobs().toMutableList()
        // Remove existing job with same ID if any
        jobs.removeAll { it.id == job.id }
        jobs.add(job)
        savePendingJobsList(jobs)
    }

    fun removePendingJob(jobId: String) {
        val jobs = getPendingJobs().toMutableList()
        jobs.removeAll { it.id == jobId }
        savePendingJobsList(jobs)
    }

    fun clearPendingJobs() {
        prefs.edit().remove(KEY_PENDING_JOBS).apply()
    }

    fun hasPendingJobs(): Boolean {
        return getPendingJobs().isNotEmpty()
    }

    private fun savePendingJobsList(jobs: List<PendingPrintJob>) {
        val jsonArray = JSONArray()
        jobs.forEach { job ->
            val obj = JSONObject().apply {
                put("id", job.id)
                put("documentPath", job.documentPath)
                put("timestamp", job.timestamp)
                put("title", job.title)
            }
            jsonArray.put(obj)
        }
        prefs.edit().putString(KEY_PENDING_JOBS, jsonArray.toString()).apply()
    }
}
