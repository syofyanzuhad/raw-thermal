import { computed } from 'vue'
import { usePrinterStore } from '@/stores/printer'
import { PAPER_COLUMNS, useSettingsStore } from '@/stores/settings'

/**
 * Effective paper width in font A character columns.
 *
 * The stored printer's paper width wins over the default in Settings, so the layout follows
 * the paper that is actually loaded. Shared by the text printing path and the UI preview so
 * the two can never disagree.
 */
export function usePaperColumns() {
  const printerStore = usePrinterStore()
  const settingsStore = useSettingsStore()

  return computed(
    () => PAPER_COLUMNS[printerStore.currentPrinter?.paperWidth ?? settingsStore.settings.defaultPaperWidth]
  )
}
