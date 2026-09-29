/**
 * Normalisation of what another app handed us through a share intent.
 *
 * The Android side stays deliberately dumb: it only reports "here is some text" or "here are
 * some bytes, with this name and MIME type". Deciding what that means — and rejecting junk —
 * happens here, where it can be unit tested without a device.
 */

export interface SharedPayloadInput {
  /** `Intent.EXTRA_TEXT`. */
  text?: string | null
  /** Display name of the shared file, when there was one. */
  name?: string | null
  /** MIME type reported by the sending app. */
  mimeType?: string | null
  /** File contents, base64 encoded. */
  base64?: string | null
}

export interface SharedTextPayload {
  kind: 'text'
  text: string
  /** Subject/label the sending app provided, if any. */
  title: string | null
}

export interface SharedFilePayload {
  kind: 'file'
  name: string
  mimeType: string
  base64: string
}

export type SharedPayload = SharedTextPayload | SharedFilePayload

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/markdown': 'md',
  'application/json': 'json',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/gif': 'gif'
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/

/**
 * Strip anything that is not base64 and reject strings that cannot be decoded.
 *
 * Whitespace is removed first because Android's `Base64.DEFAULT` wraps at 76 columns, so a
 * payload produced by another app may contain newlines even though we always emit unwrapped
 * output ourselves.
 */
function normalizeBase64(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null

  const compact = raw.replace(/\s+/g, '')
  if (compact.length === 0) return null
  if (compact.length % 4 !== 0) return null
  if (!BASE64_PATTERN.test(compact)) return null

  return compact
}

/** `\uFEFF` at the start of shared text would otherwise print as a stray glyph. */
function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value
}

export function extensionForMimeType(mimeType: string): string {
  return MIME_EXTENSIONS[mimeType.toLowerCase()] ?? 'bin'
}

/**
 * A file name the user can recognise in the preview.
 *
 * The sender's name wins when it actually carries an extension; otherwise a name is derived
 * from the MIME type so the preview never shows a blank or extensionless label.
 */
export function deriveSharedFileName(name: string | null | undefined, mimeType: string): string {
  const candidate = (name ?? '').trim()
  if (candidate.length > 0 && /\.[A-Za-z0-9]+$/.test(candidate)) {
    return candidate
  }

  const extension = extensionForMimeType(mimeType)
  if (candidate.length > 0) {
    return `${candidate}.${extension}`
  }
  return `shared.${extension}`
}

/**
 * Turn a raw bridge response into a payload, or `null` when there is nothing usable.
 *
 * File bytes take precedence over text: a share that carries both is a file share whose
 * `EXTRA_TEXT` is only a description, and printing the description instead of the document
 * would be the wrong guess.
 */
export function parseSharedPayload(input: SharedPayloadInput): SharedPayload | null {
  const base64 = normalizeBase64(input.base64)

  if (base64 !== null) {
    const mimeType = (input.mimeType ?? '').trim() || 'application/octet-stream'
    return {
      kind: 'file',
      name: deriveSharedFileName(input.name, mimeType),
      mimeType,
      base64
    }
  }

  const text = stripBom(input.text ?? '')
  if (text.trim().length === 0) return null

  const title = (input.name ?? '').trim()
  return { kind: 'text', text, title: title.length > 0 ? title : null }
}
