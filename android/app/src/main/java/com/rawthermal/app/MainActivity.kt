package com.rawthermal.app

import android.content.Intent
import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.rawthermal.app.plugin.PrinterConfigPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(PrinterConfigPlugin::class.java)
        super.onCreate(savedInstanceState)
        handlePrintIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handlePrintIntent(intent)
    }

    private fun handlePrintIntent(intent: Intent?) {
        if (intent?.getStringExtra("action") == "SETUP_PRINTER_FOR_PRINT") {
            // Notify Vue app about pending print job via JavaScript event
            bridge?.let { b ->
                b.webView?.post {
                    b.webView?.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('pendingPrintJob', { detail: {} }));",
                        null
                    )
                }
            }
        }
    }
}
