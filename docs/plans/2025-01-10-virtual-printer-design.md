# Virtual Printer Design

**Date:** 2025-01-10
**Status:** Approved

## Overview

Membuat Raw Thermal selalu muncul sebagai printer di sistem Android (seperti RawBT), tanpa perlu konfigurasi manual terlebih dahulu.

## Flow

```
User print dari app lain
        ↓
Pilih "Raw Thermal" dari daftar printer
        ↓
    ┌───────────────────────────────┐
    │ Ada printer tersimpan & aktif? │
    └───────────────────────────────┘
        │                    │
       Ya                   Tidak
        ↓                    ↓
  Print langsung      Simpan job ke queue
                             ↓
                     Buka app → Printer page
                     (dengan banner pending job)
                             ↓
                     User connect printer
                             ↓
                     Print otomatis dari queue
```

## Keputusan Desain

1. **Nama printer:** "Raw Thermal" (simpel, sama dengan nama app)
2. **Tidak ada printer:** Buka app ke halaman Printer untuk setup
3. **Pending job:** Ditunda di queue, print otomatis setelah connect
4. **UI:** Banner di PrinterView menunjukkan ada job pending

## File yang Diubah

| File | Perubahan |
|------|-----------|
| `ThermalPrinterDiscoverySession.kt` | Selalu report "Raw Thermal" sebagai virtual printer |
| `ThermalPrintService.kt` | Handle pending job queue, trigger buka app jika perlu |
| `PrinterConfigManager.kt` | Tambah fungsi simpan/ambil pending print job |
| `MainActivity.kt` | Handle intent dari PrintService untuk buka Printer page |
| `PrinterView.vue` | Tampilkan banner jika ada pending job |
| `PrinterConfigBridge.ts` | Bridge untuk komunikasi pending job ke Vue |

## Komponen Baru

| File | Fungsi |
|------|--------|
| `PendingPrintJob.kt` | Data class untuk menyimpan info print job yang ditunda |

## Implementasi Detail

### ThermalPrinterDiscoverySession.kt

Selalu report virtual printer "Raw Thermal":

```kotlin
private fun reportConfiguredPrinters() {
    val printers = mutableListOf<PrinterInfo>()
    printers.add(createVirtualPrinter())
    addPrinters(printers)
}

private fun createVirtualPrinter(): PrinterInfo {
    val printerId = service.generatePrinterId("raw_thermal_virtual")
    return PrinterInfo.Builder(printerId, "Raw Thermal", PrinterInfo.STATUS_IDLE)
        .setCapabilities(buildPrinterCapabilities(printerId, 58))
        .setDescription("Thermal printer via Bluetooth")
        .build()
}
```

### ThermalPrintService.kt

Handle print job dengan logika queue:

```kotlin
override fun onPrintJobQueued(printJob: PrintJob) {
    scope.launch {
        val currentPrinter = configManager.getCurrentPrinter()

        if (currentPrinter != null) {
            processPrintJob(printJob, currentPrinter)
        } else {
            savePendingJob(printJob)
            openAppForPrinterSetup()
        }
    }
}
```

### PrinterView.vue

Tampilkan banner untuk pending job:

```vue
<div v-if="hasPendingJob" class="bg-yellow-500 text-white p-3">
  Ada dokumen menunggu dicetak. Pilih printer untuk melanjutkan.
</div>
```
