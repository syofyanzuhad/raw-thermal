<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const settingsStore = useSettingsStore()

// Hidden developer menu - tap version 7 times
const tapCount = ref(0)
const tapTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const REQUIRED_TAPS = 7

function handleVersionTap() {
  tapCount.value++

  // Reset tap count after 2 seconds of no taps
  if (tapTimeout.value) {
    clearTimeout(tapTimeout.value)
  }
  tapTimeout.value = setTimeout(() => {
    tapCount.value = 0
  }, 2000)

  // Show remaining taps hint after 3 taps
  if (tapCount.value >= 3 && tapCount.value < REQUIRED_TAPS) {
    const remaining = REQUIRED_TAPS - tapCount.value
    // Visual feedback could be added here
    console.log(`${remaining} more taps to open logs`)
  }

  // Navigate to logs when reaching required taps
  if (tapCount.value >= REQUIRED_TAPS) {
    tapCount.value = 0
    if (tapTimeout.value) {
      clearTimeout(tapTimeout.value)
    }
    router.push('/logs')
  }
}
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
        <div
          class="flex justify-between cursor-pointer select-none"
          @click="handleVersionTap"
        >
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

      <!-- Author & GitHub -->
      <div class="mt-4 pt-4 border-t border-gray-100">
        <div class="flex justify-between items-center">
          <span class="text-gray-600">Author</span>
          <span class="text-gray-900 font-medium">syofyanzuhad</span>
        </div>
        <a
          href="https://github.com/syofyanzuhad/raw-thermal"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-3 flex items-center justify-center gap-2 py-2 px-4 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          <span>View on GitHub</span>
        </a>
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
