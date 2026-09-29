/**
 * What kind of file did we get?
 *
 * Kept free of any import so it can be unit tested by Node's test runner and used from code
 * that has no business pulling in Capacitor — the share-intent parser, for instance.
 */

export interface SelectedFile {
  name: string
  type: 'pdf' | 'image' | 'text'
  mimeType: string
  blob: Blob
  size: number
}

/** MIME types the print pipeline can actually handle. */
export const SUPPORTED_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',
  'text/plain': 'text'
} as const

export type SupportedMimeType = keyof typeof SUPPORTED_TYPES

/**
 * Fallback when the MIME type is empty or unhelpful.
 *
 * Android and some browsers hand back '' or application/octet-stream for a .txt file, so the
 * extension is often the only reliable signal.
 */
export const EXTENSION_TYPES: Record<string, 'pdf' | 'image' | 'text'> = {
  pdf: 'pdf',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  bmp: 'image',
  gif: 'image',
  txt: 'text',
  log: 'text',
  csv: 'text',
  md: 'text',
  json: 'text'
}

export function isSupportedType(mimeType: string): mimeType is SupportedMimeType {
  return mimeType in SUPPORTED_TYPES
}

export function getFileType(mimeType: string): 'pdf' | 'image' | 'text' | null {
  if (isSupportedType(mimeType)) {
    return SUPPORTED_TYPES[mimeType]
  }
  return null
}

export function getFileTypeFromName(fileName: string): 'pdf' | 'image' | 'text' | null {
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (!extension) return null
  return EXTENSION_TYPES[extension] ?? null
}
