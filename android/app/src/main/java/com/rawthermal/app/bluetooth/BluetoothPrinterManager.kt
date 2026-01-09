package com.rawthermal.app.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import java.io.IOException
import java.io.OutputStream
import java.util.UUID

/**
 * Manages Bluetooth connection to thermal printers using Classic Bluetooth (RFCOMM)
 * This is used by the PrintService which runs outside of Capacitor context
 */
class BluetoothPrinterManager(private val context: Context) {
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var socket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null

    companion object {
        private const val TAG = "BluetoothPrinterManager"

        // Standard Serial Port Profile UUID for Bluetooth printers
        private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

        // Chunk size for writing data (bytes)
        // Larger chunks = faster printing, most BT SPP can handle 8-16KB
        private const val CHUNK_SIZE = 8192

        // Delay between chunks (ms) - minimal delay, printer buffer handles flow control
        private const val CHUNK_DELAY_MS = 2L
    }

    init {
        val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = bluetoothManager?.adapter
    }

    /**
     * Check if Bluetooth is available and enabled
     */
    fun isBluetoothEnabled(): Boolean {
        return bluetoothAdapter?.isEnabled == true
    }

    /**
     * Connect to a Bluetooth device by its address
     */
    @SuppressLint("MissingPermission")
    suspend fun connect(deviceAddress: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            // Disconnect any existing connection
            disconnect()

            val adapter = bluetoothAdapter
                ?: return@withContext Result.failure(Exception("Bluetooth not available"))

            if (!adapter.isEnabled) {
                return@withContext Result.failure(Exception("Bluetooth is disabled"))
            }

            val device: BluetoothDevice = try {
                adapter.getRemoteDevice(deviceAddress)
            } catch (e: IllegalArgumentException) {
                return@withContext Result.failure(Exception("Invalid Bluetooth address: $deviceAddress"))
            }

            Log.d(TAG, "Connecting to device: ${device.name} ($deviceAddress)")

            // Cancel discovery to speed up connection
            adapter.cancelDiscovery()

            // Create RFCOMM socket and connect
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            socket?.connect()
            outputStream = socket?.outputStream

            Log.d(TAG, "Connected successfully to ${device.name}")
            Result.success(Unit)
        } catch (e: IOException) {
            Log.e(TAG, "Connection failed: ${e.message}")
            disconnect()
            Result.failure(Exception("Failed to connect: ${e.message}"))
        } catch (e: SecurityException) {
            Log.e(TAG, "Bluetooth permission denied: ${e.message}")
            Result.failure(Exception("Bluetooth permission denied"))
        }
    }

    /**
     * Write data to the connected printer
     * Data is sent in chunks to prevent buffer overflow
     */
    suspend fun write(data: ByteArray): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val output = outputStream
                ?: return@withContext Result.failure(Exception("Not connected to printer"))

            Log.d(TAG, "Writing ${data.size} bytes to printer")

            // Write in chunks to prevent buffer overflow on printer
            var offset = 0
            while (offset < data.size) {
                val chunkSize = minOf(CHUNK_SIZE, data.size - offset)
                output.write(data, offset, chunkSize)
                output.flush()
                offset += chunkSize

                // Add delay between chunks (except after last chunk)
                if (offset < data.size) {
                    delay(CHUNK_DELAY_MS)
                }
            }

            Log.d(TAG, "Write completed successfully")
            Result.success(Unit)
        } catch (e: IOException) {
            Log.e(TAG, "Write failed: ${e.message}")
            Result.failure(Exception("Write failed: ${e.message}"))
        }
    }

    /**
     * Disconnect from the printer
     */
    fun disconnect() {
        try {
            outputStream?.close()
        } catch (e: IOException) {
            Log.w(TAG, "Error closing output stream: ${e.message}")
        }

        try {
            socket?.close()
        } catch (e: IOException) {
            Log.w(TAG, "Error closing socket: ${e.message}")
        }

        outputStream = null
        socket = null
        Log.d(TAG, "Disconnected")
    }

    /**
     * Check if currently connected
     */
    fun isConnected(): Boolean {
        return socket?.isConnected == true
    }

    /**
     * Get bonded (paired) Bluetooth devices
     */
    @SuppressLint("MissingPermission")
    fun getBondedDevices(): List<BluetoothDevice> {
        return try {
            bluetoothAdapter?.bondedDevices?.toList() ?: emptyList()
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied for bonded devices: ${e.message}")
            emptyList()
        }
    }
}
