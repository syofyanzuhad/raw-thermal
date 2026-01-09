<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()
</script>

<template>
  <div class="p-4 space-y-6">
    <!-- Printer Settings -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">Printer Settings</h2>

      <div class="space-y-4">
        <!-- Paper Width -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Paper Width</label>
          <div class="flex gap-2">
            <button
              @click="settingsStore.updateSetting('defaultPaperWidth', 58)"
              class="flex-1 py-3 rounded-lg border transition-colors"
              :class="settingsStore.settings.defaultPaperWidth === 58 ? 'bg-primary-100 border-primary-500 text-primary-700' : 'border-gray-300'"
            >
              58mm
            </button>
            <button
              @click="settingsStore.updateSetting('defaultPaperWidth', 80)"
              class="flex-1 py-3 rounded-lg border transition-colors"
              :class="settingsStore.settings.defaultPaperWidth === 80 ? 'bg-primary-100 border-primary-500 text-primary-700' : 'border-gray-300'"
            >
              80mm
            </button>
          </div>
        </div>

        <!-- Character Encoding -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Character Encoding</label>
          <select
            :value="settingsStore.settings.encoding"
            @change="settingsStore.updateSetting('encoding', ($event.target as HTMLSelectElement).value as 'UTF-8' | 'GB2312' | 'CP437')"
            class="input"
          >
            <option value="UTF-8">UTF-8 (Recommended)</option>
            <option value="GB2312">GB2312 (Chinese)</option>
            <option value="CP437">CP437 (DOS)</option>
          </select>
        </div>

        <!-- Print Density -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Print Density</label>
          <div class="flex gap-2">
            <button
              @click="settingsStore.updateSetting('printDensity', 'light')"
              class="flex-1 py-3 rounded-lg border transition-colors"
              :class="settingsStore.settings.printDensity === 'light' ? 'bg-primary-100 border-primary-500 text-primary-700' : 'border-gray-300'"
            >
              Light
            </button>
            <button
              @click="settingsStore.updateSetting('printDensity', 'normal')"
              class="flex-1 py-3 rounded-lg border transition-colors"
              :class="settingsStore.settings.printDensity === 'normal' ? 'bg-primary-100 border-primary-500 text-primary-700' : 'border-gray-300'"
            >
              Normal
            </button>
            <button
              @click="settingsStore.updateSetting('printDensity', 'dark')"
              class="flex-1 py-3 rounded-lg border transition-colors"
              :class="settingsStore.settings.printDensity === 'dark' ? 'bg-primary-100 border-primary-500 text-primary-700' : 'border-gray-300'"
            >
              Dark
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Print Options -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">Print Options</h2>

      <div class="space-y-4">
        <!-- Auto Cut -->
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-900">Auto Cut Paper</p>
            <p class="text-sm text-gray-500">Automatically cut after printing</p>
          </div>
          <button
            @click="settingsStore.updateSetting('autoCut', !settingsStore.settings.autoCut)"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            :class="settingsStore.settings.autoCut ? 'bg-primary-600' : 'bg-gray-300'"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              :class="settingsStore.settings.autoCut ? 'translate-x-6' : 'translate-x-1'"
            ></span>
          </button>
        </div>

        <!-- Feed Lines -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <div>
              <p class="font-medium text-gray-900">Feed Lines After Print</p>
              <p class="text-sm text-gray-500">Extra blank lines after content</p>
            </div>
            <span class="text-primary-600 font-semibold">{{ settingsStore.settings.feedLinesAfterPrint }}</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            :value="settingsStore.settings.feedLinesAfterPrint"
            @input="settingsStore.updateSetting('feedLinesAfterPrint', parseInt(($event.target as HTMLInputElement).value))"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>

    <!-- About -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">About</h2>

      <div class="space-y-3">
        <div class="flex justify-between">
          <span class="text-gray-600">Version</span>
          <span class="text-gray-900">1.0.0</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Build</span>
          <span class="text-gray-900">MVP</span>
        </div>
      </div>

      <div class="mt-4 pt-4 border-t border-gray-100">
        <p class="text-sm text-gray-500 text-center">
          Raw Thermal - Open Source Thermal Printer App
        </p>
        <p class="text-xs text-gray-400 text-center mt-1">
          Alternative to RawBT
        </p>
      </div>
    </div>

    <!-- Reset Settings -->
    <button
      @click="settingsStore.resetSettings()"
      class="btn btn-secondary w-full"
    >
      Reset to Defaults
    </button>
  </div>
</template>
