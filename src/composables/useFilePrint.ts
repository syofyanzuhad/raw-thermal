import { ref, computed, onUnmounted } from 'vue'
import { usePrinterStore } from '@/stores/printer'
import { useSettingsStore } from '@/stores/settings'
import { useBluetoothService } from '@/composables/useBluetooth'
import { createEncoder } from '@/services/escpos/EscPosEncoder'
import {
  pickFile,
  loadImageFromBlob,
  resizeImage,
  formatFileSize,
  imageDataToThermalFormat,
  type SelectedFile
} from '@/services/file/FileService'
import {
  loadPdf,
  getAllThumbnails,
  renderPageFull,
  destroyDocument
} from '@/services/file/PdfRenderer'

export interface PageItem {
  pageNum: number
  thumbnail: string
  selected: boolean
  width: number
  height: number
}

export function useFilePrint() {
  const printerStore = usePrinterStore()
  const settingsStore = useSettingsStore()
  const { write } = useBluetoothService()

  // State
  const selectedFile = ref<SelectedFile | null>(null)
  const pages = ref<PageItem[]>([])
  const isLoading = ref(false)
  const loadingMessage = ref('')
  const isPrinting = ref(false)
  const printProgress = ref({ current: 0, total: 0 })
  const error = ref<string | null>(null)

  // Computed
  const selectedPages = computed(() => pages.value.filter(p => p.selected))
  const selectedCount = computed(() => selectedPages.value.length)
  const hasFile = computed(() => selectedFile.value !== null)
  const canPrint = computed(() =>
    hasFile.value &&
    selectedCount.value > 0 &&
    printerStore.isConnected &&
    !isPrinting.value
  )
  const fileInfo = computed(() => {
    if (!selectedFile.value) return null
    return {
      name: selectedFile.value.name,
      type: selectedFile.value.type,
      size: formatFileSize(selectedFile.value.size)
    }
  })

  /**
   * Open file picker and load file
   */
  async function selectFile() {
    error.value = null

    try {
      const file = await pickFile()
      if (!file) return

      await loadFile(file)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to select file'
      console.error('[useFilePrint] Error selecting file:', err)
    }
  }

  /**
   * Load file (can be called from file picker or share intent)
   */
  async function loadFile(file: SelectedFile) {
    isLoading.value = true
    loadingMessage.value = 'Loading file...'
    error.value = null
    pages.value = []
    selectedFile.value = file

    try {
      if (file.type === 'pdf') {
        await loadPdfFile(file)
      } else {
        await loadImageFile(file)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load file'
      selectedFile.value = null
      console.error('[useFilePrint] Error loading file:', err)
    } finally {
      isLoading.value = false
      loadingMessage.value = ''
    }
  }

  /**
   * Load PDF file and generate thumbnails
   */
  async function loadPdfFile(file: SelectedFile) {
    loadingMessage.value = 'Loading PDF...'
    await loadPdf(file.blob)

    loadingMessage.value = 'Generating previews...'
    const thumbnails = await getAllThumbnails(150, (current, total) => {
      loadingMessage.value = `Generating preview ${current}/${total}...`
    })

    pages.value = thumbnails.map(t => ({
      pageNum: t.pageNum,
      thumbnail: t.dataUrl,
      selected: true, // Select all by default
      width: t.width,
      height: t.height
    }))
  }

  /**
   * Load image file
   */
  async function loadImageFile(file: SelectedFile) {
    loadingMessage.value = 'Loading image...'
    const img = await loadImageFromBlob(file.blob)

    // Create thumbnail
    const canvas = document.createElement('canvas')
    const maxWidth = 150
    const scale = maxWidth / img.width
    canvas.width = maxWidth
    canvas.height = Math.round(img.height * scale)

    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    pages.value = [{
      pageNum: 1,
      thumbnail: canvas.toDataURL('image/jpeg', 0.7),
      selected: true,
      width: canvas.width,
      height: canvas.height
    }]
  }

  /**
   * Toggle page selection
   */
  function togglePage(pageNum: number) {
    const page = pages.value.find(p => p.pageNum === pageNum)
    if (page) {
      page.selected = !page.selected
    }
  }

  /**
   * Select all pages
   */
  function selectAllPages() {
    pages.value.forEach(p => p.selected = true)
  }

  /**
   * Deselect all pages
   */
  function deselectAllPages() {
    pages.value.forEach(p => p.selected = false)
  }

  /**
   * Print selected pages
   */
  async function printSelected() {
    if (!canPrint.value || !selectedFile.value) return

    isPrinting.value = true
    printProgress.value = { current: 0, total: selectedCount.value }
    error.value = null

    const paperWidth = settingsStore.settings.defaultPaperWidth === 58 ? 384 : 576 // dots

    try {
      const pagesToPrint = [...selectedPages.value]

      for (let i = 0; i < pagesToPrint.length; i++) {
        const page = pagesToPrint[i]
        if (!page) continue

        printProgress.value.current = i + 1

        let imageData: ImageData

        if (selectedFile.value.type === 'pdf') {
          // Render PDF page at full resolution
          imageData = await renderPageFull(page.pageNum, paperWidth)
        } else {
          // Resize image to paper width
          const img = await loadImageFromBlob(selectedFile.value.blob)
          imageData = resizeImage(img, paperWidth)
        }

        // Convert to thermal printer format (1-bit dithered)
        const thermalData = imageDataToThermalFormat(imageData)

        // Encode and print
        const encoder = createEncoder()
        encoder.initialize()
        encoder.image(thermalData.data, thermalData.width, thermalData.height)
        encoder.feed(3)

        // Add cut between pages (except last)
        if (i < pagesToPrint.length - 1 && settingsStore.settings.autoCut) {
          encoder.cut()
        }

        await write(encoder.encode())

        // Small delay between pages
        if (i < pagesToPrint.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      // Final cut if enabled
      if (settingsStore.settings.autoCut) {
        const encoder = createEncoder()
        encoder.feed(settingsStore.settings.feedLinesAfterPrint)
        encoder.cut()
        await write(encoder.encode())
      }

      console.log('[useFilePrint] Print complete')
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Print failed'
      console.error('[useFilePrint] Print error:', err)
    } finally {
      isPrinting.value = false
      printProgress.value = { current: 0, total: 0 }
    }
  }

  /**
   * Clear current file
   */
  async function clearFile() {
    selectedFile.value = null
    pages.value = []
    error.value = null
    await destroyDocument()
  }

  // Cleanup on unmount
  onUnmounted(() => {
    destroyDocument()
  })

  return {
    // State
    selectedFile,
    pages,
    isLoading,
    loadingMessage,
    isPrinting,
    printProgress,
    error,

    // Computed
    selectedPages,
    selectedCount,
    hasFile,
    canPrint,
    fileInfo,

    // Methods
    selectFile,
    loadFile,
    togglePage,
    selectAllPages,
    deselectAllPages,
    printSelected,
    clearFile
  }
}
