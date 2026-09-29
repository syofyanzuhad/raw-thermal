package com.rawthermal.app.share

/**
 * What another app handed us, before any interpretation.
 *
 * Field names match what the TypeScript parser expects. Deciding whether this is text or a
 * file, validating the base64, and choosing a display name all happen in
 * `src/services/share/sharedPayload.ts`, where it can be unit tested.
 */
data class SharedIntentPayload(
    val text: String? = null,
    val name: String? = null,
    val mimeType: String? = null,
    val base64: String? = null
)

/**
 * Holds a payload until the web layer collects it.
 *
 * A share intent arrives before the webview exists (cold start) or independently of it (warm
 * start), so the payload cannot be delivered by a direct call. MainActivity stores it here and
 * pings the webview; the plugin then hands it over exactly once.
 */
object SharedIntentHolder {

    @Volatile
    private var payload: SharedIntentPayload? = null

    fun set(value: SharedIntentPayload) {
        payload = value
    }

    /** Read without consuming, for "is there anything waiting?" checks. */
    fun peek(): SharedIntentPayload? = payload

    /**
     * Returns the payload and clears it, so a single share is never printed twice — including
     * across a configuration change that re-runs the activity.
     */
    fun consume(): SharedIntentPayload? {
        val value = payload
        payload = null
        return value
    }
}
