<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePrinterStore } from '@/stores/printer'
import { usePrintService } from '@/composables/usePrint'

const router = useRouter()
const printerStore = usePrinterStore()
const { printText, printTestPage, printQRCode, printBarcode, isPrinting } = usePrintService()

const textToPrint = ref('')
const textAlign = ref<'left' | 'center' | 'right'>('left')
const textBold = ref(false)
const textSize = ref<'normal' | 'double'>('normal')

// Barcode state
const barcodeType = ref<'qr' | 'code128' | 'ean13' | 'code39'>('qr')
const barcodeContent = ref('')

const activeTab = ref<'text' | 'image' | 'barcode'>('text')

const canPrint = computed(() => printerStore.isConnected && !isPrinting.value)

async function handlePrintText() {
  if (!canPrint.value || !textToPrint.value.trim()) return

  try {
    await printText(textToPrint.value, {
      align: textAlign.value,
      bold: textBold.value,
      doubleSize: textSize.value === 'double'
    })
    textToPrint.value = ''
  } catch (err) {
    printerStore.setError(err instanceof Error ? err.message : 'Print failed')
  }
}

async function handleTestPrint() {
  if (!canPrint.value) return

  try {
    if (activeTab.value === 'text') {
      await printTestPage()
    } else if (activeTab.value === 'barcode') {
      // Print test QR code
      await printQRCode('https://github.com/anthropics/claude', 6)
    }
    // Image tab doesn't have test print - use file picker instead
  } catch (err) {
    printerStore.setError(err instanceof Error ? err.message : 'Test print failed')
  }
}

async function handlePrintBarcode() {
  if (!canPrint.value || !barcodeContent.value.trim()) return

  try {
    if (barcodeType.value === 'qr') {
      await printQRCode(barcodeContent.value, 6)
    } else {
      const type = barcodeType.value.toUpperCase() as 'CODE128' | 'EAN13' | 'CODE39'
      await printBarcode(barcodeContent.value, type)
    }
    barcodeContent.value = ''
  } catch (err) {
    printerStore.setError(err instanceof Error ? err.message : 'Print barcode failed')
  }
}

const testPrintLabel = computed(() => {
  switch (activeTab.value) {
    case 'text': return 'Test Print Text'
    case 'barcode': return 'Test Print QR Code'
    default: return 'Test Print'
  }
})
</script>

