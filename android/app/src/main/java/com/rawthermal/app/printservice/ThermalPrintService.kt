package com.rawthermal.app.printservice

import android.content.Intent
import android.print.PrinterId
import android.printservice.PrintDocument
import android.printservice.PrintJob
import android.printservice.PrintService
import android.printservice.PrinterDiscoverySession
import android.util.Log
import com.rawthermal.app.MainActivity
import com.rawthermal.app.bluetooth.BluetoothPrinterManager
import com.rawthermal.app.config.PendingPrintJob
import com.rawthermal.app.config.PrinterConfig
import com.rawthermal.app.config.PrinterConfigManager
import kotlinx.coroutines.*
import java.io.File
import java.io.FileOutputStream

/**
 * Android Print Service for thermal printers
 *
 * This service allows printing from any Android app to a configured thermal printer.
 * It receives print jobs from the Android print framework, renders them to bitmap,
 * converts to thermal format, and sends via Bluetooth.
 */
class ThermalPrintService : PrintService() {

    companion object {
        private const val TAG = "ThermalPrintService"

        // Paper width in dots (8 dots/mm for 203 DPI printers)
        private const val PAPER_WIDTH_58MM = 384  // 48mm printable * 8 dots/mm
        private const val PAPER_WIDTH_80MM = 576  // 72mm printable * 8 dots/mm
    }

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private lateinit var configManager: PrinterConfigManager
    private val bluetoothManager by lazy { BluetoothPrinterManager(this) }

    override fun onCreate() {
        super.onCreate()
        configManager = PrinterConfigManager(this)
        Log.d(TAG, "ThermalPrintService created")
    }

    override fun onCreatePrinterDiscoverySession(): PrinterDiscoverySession {
        Log.d(TAG, "Creating printer discovery session")
        return ThermalPrinterDiscoverySession(this, configManager)
    }

    override fun onRequestCancelPrintJob(printJob: PrintJob) {
        Log.d(TAG, "Cancel requested for job: ${printJob.id}")
        printJob.cancel()
    }

    override fun onPrintJobQueued(printJob: PrintJob) {
        Log.d(TAG, "Print job queued: ${printJob.id}")

        scope.launch {
            val currentPrinter = configManager.getCurrentPrinter()

            if (currentPrinter != null) {
                // Printer is configured - print directly
                processPrintJob(printJob, currentPrinter)
            } else {
                // No printer configured - save job and open app
                savePendingJob(printJob)
                openAppForPrinterSetup()
            }
        }
    }

    /**
     * Save print job to pending queue and block it
     */
    private suspend fun savePendingJob(printJob: PrintJob) {
        try {
            // Get PrintJob info on main thread
            val jobId = printJob.id.toString()
            val jobTitle = printJob.info.label ?: "Print Job"
            val document = printJob.document
            val fd = document.data

            if (fd == null) {
                Log.e(TAG, "No document data to save")
                printJob.fail("No document data")
                return
            }

            // Do file IO on IO dispatcher
            val tempFilePath = withContext(Dispatchers.IO) {
                val tempFile = File(cacheDir, "pending_job_${jobId}.pdf")
                fd.use { pfd ->
                    val inputStream = android.os.ParcelFileDescriptor.AutoCloseInputStream(pfd)
                    FileOutputStream(tempFile).use { outputStream ->
                        inputStream.copyTo(outputStream)
                    }
                }
                tempFile.absolutePath
            }

            // Save job metadata
            val pendingJob = PendingPrintJob(
                id = jobId,
                documentPath = tempFilePath,
                timestamp = System.currentTimeMillis(),
                title = jobTitle
            )
            configManager.savePendingJob(pendingJob)

            Log.d(TAG, "Saved pending job: ${pendingJob.id} to ${pendingJob.documentPath}")

            // Block the job (keeps it in queue without failing) - must be on main thread
            printJob.block("Waiting for printer setup")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to save pending job: ${e.message}", e)
            printJob.fail("Failed to queue job: ${e.message}")
        }
    }

