import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface AppSettings {
  defaultPaperWidth: 58 | 80
  encoding: 'UTF-8' | 'GB2312' | 'CP437'
  autoCut: boolean
  feedLinesAfterPrint: number
  printDensity: 'light' | 'normal' | 'dark'
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultPaperWidth: 58,
  encoding: 'UTF-8',
  autoCut: true,
  feedLinesAfterPrint: 3,
  printDensity: 'normal'
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })

  // Load settings from localStorage
  function loadSettings() {
    const saved = localStorage.getItem('appSettings')
    if (saved) {
      settings.value = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
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
    loadSettings,
    saveSettings,
    updateSetting,
    resetSettings
  }
})