<template>
  <div class="p-4 space-y-6">
    <!-- Not Connected Warning -->
    <div v-if="!printerStore.isConnected" class="card bg-yellow-50 border-yellow-200">
      <div class="flex items-center gap-3 text-yellow-700">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <div>
          <p class="font-medium">No Printer Connected</p>
          <p class="text-sm">Please connect a printer first</p>
        </div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="flex border-b border-gray-200">
      <button
        @click="activeTab = 'text'"
        class="flex-1 py-3 text-center font-medium transition-colors border-b-2"
        :class="activeTab === 'text' ? 'text-primary-600 border-primary-600' : 'text-gray-500 border-transparent'"
      >
        Text
      </button>
      <button
        @click="activeTab = 'image'"
        class="flex-1 py-3 text-center font-medium transition-colors border-b-2"
        :class="activeTab === 'image' ? 'text-primary-600 border-primary-600' : 'text-gray-500 border-transparent'"
      >
        Image
      </button>
      <button
        @click="activeTab = 'barcode'"
        class="flex-1 py-3 text-center font-medium transition-colors border-b-2"
        :class="activeTab === 'barcode' ? 'text-primary-600 border-primary-600' : 'text-gray-500 border-transparent'"
      >
        Barcode
      </button>
    </div>

    <!-- Text Tab -->
    <div v-if="activeTab === 'text'" class="space-y-4">
      <div class="card">
        <h3 class="font-semibold text-gray-800 mb-3">Text Formatting</h3>

        <!-- Alignment -->
        <div class="flex gap-2 mb-4">
          <button
            @click="textAlign = 'left'"
            class="flex-1 py-2 rounded-lg border transition-colors"
            :class="textAlign === 'left' ? 'bg-primary-100 border-primary-500 text-primary-700' : 'border-gray-300'"
          >
            <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h14"/>
            </svg>
          </button>
          <button
            @click="textAlign = 'center'"
            class="flex-1 py-2 rounded-lg border transition-colors"
            :class="textAlign === 'center' ? 'bg-primary-100 border-primary-500 text-primary-700' : 'border-gray-300'"
          >
            <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M7 12h10M5 18h14"/>
            </svg>
          </button>
          <button
            @click="textAlign = 'right'"
            class="flex-1 py-2 rounded-lg border transition-colors"
            :class="textAlign === 'right' ? 'bg-primary-100 border-primary-500 text-primary-700' : 'border-gray-300'"
          >
            <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M10 12h10M6 18h14"/>
            </svg>
          </button>
        </div>

        <!-- Style Options -->
        <div class="flex gap-2 mb-4">
          <button
            @click="textBold = !textBold"
            class="flex-1 py-2 rounded-lg border transition-colors font-bold"
            :class="textBold ? 'bg-primary-100 border-primary-500 text-primary-700' : 'border-gray-300'"
          >
            B
          </button>
          <button
            @click="textSize = textSize === 'normal' ? 'double' : 'normal'"
            class="flex-1 py-2 rounded-lg border transition-colors"
            :class="textSize === 'double' ? 'bg-primary-100 border-primary-500 text-primary-700' : 'border-gray-300'"
          >
            2x
          </button>
        </div>

        <!-- Text Input -->
        <textarea
          v-model="textToPrint"
          class="input h-32 resize-none"
          placeholder="Enter text to print..."
        ></textarea>
      </div>

      <button
        @click="handlePrintText"
        :disabled="!canPrint || !textToPrint.trim()"
        class="btn btn-primary w-full py-3"
        :class="{ 'opacity-50 cursor-not-allowed': !canPrint || !textToPrint.trim() }"
      >
        <svg v-if="isPrinting" class="w-5 h-5 mr-2 inline animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {{ isPrinting ? 'Printing...' : 'Print Text' }}
      </button>
    </div>

    <!-- Image Tab -->
    <div v-if="activeTab === 'image'" class="space-y-4">
      <div class="card">
        <h3 class="font-semibold text-gray-800 mb-3">Print Image</h3>
        <button
          @click="router.push('/file-print')"
          class="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 hover:bg-primary-50 transition-colors"
        >
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <p class="text-gray-600 font-medium mb-1">Select Image or PDF</p>
          <p class="text-xs text-gray-400">PNG, JPG, PDF supported</p>
        </button>
      </div>

      <!-- Sample Image Info -->
      <div class="card bg-blue-50 border-blue-200">
        <div class="flex items-start gap-3 text-blue-700">
          <svg class="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <p class="font-medium text-sm">Sample Image Available</p>
            <p class="text-xs mt-1">Try printing <code class="bg-blue-100 px-1 rounded">sample-logo.png</code> from the public folder to test your printer.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Barcode Tab -->
    <div v-if="activeTab === 'barcode'" class="space-y-4">
      <div class="card">
        <h3 class="font-semibold text-gray-800 mb-3">Generate Barcode</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Barcode Type</label>
            <select v-model="barcodeType" class="input">
              <option value="qr">QR Code</option>
              <option value="code128">Code 128</option>
              <option value="ean13">EAN-13</option>
              <option value="code39">Code 39</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <input
              v-model="barcodeContent"
              type="text"
              class="input"
              :placeholder="barcodeType === 'qr' ? 'Enter URL or text...' : 'Enter barcode number...'"
            />
          </div>
        </div>
      </div>

      <button
        @click="handlePrintBarcode"
        :disabled="!canPrint || !barcodeContent.trim()"
        class="btn btn-primary w-full py-3"
        :class="{ 'opacity-50 cursor-not-allowed': !canPrint || !barcodeContent.trim() }"
      >
        <svg v-if="isPrinting" class="w-5 h-5 mr-2 inline animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {{ isPrinting ? 'Printing...' : (barcodeType === 'qr' ? 'Print QR Code' : 'Print Barcode') }}
      </button>
    </div>

    <!-- Test Print Button (not shown for image tab) -->
    <div v-if="activeTab !== 'image'" class="card">
      <button
        @click="handleTestPrint"
        :disabled="!canPrint"
        class="btn btn-secondary w-full"
        :class="{ 'opacity-50 cursor-not-allowed': !canPrint }"
      >
        <svg v-if="isPrinting" class="w-5 h-5 mr-2 inline animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <svg v-else class="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        {{ isPrinting ? 'Printing...' : testPrintLabel }}
      </button>
    </div>

    <!-- Error Display -->
    <div v-if="printerStore.error" class="card bg-red-50 border-red-200">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3 text-red-700">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="text-sm">{{ printerStore.error }}</span>
        </div>
        <button @click="printerStore.setError(null)" class="text-red-500">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
