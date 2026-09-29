/**
 * Base64 helpers for the native bridge.
 *
 * Capacitor's bridge only carries JSON, so binary payloads travel as base64: raw ESC/POS
 * bytes written to a Bluetooth Classic socket, and the PDF of a pending print job.
 *
 * Hand-rolled rather than a one-liner because `btoa` needs a binary *string*, and building
 * that string with a single spread throws once the payload is large (the same V8 argument
 * limit that broke the raster encoder).
 */

/** Bytes per `String.fromCharCode` batch. Well under the V8 spread limit. */
const BATCH_SIZE = 0x8000

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += BATCH_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BATCH_SIZE))
  }
  return btoa(binary)
}

/**
 * Decode to a fresh, non-shared buffer.
 *
 * The `Uint8Array<ArrayBuffer>` return type is deliberate: a plain `Uint8Array` is typed over
 * `ArrayBufferLike`, which may be a `SharedArrayBuffer`, and that is not a valid `BlobPart`.
 * The buffer here is always freshly allocated, so saying so lets callers wrap it in a `Blob`
 * without a cast.
 */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
