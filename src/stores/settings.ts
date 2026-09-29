import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { CODEPAGES, DEFAULT_CODEPAGE, normalizeCodepageId } from '@/services/escpos/codepages'
import type { CodepageId } from '@/services/escpos/codepages'

export interface AppSettings {
  defaultPaperWidth: 58 | 80
  encoding: CodepageId
  autoCut: boolean
  feedLinesAfterPrint: number
  printDensity: 'light' | 'normal' | 'dark'
}

/** Paper width expressed in font A character columns (12 dots per character). */
export const PAPER_COLUMNS: Record<58 | 80, number> = {
  58: 32,
  80: 48
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultPaperWidth: 58,
  encoding: DEFAULT_CODEPAGE,
  autoCut: true,
  feedLinesAfterPrint: 3,
  printDensity: 'normal'
}

/**
 * `encoding` values written by earlier versions are migrated by `normalizeCodepageId`,
 * which lives next to the code page definitions so it can be unit tested.
 */
export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })

  /** Column width for the selected paper; used for text wrapping and separator rules. */
  const columns = computed(() => PAPER_COLUMNS[settings.value.defaultPaperWidth])

  /** Code pages offered by the Settings dropdown. */
  const codepages = computed(() => CODEPAGES)

  // Load settings from localStorage
  function loadSettings() {
    const saved = localStorage.getItem('appSettings')
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<AppSettings>
      settings.value = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        encoding: normalizeCodepageId(parsed.encoding)
      }
    }
  }

  // Save settings to localStorage
  function saveSettings() {
    localStorage.setItem('appSettings', JSON.stringify(settings.value))
  }

  // Update a single setting
  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    settings.value[key] = value
    saveSettings()
  }

  // Reset to defaults
  function resetSettings() {
    settings.value = { ...DEFAULT_SETTINGS }
    saveSettings()
  }

  // Watch for changes and auto-save
  watch(settings, () => {
    saveSettings()
  }, { deep: true })

  // Initialize
  loadSettings()

  return {
    settings,
    columns,
    codepages,
    loadSettings,
    saveSettings,
    updateSetting,
    resetSettings
  }
})
