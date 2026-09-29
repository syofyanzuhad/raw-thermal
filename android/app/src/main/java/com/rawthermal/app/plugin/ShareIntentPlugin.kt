package com.rawthermal.app.plugin

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.rawthermal.app.share.SharedIntentHolder

/**
 * Hands the web layer whatever another app shared with us.
 *
 * Why this is a plugin and not `App.getLaunchUrl()`: that API — and the `appUrlOpen` event —
 * only fire for URL schemes / deep links. An Android share sends `EXTRA_TEXT` or
 * `EXTRA_STREAM`, which never reaches them. See
 * docs/plans/2026-09-29-rawbt-parity-analysis.md section 6.
 *
 * The web layer *pulls* rather than being pushed to. On a cold start the share intent arrives
 * before the webview has run any JavaScript, so a pushed event would be dispatched into a page
 * that has no listener yet; MainActivity still pings the webview, but the pull is what makes
 * cold start reliable.
 *
 * NOTE: this file has not been compiled. The machine this was written on has only JDK 8/12,
 * while Capacitor 8 requires JDK 17+, and compileSdk 35 is not installed.
 */
@CapacitorPlugin(name = "ShareIntent")
class ShareIntentPlugin : Plugin() {

    @PluginMethod
    fun hasSharedPayload(call: PluginCall) {
        call.resolve(JSObject().put("available", SharedIntentHolder.peek() != null))
    }

    /**
     * Consumes the payload, so one share can never be printed twice — including when the
     * activity is recreated on a configuration change.
     */
    @PluginMethod
    fun getSharedPayload(call: PluginCall) {
        val payload = SharedIntentHolder.consume()

        val result = JSObject()
        if (payload == null) {
            // An empty object means "nothing waiting"; the TS bridge turns that into null.
            call.resolve(result)
            return
        }

        // Only set the keys that actually carry a value. JSONObject.put(key, null) would drop
        // the key anyway, and being explicit keeps the TS side's null checks honest.
        payload.text?.let { result.put("text", it) }
        payload.name?.let { result.put("name", it) }
        payload.mimeType?.let { result.put("mimeType", it) }
        payload.base64?.let { result.put("base64", it) }

        call.resolve(result)
    }
}
