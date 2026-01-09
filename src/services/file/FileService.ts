import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

export interface SelectedFile {
  name: string
  type: 'pdf' | 'image'
  mimeType: string
  blob: Blob
  size: number
}

export interface ShareIntentData {
  url?: string
  title?: string
  mimeType?: string
}

// Supported MIME types
const SUPPORTED_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',
} as const

type SupportedMimeType = keyof typeof SUPPORTED_TYPES

/**
 * Check if MIME type is supported
 */
export function isSupportedType(mimeType: string): mimeType is SupportedMimeType {
  return mimeType in SUPPORTED_TYPES
}

/**
 * Get file type from MIME type
 */
export function getFileType(mimeType: string): 'pdf' | 'image' | null {
  if (isSupportedType(mimeType)) {
    return SUPPORTED_TYPES[mimeType]
  }
  return null
}

/**
 * Pick a file using native file picker or HTML input
 */
export async function pickFile(): Promise<SelectedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf,image/jpeg,image/png,image/webp,image/bmp'

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      const fileType = getFileType(file.type)
      if (!fileType) {
        console.error('[FileService] Unsupported file type:', file.type)
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

/**
 * Setup share intent listener (Android)
 */
export function setupShareIntentListener(
  onShare: (data: ShareIntentData) => void
): () => void {
  if (!Capacitor.isNativePlatform()) {
    return () => {} // No-op for web
  }

  let listenerHandle: { remove: () => void } | null = null

  // Check for launch URL (app opened via share)
  App.getLaunchUrl().then((launchUrl) => {
    if (launchUrl?.url) {
      console.log('[FileService] App launched with URL:', launchUrl.url)
      onShare({ url: launchUrl.url })
    }
  })

  // Listen for app URL open events
  App.addListener('appUrlOpen', (data) => {
    console.log('[FileService] App URL opened:', data.url)
    onShare({ url: data.url })
  }).then((handle) => {
    listenerHandle = handle
  })

  return () => {
    listenerHandle?.remove()
  }
}

/**
 * Fetch file from content:// or file:// URI (Android)
 */
export async function fetchFileFromUri(uri: string): Promise<Blob | null> {
  try {
    const response = await fetch(uri)
    return await response.blob()
  } catch (error) {
    console.error('[FileService] Failed to fetch file from URI:', error)
    return null
  }
}

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
