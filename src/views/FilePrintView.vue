<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePrinterStore } from '@/stores/printer'
import { useIncomingStore } from '@/stores/incoming'
import { useFilePrint } from '@/composables/useFilePrint'
import { removePendingPrintJobNative } from '@/services/native/PrinterConfigBridge'

const router = useRouter()
const printerStore = usePrinterStore()
const incoming = useIncomingStore()

const {
  pages,
  textContent,
  unmappedCharacters,
  isLoading,
  loadingMessage,
  isPrinting,
  printProgress,
  error,
  isTextFile,
  columns,
  selectedCount,
  hasFile,
  canPrint,
  fileInfo,
  selectFile,
  loadFile,
  togglePage,
  selectAllPages,
  deselectAllPages,
  printSelected,
  clearFile
} = useFilePrint()

const allSelected = computed(() =>
  pages.value.length > 0 && pages.value.every(p => p.selected)
)

/**
 * Load a document that arrived from outside the app, and print it when it came from the
 * Android print queue — the user already asked for that one, so a second tap would be noise.
 *
 * A queued job is only removed once the print actually succeeded. Clearing it on failure would
 * throw away the user's document, which is exactly the bug this replaced.
 */
async function applyIncoming() {
  const job = incoming.consume()
  if (!job) return

  await loadFile(job.file)

  if (!job.autoPrint) return

  if (!printerStore.isConnected) {
    // Nothing to print to yet. The document stays on screen so the user can connect a printer
    // and press Print — far better than dropping it.
    return
  }

  const printed = await printSelected()
  if (printed && job.jobId) {
    await removePendingPrintJobNative(job.jobId)
  }
}

function dismissProblem() {
  incoming.clear()
}

function goBack() {
  clearFile()
  incoming.clear()
  router.back()
}

function handleToggleAll() {
  if (allSelected.value) {
    deselectAllPages()
  } else {
    selectAllPages()
  }
}

onMounted(applyIncoming)

