import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Raw payload from `ShareIntentPlugin`, before any interpretation.
 *
 * Keys are absent rather than null when the sending app did not provide them, which is why
 * every field is optional here.
 */
export interface SharedIntentPayload {
  text?: string | null
  name?: string | null
  mimeType?: string | null
  base64?: string | null
}

/**
 * Fired by MainActivity when a share or view intent arrives while the app is already running.
 *
 * Cold starts do not get this event — the intent is handled before the page has loaded — which
 * is why `collectSharedIntent()` is also called on mount instead of relying on the event alone.
 */
export const SHARED_INTENT_EVENT = 'sharedIntent'

interface ShareIntentPlugin {
  hasSharedPayload(): Promise<{ available: boolean }>
  getSharedPayload(): Promise<SharedIntentPayload>
}

const ShareIntent = registerPlugin<ShareIntentPlugin>('ShareIntent')

/** Sharing into the app is an Android-only path; there is no web equivalent. */
export function isShareIntentSupported(): boolean {
  return Capacitor.isNativePlatform()
}

export async function hasSharedPayloadNative(): Promise<boolean> {
  if (!isShareIntentSupported()) return false
  try {
    const result = await ShareIntent.hasSharedPayload()
    return result.available === true
  } catch (error) {
    console.error('[ShareIntentBridge] Failed to check for a shared payload:', error)
    return false
  }
}

/**
 * Take whatever was shared with us, or `null` when there is nothing waiting.
 *
 * The native side consumes the payload, so calling this twice returns the data once and then
 * `null` — a share can never be printed twice.
 */
export async function getSharedPayloadNative(): Promise<SharedIntentPayload | null> {
  if (!isShareIntentSupported()) return null

  try {
    const raw = await ShareIntent.getSharedPayload()
    if (!raw) return null

    // The native side omits empty keys; normalise to null so the parser sees one shape.
    const payload: SharedIntentPayload = {
      text: raw.text ?? null,
      name: raw.name ?? null,
      mimeType: raw.mimeType ?? null,
      base64: raw.base64 ?? null
    }

    const isEmpty =
      payload.text === null &&
      payload.base64 === null &&
      payload.name === null &&
      payload.mimeType === null

    return isEmpty ? null : payload
  } catch (error) {
    console.error('[ShareIntentBridge] Failed to read the shared payload:', error)
    return null
  }
}
