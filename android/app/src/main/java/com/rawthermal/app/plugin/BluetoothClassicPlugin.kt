package com.rawthermal.app.plugin

import android.Manifest
import android.bluetooth.BluetoothDevice
import android.util.Base64
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.rawthermal.app.bluetooth.BluetoothPrinterManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Exposes Bluetooth Classic (SPP/RFCOMM) to the web layer.
 *
 * The socket handling is NOT reimplemented here: it delegates to [BluetoothPrinterManager],
 * the same class the Android PrintService uses, so both paths share one implementation and
 * cannot drift apart.
 *
 * This plugin is deliberately thin. Anything that can be decided in TypeScript (which device,
 * what to print, how to react to a failure) is decided there, where it can be unit tested.
 *
 * NOTE: this file has not been compiled. The machine this was written on has only JDK 8/12,
 * while Capacitor 8 requires JDK 17+, and compileSdk 35 is not installed. See
 * docs/plans/2026-09-29-rawbt-parity-analysis.md.
 */
@CapacitorPlugin(
    name = "BluetoothClassic",
    permissions = [
        Permission(
            strings = [Manifest.permission.BLUETOOTH_CONNECT],
            alias = BluetoothClassicPlugin.BLUETOOTH_ALIAS
        )
    ]
)
class BluetoothClassicPlugin : Plugin() {

    companion object {
        const val BLUETOOTH_ALIAS = "bluetooth"
    }

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val printerManager by lazy { BluetoothPrinterManager(context) }

    /**
     * BLUETOOTH_CONNECT became a runtime permission in Android 12. On older releases it is
     * granted at install time, so this resolves without showing a dialog.
     */
    @PluginMethod
    fun requestBluetoothPermission(call: PluginCall) {
        if (getPermissionState(BLUETOOTH_ALIAS) == PermissionState.GRANTED) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        requestPermissionForAlias(BLUETOOTH_ALIAS, call, "bluetoothPermissionCallback")
    }

    @PermissionCallback
    private fun bluetoothPermissionCallback(call: PluginCall) {
        val granted = getPermissionState(BLUETOOTH_ALIAS) == PermissionState.GRANTED
        call.resolve(JSObject().put("granted", granted))
    }

    @PluginMethod
    fun isEnabled(call: PluginCall) {
        call.resolve(JSObject().put("enabled", printerManager.isBluetoothEnabled()))
    }

    /**
     * Devices the user already paired in Android's Bluetooth settings.
     *
     * Classic printers cannot be discovered by a BLE scan, so pairing happens in the system
     * settings and we only list the result.
     */
    @PluginMethod
    fun listBondedDevices(call: PluginCall) {
        if (getPermissionState(BLUETOOTH_ALIAS) != PermissionState.GRANTED) {
            call.reject("Bluetooth permission not granted")
            return
        }

        val array = JSArray()
        printerManager.getBondedDevices().forEach { device ->
            val entry = JSObject()
            entry.put("address", device.address)
            entry.put("name", device.name ?: "")
            // getBondedDevices() only returns paired devices, so this is always true.
            entry.put("bonded", device.bondState == BluetoothDevice.BOND_BONDED)
            array.put(entry)
        }

        call.resolve(JSObject().put("devices", array))
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        val address = call.getString("address")
        if (address.isNullOrBlank()) {
            call.reject("address is required")
            return
        }
        if (getPermissionState(BLUETOOTH_ALIAS) != PermissionState.GRANTED) {
            call.reject("Bluetooth permission not granted")
            return
        }

        scope.launch {
            printerManager.connect(address).fold(
                onSuccess = { call.resolve() },
                onFailure = { error -> call.reject(error.message ?: "Failed to connect") }
            )
        }
    }

    @PluginMethod
    fun write(call: PluginCall) {
        val encoded = call.getString("data")
        if (encoded.isNullOrBlank()) {
            call.reject("data is required")
            return
        }

        val bytes = try {
            Base64.decode(encoded, Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
            call.reject("data is not valid base64")
            return
        }

        scope.launch {
            printerManager.write(bytes).fold(
                onSuccess = { call.resolve() },
                onFailure = { error -> call.reject(error.message ?: "Write failed") }
            )
        }
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        printerManager.disconnect()
        call.resolve()
    }

    override fun handleOnDestroy() {
        printerManager.disconnect()
        scope.cancel()
        super.handleOnDestroy()
    }
}
