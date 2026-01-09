import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Printer } from '@/types/printer'

export interface PendingPrintJob {
  id: string
  title: string
  timestamp: number
}

interface PrinterConfigPlugin {
  syncPrinterConfig(options: {
    printers: Printer[]
    currentPrinterId: string | null
    settings: Record<string, unknown>
  }): Promise<void>
  getPrinterConfig(): Promise<{
    printers: Printer[]
    currentPrinterId: string | null
  }>
  setCurrentPrinter(options: { printerId: string | null }): Promise<void>
  hasPrinterConfigured(): Promise<{
    configured: boolean
    printerName: string | null
  }>
  hasPendingPrintJobs(): Promise<{
    hasPending: boolean
    count: number
    jobs: PendingPrintJob[]
  }>
  clearPendingPrintJobs(): Promise<void>
  getPendingJobDocumentPath(options: { jobId: string }): Promise<{
    path: string
    title: string
  }>
  removePendingPrintJob(options: { jobId: string }): Promise<void>
}

const PrinterConfig = registerPlugin<PrinterConfigPlugin>('PrinterConfig')

/**
 * Sync printer configuration to native SharedPreferences
 * This allows the Android Print Service to access printer config
 */
export async function syncPrinterConfigToNative(
  printers: Printer[],
  currentPrinterId: string | null,
  settings: Record<string, unknown>
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return // Only sync on native platforms
  }

  try {
    await PrinterConfig.syncPrinterConfig({
      printers,
      currentPrinterId,
      settings
    })
    console.log('[PrinterConfigBridge] Config synced to native')
  } catch (error) {
    console.error('[PrinterConfigBridge] Failed to sync config:', error)
  }
}

/**
 * Get printer configuration from native SharedPreferences
 */
export async function getPrinterConfigFromNative(): Promise<{
  printers: Printer[]
  currentPrinterId: string | null
} | null> {
  if (!Capacitor.isNativePlatform()) {
    return null
  }

  try {
    return await PrinterConfig.getPrinterConfig()
  } catch (error) {
    console.error('[PrinterConfigBridge] Failed to get config:', error)
    return null
  }
}

/**
 * Set current printer in native SharedPreferences
 */
export async function setCurrentPrinterNative(printerId: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  try {
    await PrinterConfig.setCurrentPrinter({ printerId })
  } catch (error) {
    console.error('[PrinterConfigBridge] Failed to set current printer:', error)
  }
}

/**
 * Check if a printer is configured for the Print Service
 */
export async function hasPrinterConfiguredNative(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false
  }

  try {
    const result = await PrinterConfig.hasPrinterConfigured()
    return result.configured
  } catch (error) {
    console.error('[PrinterConfigBridge] Failed to check config:', error)
    return false
  }
}

/**
 * Check if there are pending print jobs
 */
export async function hasPendingPrintJobsNative(): Promise<{
  hasPending: boolean
  count: number
  jobs: PendingPrintJob[]
}> {
  if (!Capacitor.isNativePlatform()) {
    return { hasPending: false, count: 0, jobs: [] }
  }

  try {
    return await PrinterConfig.hasPendingPrintJobs()
  } catch (error) {
    console.error('[PrinterConfigBridge] Failed to check pending jobs:', error)
    return { hasPending: false, count: 0, jobs: [] }
  }
}

/**
 * Clear all pending print jobs
 */
export async function clearPendingPrintJobsNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  try {
    await PrinterConfig.clearPendingPrintJobs()
    console.log('[PrinterConfigBridge] Pending jobs cleared')
  } catch (error) {
    console.error('[PrinterConfigBridge] Failed to clear pending jobs:', error)
  }
}

/**
 * Get the document path for a pending print job
 */
export async function getPendingJobDocumentPathNative(jobId: string): Promise<{
  path: string
  title: string
} | null> {
  if (!Capacitor.isNativePlatform()) {
    return null
  }

  try {
    return await PrinterConfig.getPendingJobDocumentPath({ jobId })
  } catch (error) {
    console.error('[PrinterConfigBridge] Failed to get job path:', error)
    return null
  }
}

/**
 * Remove a pending print job
 */
export async function removePendingPrintJobNative(jobId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  try {
    await PrinterConfig.removePendingPrintJob({ jobId })
    console.log('[PrinterConfigBridge] Removed pending job:', jobId)
  } catch (error) {
    console.error('[PrinterConfigBridge] Failed to remove job:', error)
  }
}
