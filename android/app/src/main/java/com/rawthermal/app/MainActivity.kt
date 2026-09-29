package com.rawthermal.app

import android.content.Intent
import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.rawthermal.app.plugin.BluetoothClassicPlugin
import com.rawthermal.app.plugin.PrinterConfigPlugin
import com.rawthermal.app.plugin.ShareIntentPlugin
import com.rawthermal.app.share.ShareIntentReader
import com.rawthermal.app.share.SharedIntentHolder

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // Must happen before super.onCreate(): BridgeActivity.load() builds the bridge from the
        // registered plugins and then routes the launch intent through onNewIntent().
        registerPlugin(PrinterConfigPlugin::class.java)
        registerPlugin(BluetoothClassicPlugin::class.java)
        registerPlugin(ShareIntentPlugin::class.java)

        super.onCreate(savedInstanceState)
    }

    /**
     * Both the cold-start launch intent and every later intent land here, because the activity
     * is declared `singleTask`. Sharing into an already-running app therefore arrives as an
     * onNewIntent rather than a fresh launch.
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent == null) return

        // The PrintService opens the app when a print job is queued but no printer is
        // configured yet. The job itself is already persisted natively; this only nudges the UI.
        if (intent.getStringExtra("action") == "SETUP_PRINTER_FOR_PRINT") {
            notifyWeb("pendingPrintJob")
            return
        }

        // Anything else is either a share/view intent or an ordinary launcher tap, which
        // ShareIntentReader rejects by returning null.
        val shared = ShareIntentReader.read(this, intent) ?: return
        SharedIntentHolder.set(shared)
        notifyWeb("sharedIntent")
    }

    /**
     * Tells the web layer to look at native state again.
     *
     * Only a hint: on a cold start this runs before the page has registered its listeners and
     * is silently lost, which is why the payload is also *pulled* through ShareIntentPlugin.
     */
    private fun notifyWeb(event: String) {
        bridge?.webView?.post {
            bridge?.webView?.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('$event', { detail: {} }));",
                null
            )
        }
    }
}