// The share listener lives in App.vue, so a share can land while this screen is already open.
watch(() => incoming.job, () => {
  void applyIncoming()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center gap-3 p-4 border-b border-gray-200 bg-white">
      <button @click="goBack" class="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="text-lg font-semibold text-gray-900">Print File</h1>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto p-4 space-y-4">
      <!-- Printer Warning -->
      <div v-if="!printerStore.isConnected" class="card bg-amber-50 border-amber-200">
        <div class="flex items-center gap-3 text-amber-700">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <div>
            <p class="font-medium">No Printer Connected</p>
            <p class="text-sm">Connect to a printer first to print files.</p>
          </div>
        </div>
        <router-link to="/printer" class="btn btn-outline text-sm mt-3">
          Go to Printer
        </router-link>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="card bg-red-50 border-red-200">
        <div class="flex items-center gap-3 text-red-700">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-sm">{{ error }}</p>
        </div>
      </div>

      <!-- Rejected incoming document -->
      <div v-if="incoming.problem" class="card bg-amber-50 border-amber-200">
        <div class="flex items-start gap-3 text-amber-700">
          <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <div class="flex-1">
            <p class="font-medium">Could not open the shared item</p>
            <p class="text-sm">{{ incoming.problem }}</p>
          </div>
          <button @click="dismissProblem" class="p-1 text-amber-700 hover:bg-amber-100 rounded-lg">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="card">
        <div class="flex flex-col items-center justify-center py-8">
          <div class="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
          <p class="text-gray-600">{{ loadingMessage }}</p>
        </div>
      </div>

      <!-- File Info & Actions -->
      <div v-else-if="hasFile && fileInfo" class="card">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg v-if="fileInfo.type === 'pdf'" class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
              <svg v-else-if="fileInfo.type === 'text'" class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h10"/>
              </svg>
              <svg v-else class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <div>
              <p class="font-medium text-gray-900 truncate max-w-[200px]">{{ fileInfo.name }}</p>
              <p class="text-xs text-gray-500">
                {{ fileInfo.size }} •
                <template v-if="isTextFile">{{ textContent.split('\n').length }} line(s)</template>
                <template v-else>{{ pages.length }} page(s)</template>
              </p>
            </div>
          </div>
          <button @click="clearFile" class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Selection Controls -->
        <div v-if="pages.length > 1" class="flex items-center justify-between py-2 border-t border-gray-100">
          <span class="text-sm text-gray-600">{{ selectedCount }} of {{ pages.length }} selected</span>
          <button @click="handleToggleAll" class="text-sm text-primary-600 font-medium">
            {{ allSelected ? 'Deselect All' : 'Select All' }}
          </button>
        </div>
      </div>

      <!-- Unmapped Character Warning -->
      <div v-if="unmappedCharacters.length > 0" class="card bg-amber-50 border-amber-200">
        <div class="flex items-start gap-3 text-amber-700">
          <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <div>
            <p class="font-medium">Some characters could not be printed</p>
            <p class="text-sm">
              {{ unmappedCharacters.length }} character(s) are not in the selected code page and
              were sent as "?". Change Character Encoding in Settings, or use a printer with
              UTF-8 mode.
            </p>
            <p class="text-sm mt-1 font-mono break-all">{{ unmappedCharacters.join(' ') }}</p>
          </div>
        </div>
      </div>

      <!-- Text Preview -->
      <div v-if="hasFile && isTextFile" class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-medium text-gray-700">Preview</h2>
          <span class="text-xs text-gray-400">wrapped to {{ columns }} columns</span>
        </div>
        <pre class="text-xs leading-5 font-mono bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-80">{{ textContent }}</pre>
      </div>

      <!-- Page Thumbnails Grid -->
      <div v-if="hasFile && !isTextFile && pages.length > 0" class="grid grid-cols-3 gap-3">
        <button
          v-for="page in pages"
          :key="page.pageNum"
          @click="togglePage(page.pageNum)"
          class="relative rounded-lg overflow-hidden border-2 transition-all"
          :class="page.selected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200'"
        >
          <img
            :src="page.thumbnail"
            :alt="`Page ${page.pageNum}`"
            class="w-full h-auto"
          />
          <div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-1 text-center">
            {{ page.pageNum }}
          </div>
          <div
            v-if="page.selected"
            class="absolute top-1 right-1 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center"
          >
            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
        </button>
      </div>

      <!-- Empty State -->
      <div v-if="!hasFile && !isLoading" class="card">
        <div class="flex flex-col items-center justify-center py-12">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
          </div>
          <p class="text-gray-600 font-medium mb-1">No File Selected</p>
          <p class="text-sm text-gray-400 mb-4">Select a PDF, image, or text file to print</p>
          <button @click="selectFile" class="btn btn-primary">
            <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            Select File
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="p-4 border-t border-gray-200 bg-white space-y-3">
      <button
        v-if="hasFile"
        @click="selectFile"
        class="btn btn-outline w-full"
      >
        <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Change File
      </button>

      <button
        @click="printSelected"
        :disabled="!canPrint"
        class="btn btn-primary w-full"
        :class="{ 'opacity-50 cursor-not-allowed': !canPrint }"
      >
        <svg v-if="!isPrinting" class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
        </svg>
        <span v-if="isPrinting">
          Printing {{ printProgress.current }}/{{ printProgress.total }}...
        </span>
        <span v-else-if="isTextFile">Print Text</span>
        <span v-else>
          Print {{ selectedCount > 0 ? `(${selectedCount} page${selectedCount > 1 ? 's' : ''})` : '' }}
        </span>
      </button>
    </div>

    <!-- Print Progress Modal -->
    <div v-if="isPrinting" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 mx-4 max-w-sm w-full">
        <div class="text-center">
          <div class="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p class="font-medium text-gray-900 mb-2">Printing...</p>
          <p class="text-sm text-gray-500">
            Page {{ printProgress.current }} of {{ printProgress.total }}
          </p>
          <div class="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              class="bg-primary-600 h-full transition-all duration-300"
              :style="{ width: `${(printProgress.current / printProgress.total) * 100}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
