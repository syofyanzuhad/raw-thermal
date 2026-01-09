package com.rawthermal.app.printservice

import android.print.PrintAttributes
import android.print.PrinterId
import android.print.PrinterCapabilitiesInfo
import android.print.PrinterInfo
import android.printservice.PrintService
import android.printservice.PrinterDiscoverySession
import android.util.Log
import com.rawthermal.app.config.PrinterConfig
import com.rawthermal.app.config.PrinterConfigManager

/**
 * Printer discovery session for the Thermal Print Service
 * Reports configured thermal printers to the Android print framework
 */
class ThermalPrinterDiscoverySession(
    private val service: PrintService,
    private val configManager: PrinterConfigManager
) : PrinterDiscoverySession() {

    companion object {
        private const val TAG = "ThermalDiscovery"

        // Custom media sizes for thermal paper
        // Width in mils (1/1000 inch), height is arbitrary large value for roll paper
        private const val THERMAL_58_WIDTH_MILS = 2283  // 58mm = ~2.28 inches
        private const val THERMAL_80_WIDTH_MILS = 3150  // 80mm = ~3.15 inches
        private const val THERMAL_HEIGHT_MILS = 100000  // Large height for roll paper
    }

    override fun onStartPrinterDiscovery(priorityList: MutableList<PrinterId>) {
        Log.d(TAG, "Starting printer discovery")
        reportConfiguredPrinters()
    }

    override fun onStopPrinterDiscovery() {
        Log.d(TAG, "Stopping printer discovery")
    }

    override fun onValidatePrinters(printerIds: MutableList<PrinterId>) {
        Log.d(TAG, "Validating ${printerIds.size} printers")
        // All our configured printers are valid
    }

    override fun onStartPrinterStateTracking(printerId: PrinterId) {
        Log.d(TAG, "Start tracking printer: ${printerId.localId}")
        reportConfiguredPrinters()
    }

    override fun onStopPrinterStateTracking(printerId: PrinterId) {
        Log.d(TAG, "Stop tracking printer: ${printerId.localId}")
    }

    override fun onDestroy() {
        Log.d(TAG, "Discovery session destroyed")
    }

    /**
     * Report virtual printer to the Android print framework
     * Always shows "Raw Thermal" regardless of configured printers
     */
    private fun reportConfiguredPrinters() {
        val printers = mutableListOf<PrinterInfo>()

        // Always add the virtual "Raw Thermal" printer
        createVirtualPrinter()?.let { printers.add(it) }

        Log.d(TAG, "Reporting virtual printer: Raw Thermal")

        if (printers.isNotEmpty()) {
            addPrinters(printers)
        }
    }

    /**
     * Create the virtual "Raw Thermal" printer that's always visible
     */
    private fun createVirtualPrinter(): PrinterInfo? {
        return try {
            val printerId = service.generatePrinterId("raw_thermal_virtual")
            val settings = configManager.getAppSettings()
            val paperWidth = settings.defaultPaperWidth

            PrinterInfo.Builder(printerId, "Raw Thermal", PrinterInfo.STATUS_IDLE)
                .setCapabilities(buildPrinterCapabilities(printerId, paperWidth))
                .setDescription("Thermal printer via Bluetooth")
                .build()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create virtual printer: ${e.message}")
            null
        }
    }

    /**
     * Create PrinterInfo for a printer configuration
     */
    private fun createPrinterInfo(config: PrinterConfig, isCurrent: Boolean): PrinterInfo? {
        return try {
            val printerId = service.generatePrinterId(config.id)

            // Build printer capabilities
            val capabilities = buildPrinterCapabilities(printerId, config.paperWidth)

            // Determine printer status
            val status = if (isCurrent) {
                PrinterInfo.STATUS_IDLE
            } else {
                PrinterInfo.STATUS_IDLE // All saved printers are available
            }

            PrinterInfo.Builder(printerId, config.name, status)
                .setCapabilities(capabilities)
                .setDescription("Thermal printer via Bluetooth (${config.paperWidth}mm)")
                .build()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create printer info for ${config.name}: ${e.message}")
            null
        }
    }

    /**
     * Build capabilities for a thermal printer
     */
    private fun buildPrinterCapabilities(
        printerId: PrinterId,
        paperWidth: Int
    ): PrinterCapabilitiesInfo {
        val builder = PrinterCapabilitiesInfo.Builder(printerId)

        // Add thermal paper media sizes
        val thermal58 = PrintAttributes.MediaSize(
            "THERMAL_58MM",
            "58mm Thermal Roll",
            THERMAL_58_WIDTH_MILS,
            THERMAL_HEIGHT_MILS
        )

        val thermal80 = PrintAttributes.MediaSize(
            "THERMAL_80MM",
            "80mm Thermal Roll",
            THERMAL_80_WIDTH_MILS,
            THERMAL_HEIGHT_MILS
        )

        // Add both sizes, mark the configured one as default
        builder.addMediaSize(thermal58, paperWidth == 58)
        builder.addMediaSize(thermal80, paperWidth == 80)

        // Also add standard sizes that will be scaled
        builder.addMediaSize(PrintAttributes.MediaSize.ISO_A4, false)
        builder.addMediaSize(PrintAttributes.MediaSize.NA_LETTER, false)

        // Resolution: 203 DPI is standard for thermal printers
        val resolution = PrintAttributes.Resolution(
            "203dpi",
            "203 DPI",
            203,
            203
        )
        builder.addResolution(resolution, true)

        // Thermal printers are monochrome only
        builder.setColorModes(
            PrintAttributes.COLOR_MODE_MONOCHROME,
            PrintAttributes.COLOR_MODE_MONOCHROME
        )

        return builder.build()
    }
}
