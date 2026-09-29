import {
  getFileType,
  getFileTypeFromName,
  type SelectedFile
} from './fileTypes.ts'

// The classification tables live in a dependency-free module so they can be unit tested and
// reused by the share-intent parser. Re-exported here to keep this module's API unchanged.
export type { SelectedFile }
export { getFileType, getFileTypeFromName, isSupportedType, SUPPORTED_TYPES } from './fileTypes.ts'

/**
 * Pick a file using native file picker or HTML input
 */
export async function pickFile(): Promise<SelectedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf,image/jpeg,image/png,image/webp,image/bmp,text/plain,.txt'

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      const fileType = getFileType(file.type) ?? getFileTypeFromName(file.name)
      if (!fileType) {
        console.error('[FileService] Unsupported file type:', file.type, file.name)
        resolve(null)
        return
      }

      resolve({
        name: file.name,
        type: fileType,
        mimeType: file.type,
        blob: file,
        size: file.size
      })
    }

    input.oncancel = () => {
      resolve(null)
    }

    input.click()
  })
}

/**
 * Read a text file as a string.
 *
 * A leading UTF-8 BOM is stripped so its bytes are not printed as stray characters at the
 * start of the document.
 */
export async function readTextFromBlob(blob: Blob): Promise<string> {
  const text = await blob.text()
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * Load image from blob and return as HTMLImageElement
 */
export async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Resize image to target width while maintaining aspect ratio
 */
export function resizeImage(
  img: HTMLImageElement,
  targetWidth: number
): ImageData {
  const aspectRatio = img.height / img.width
  const targetHeight = Math.round(targetWidth * aspectRatio)

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

  return ctx.getImageData(0, 0, targetWidth, targetHeight)
}

// Removed: `setupShareIntentListener` / `fetchFileFromUri` / `ShareIntentData`.
// They were the old share mechanism and could never work: `App.getLaunchUrl()` and the
// `appUrlOpen` event only fire for URL schemes / deep links, while an Android share sends
// EXTRA_TEXT / EXTRA_STREAM. Sharing is now handled by `useIncomingJobs()` +
// `src/services/native/ShareIntentBridge.ts`, which read the intent through a real plugin.
// See docs/plans/2026-09-29-rawbt-parity-analysis.md (K-1).

/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Convert ImageData to 1-bit thermal printer format using Floyd-Steinberg dithering
 */
export function imageDataToThermalFormat(imageData: ImageData): { data: Uint8Array; width: number; height: number } {
  const { width, height, data } = imageData

  // Convert to grayscale array
  const grayscale = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4] ?? 0
    const g = data[i * 4 + 1] ?? 0
    const b = data[i * 4 + 2] ?? 0
    // Luminance formula
    grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b
  }

  // Floyd-Steinberg dithering
  const threshold = 128
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const oldPixel = grayscale[idx] ?? 0
      const newPixel = oldPixel < threshold ? 0 : 255
      grayscale[idx] = newPixel
      const error = oldPixel - newPixel

      // Distribute error to neighbors
      if (x + 1 < width) {
        const nextIdx = idx + 1
        grayscale[nextIdx] = (grayscale[nextIdx] ?? 0) + error * 7 / 16
      }
      if (y + 1 < height) {
        const nextRowBase = (y + 1) * width
        if (x > 0) {
          const leftIdx = nextRowBase + (x - 1)
          grayscale[leftIdx] = (grayscale[leftIdx] ?? 0) + error * 3 / 16
        }
        const centerIdx = nextRowBase + x
        grayscale[centerIdx] = (grayscale[centerIdx] ?? 0) + error * 5 / 16
        if (x + 1 < width) {
          const rightIdx = nextRowBase + (x + 1)
          grayscale[rightIdx] = (grayscale[rightIdx] ?? 0) + error * 1 / 16
        }
      }
    }
  }

  // Convert to packed 1-bit format (8 pixels per byte)
  // For thermal printers: 1 = black (print), 0 = white (no print)
  const widthBytes = Math.ceil(width / 8)
  const output = new Uint8Array(widthBytes * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const byteIdx = y * widthBytes + Math.floor(x / 8)
      const bitIdx = 7 - (x % 8)

      // Black pixels (grayscale < 128) should be printed (bit = 1)
      const pixel = grayscale[idx] ?? 0
      if (pixel < 128) {
        output[byteIdx] = (output[byteIdx] ?? 0) | (1 << bitIdx)
      }
    }
  }

  return { data: output, width, height }
}