    /**
     * Open the app for printer setup
     */
    private fun openAppForPrinterSetup() {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("action", "SETUP_PRINTER_FOR_PRINT")
        }
        startActivity(intent)
        Log.d(TAG, "Opened app for printer setup")
    }

    /**
     * Process a queued print job with a specific printer
     */
    private suspend fun processPrintJob(printJob: PrintJob, printerConfig: PrinterConfig) {
        // Get PrintJob info on main thread
        val jobId = printJob.id.toString()
        Log.d(TAG, "Processing print job: $jobId")

        // Start the job - must be on main thread
        printJob.start()

        try {
            val settings = configManager.getAppSettings()

            // Calculate paper width in dots
            val paperWidth = if (settings.defaultPaperWidth == 58) {
                PAPER_WIDTH_58MM
            } else {
                PAPER_WIDTH_80MM
            }

            Log.d(TAG, "Using printer: ${printerConfig.name}, paper width: ${settings.defaultPaperWidth}mm ($paperWidth dots)")

            // Get document data on main thread
            val document = printJob.document
            val fd = document.data
                ?: throw Exception("No document data")

            // Do all IO operations on IO dispatcher
            withContext(Dispatchers.IO) {
                // Check Bluetooth
                if (!bluetoothManager.isBluetoothEnabled()) {
                    throw Exception("Bluetooth is disabled")
                }

                // Connect to printer
                Log.d(TAG, "Connecting to printer: ${printerConfig.address}")
                bluetoothManager.connect(printerConfig.address).getOrThrow()

                try {
                    // Process the PDF
                    fd.use { pfd ->
                        val pdfRenderer = ThermalPdfRenderer(pfd)

                        Log.d(TAG, "PDF has ${pdfRenderer.pageCount} pages")

                        pdfRenderer.use {
                            for (pageIndex in 0 until pdfRenderer.pageCount) {
                                Log.d(TAG, "Processing page ${pageIndex + 1}/${pdfRenderer.pageCount}")

                                // Render page to thermal format
                                val thermalData = pdfRenderer.renderPageToThermal(pageIndex, paperWidth)

                                // Encode to ESC/POS
                                val encoder = EscPosEncoder()
                                    .initialize()
                                    .image(thermalData.data, thermalData.width, thermalData.height)
                                    .feed(settings.feedLinesAfterPrint)

                                // Add cut between pages (except last)
                                if (settings.autoCut && pageIndex < pdfRenderer.pageCount - 1) {
                                    encoder.cut()
                                }

                                // Send to printer
                                bluetoothManager.write(encoder.encode()).getOrThrow()

                                // Small delay between pages
                                if (pageIndex < pdfRenderer.pageCount - 1) {
                                    delay(500)
                                }
                            }

                            // Final cut if enabled
                            if (settings.autoCut) {
                                val finalEncoder = EscPosEncoder()
                                    .feed(2)
                                    .cut()
                                bluetoothManager.write(finalEncoder.encode()).getOrThrow()
                            }
                        }
                    }
                } finally {
                    // Always disconnect
                    bluetoothManager.disconnect()
                }
            }

            Log.d(TAG, "Print job completed successfully")
            // Complete must be on main thread
            printJob.complete()

        } catch (e: Exception) {
            Log.e(TAG, "Print job failed: ${e.message}", e)
            // Fail must be on main thread
            printJob.fail(e.message ?: "Print failed")
        }
    }

    /**
     * Find printer configuration by PrinterId
     */
    private fun findPrinterConfig(printerId: PrinterId): com.rawthermal.app.config.PrinterConfig? {
        val localId = printerId.localId
        return configManager.getSavedPrinters().find { it.id == localId }
    }

    override fun onDestroy() {
        Log.d(TAG, "ThermalPrintService destroyed")
        scope.cancel()
        bluetoothManager.disconnect()
        super.onDestroy()
    }
}
