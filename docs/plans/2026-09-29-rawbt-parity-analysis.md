# Analisa Parity: RawBT vs raw-thermal

**Tanggal:** 2026-09-29
**Status:** Analisa + implementasi P0/P1 selesai di kode
**Pertanyaan:** Apakah project ini bisa mendekati RawBT?

---

## Jawaban singkat

**Bisa — dan sekarang jauh lebih dekat.** Yang sudah dibangun sejak awal (Android
`PrintService` + render PDF ke raster + ESC/POS + BLE) justru bagian tersulit, dan itu sudah
ada. Dua jalur yang sebelumnya **mati total** — share intent dan pending print job — sekarang
punya implementasi lengkap, dan Bluetooth Classic SPP membuka kelas printer yang paling banyak
dipakai bersama RawBT.

Estimasi: **~75–80% parity di kode** (naik dari ~55–60%), **tidak ada lagi jalur yang mati**.

> **Baca bagian 7 dulu kalau mau menilai risiko.** Seluruh perubahan native sesi ini
> **belum pernah dikompilasi**, karena mesin ini tidak punya JDK 17+ maupun `compileSdk 35`.
> Yang terverifikasi di sini adalah sisi TypeScript-nya; sisi Kotlin adalah kode yang ditulis
> hati-hati tapi belum dibuktikan.

---

## 1. Permukaan integrasi RawBT (referensi terverifikasi)

Diambil dari repo resmi RawBT: [`402d/DemoRawBtPrinter`](https://github.com/402d/DemoRawBtPrinter)
dan [`402d/RawbtAPI`](https://github.com/402d/RawbtAPI).

| # | Jalur | Detail teknis |
|---|-------|---------------|
| 1 | **Share teks** | `ACTION_SEND` + `EXTRA_TEXT` (String *atau* CharSequence), type `text/plain` |
| 2 | **Share file** | `ACTION_SEND` + `EXTRA_STREAM` (Uri), type `image/*`, `application/pdf`, `text/plain`. Wajib `FileProvider` + `FLAG_GRANT_READ_URI_PERMISSION` |
| 3 | **Buka file** | `ACTION_VIEW` dengan `setDataAndType(uri, mime)` |
| 4 | **API raw ESC/POS** | Action `ru.a402d.rawbtprinter.action.PRINT_RAWBT`, extra `ru.a402d.rawbtprinter.extra.DATA`. Isi: teks biasa **atau** `base64,<bytes>` untuk perintah ESC/POS mentah. Dijaga permission `ru.a402d.rawbtprinter.PERMISSION` |
| 5 | **Print framework** | `PrintService` + `PrintDocumentAdapter` kustom — inilah yang membuat RawBT muncul di dialog print Gmail/Word |
| 6 | **Koneksi** | Bluetooth (Classic **dan** BLE), WiFi/Ethernet, USB |
| 7 | **Codepage** | Contoh resmi RawBT mengirim bytes dengan `getBytes("cp866")` — encoding ditangani di sisi pengirim |

Poin penting: RawBT menerima teks **dan** perintah ESC/POS mentah. Itu yang membuatnya bisa
dipakai oleh aplikasi kasir/POS mana pun tanpa driver.

---

## 2. Scorecard

| Kapabilitas | RawBT | raw-thermal | Verdict |
|---|---|---|---|
| PrintService (muncul di dialog print) | ✅ | ✅ `ThermalPrintService.kt` | **Setara** |
| Render PDF → raster termal | ✅ | ✅ `ThermalPdfRenderer.kt` + `ImageDithering.kt` | **Setara** |
| ESC/POS: teks, QR, barcode, cut, cash drawer | ✅ | ✅ `EscPosEncoder.ts` / `.kt` | **Setara** |
| Print dari file PDF/gambar/teks (in-app) | ✅ | ✅ `FilePrintView.vue` | **Setara** |
| Codepage / encoding | ✅ | ✅ 9 codepage + Katakana, `ESC t n` | **Setara** |
| Share **teks** (`text/plain`) | ✅ | ✅ manifest + `ShareIntentPlugin` + parser teruji | **Setara (belum diuji di perangkat)** |
| Share **gambar/PDF** | ✅ | ✅ jalur yang sama dengan share teks | **Setara (belum diuji di perangkat)** |
| Buka file (`ACTION_VIEW`) | ✅ | ✅ `ShareIntentReader.readUri` | **Setara (belum diuji di perangkat)** |
| Antrian job saat printer belum siap | ✅ | ✅ PDF antrian dibaca, dicetak, baru dihapus | **Setara (belum diuji di perangkat)** |
| Bluetooth **BLE** | ✅ | ✅ `BleTransport` | **Setara** |
| Bluetooth **Classic SPP** | ✅ | ✅ `BluetoothClassicPlugin` + `ClassicSppTransport` | **Setara (belum diuji di perangkat)** |
| API raw ESC/POS dari app lain | ✅ | ❌ Tidak ada | **Hilang (P2)** |
| USB (OTG) | ✅ | ❌ Tidak ada | **Hilang (P2)** |
| WiFi / Ethernet (port 9100) | ✅ | ❌ Tidak ada | **Hilang (P2)** |
| CJK (GB2312/GBK) | ✅ | ❌ Sengaja tidak ada | **Terbatas (lihat 7)** |

---

## 3. Temuan kritis — status akhir

### ✅ K-1 — Share intent mati total → **diperbaiki**

Tiga cacat yang saling menumpuk, semuanya sudah ditangani:

1. **Listener tidak pernah dipanggil.** `setupShareIntentListener()` masih ada di
   `FileService.ts` tetapi tetap tanpa pemanggil. Digantikan `useIncomingJobs()`, yang
   dipasang sekali di `App.vue`.
2. **Mekanismenya salah sejak awal.** `App.getLaunchUrl()` / `appUrlOpen` hanya menyala untuk
   URL scheme/deep link. Digantikan `ShareIntentPlugin` yang membaca
   `EXTRA_TEXT`/`EXTRA_STREAM` langsung dari `Intent`.
3. **`text/plain` tidak diterima.** Filter intent sekarang punya `text/plain` untuk `SEND`
   **dan** `VIEW`.

### ✅ K-2 — Setting `encoding` adalah dead setting → **diperbaiki (sesi 1)**

`EscPosEncoder` sekarang benar-benar memakai `encoding`: `initialize()` mengirim `ESC t n`,
`text()` meng-encode per codepage, dan karakter yang tidak terwakili dilaporkan lewat getter
`unmapped`. Terverifikasi byte-per-byte di test.

### ✅ K-3 — Pending print job dibuang, bukan dicetak → **diperbaiki**

Rantai lengkapnya sekarang:

```
ThermalPrintService  →  simpan PDF ke cache + block() + buka app
        ↓
PrinterConfigPlugin.getPendingJobData()   ← BARU: baca PDF → base64 (di Dispatchers.IO)
        ↓
PrinterView.processPendingJobs()          ← ambil job tertua, jangan Clear-all
        ↓
buildIncomingJob({ source: 'pending-job' })  → autoPrint: true
        ↓
FilePrintView  →  loadFile() → printSelected()
        ↓
removePendingPrintJobNative(jobId)        ← hanya kalau cetak BERHASIL
```

Yang penting: job **tidak** dihapus lebih dulu. Kalau pencetakan gagal, dokumen user tetap ada.
Sebelumnya `clearPendingPrintJobsNative()` dipanggil tanpa syarat, jadi dokumen hilang tanpa
pernah tercetak.

### ✅ K-4 — Hanya BLE, bukan Bluetooth Classic → **diperbaiki**

`BluetoothPrinterManager.kt` ternyata **sudah** mengimplementasikan SPP/RFCOMM
(`00001101-0000-1000-8000-00805F9B34FB`, potongan 8 KB). Yang hilang hanya jembatan ke web
layer, bukan soketnya. Jadi `BluetoothClassicPlugin.kt` adalah lapisan delegasi tipis, dan
implementasi soket tidak diduplikasi — jalur PrintService dan jalur in-app memakai kode yang
sama sehingga tidak bisa saling menyimpang.

Di sisi TypeScript, BLE dan Classic disatukan di balik antarmuka `PrinterTransport`
(`connect`/`write`/`disconnect`/`isConnected`), dengan `ScannableTransport` untuk BLE dan
`BondedTransport` untuk Classic.

### ⏳ K-5 — Tidak ada API untuk aplikasi lain → **belum (P2)**

Tidak ada padanan `PRINT_RAWBT`. Aplikasi POS/kasir pihak ketiga masih belum punya cara
mengirim perintah ESC/POS langsung ke Raw Thermal.

### ✅ K-6 — `push(...bytes)` bisa melempar RangeError → **diperbaiki (sesi 1)**

Ambangnya diukur langsung di mesin ini (Node 22.22.2): 100.000 byte OK, 200.000 byte
`RangeError`. Sekarang per-byte, dengan test regresi pada 200.000 byte.

---

## 4. Roadmap prioritas

| Prioritas | Pekerjaan | Verifikasi | Status |
|---|---|---|---|
| **P0** | Hidupkan `encoding`: tabel codepage + `ESC t n` + encode teks | Test byte-level | ✅ **Selesai** |
| **P0** | Cetak teks: dukung file `.txt`/teks, wrap ke lebar kertas, peringatan karakter tak terwakili | Test + build | ✅ **Selesai** |
| **P0** | Perbaiki `push(...bytes)` (K-6) | Test regresi | ✅ **Selesai** |
| **P0** | Jalur share: `text/plain` di manifest + plugin penerima intent | 27 test baru + typecheck + build | ✅ **Selesai di kode** ⚠️ perlu perangkat |
| **P1** | Cetak pending job yang tersimpan (selesaikan K-3) | Test + alur lengkap | ✅ **Selesai di kode** ⚠️ perlu perangkat |
| **P1** | Bluetooth Classic SPP (plugin native) | Antarmuka transport teruji | ✅ **Selesai di kode** ⚠️ perlu perangkat |
| **P2** | Intent API `PRINT_RAWBT` (base64 ESC/POS) | Perlu perangkat nyata | Belum |
| **P2** | USB OTG + WiFi port 9100 | Perlu perangkat nyata | Belum |

---

## 5. Yang dikerjakan

```
npm test          → 60 test lulus
npm run typecheck → bersih (vue-tsc + tsc untuk test)
npm run build     → sukses
```

### 5.1 Sesi 1 — pipeline teks + codepage (P0)

| Berkas | Perubahan |
|---|---|
| `src/services/escpos/codepageTables.ts` | **Baru.** Tabel byte 0x80-0xFF untuk 9 codepage + Katakana, dihasilkan dari codec standar (bukan diketik tangan) |
| `src/services/escpos/codepages.ts` | **Baru.** Daftar codepage + nilai `ESC t n`, pemetaan balik, transliterasi, `encodeText()` |
| `src/services/escpos/EscPosEncoder.ts` | `encoding` yang selama ini diabaikan sekarang dipakai; `initialize()` mengirim `ESC t n`; `text()` encode per codepage; `wrapText()`/`textBlock()`; `unmapped` getter; perbaikan spread (K-6) |
| `src/stores/settings.ts` | `encoding` jadi `CodepageId`; migrasi nilai lama; `PAPER_COLUMNS`; daftar codepage untuk UI |
| `src/views/SettingsView.vue` | Dropdown codepage dari definisi, bukan hardcode; catatan bantuan |
| `src/composables/usePrint.ts` | Encoder memakai encoding dari Settings; `printTextDocument()`; lebar kolom dari satu sumber |
| `src/composables/usePaper.ts` | **Baru.** Satu sumber kebenaran untuk lebar kolom kertas |
| `src/composables/useFilePrint.ts` | Cabang teks: baca teks, preview, cetak sebagai teks (bukan raster) |
| `src/services/file/FileService.ts` | `text/plain` + fallback ekstensi; `readTextFromBlob()` |
| `src/views/FilePrintView.vue` | Preview teks, peringatan karakter tak terwakili |
| `tests/escpos/*.test.ts` | **Baru.** 33 test, dijalankan `node --test` tanpa dependency tambahan |
| `tsconfig.test.json`, `package.json` | `npm test` dan `npm run typecheck` |

### 5.2 Sesi 2 — share intent + pending job + Bluetooth Classic (sisa P0, P1)

**Android (Kotlin)** — 4 berkas baru, 3 diubah:

| Berkas | Perubahan |
|---|---|
| `android/.../share/SharedIntentHolder.kt` | **Baru.** `set()` / `peek()` / `consume()`. Payload disimpan sampai webview mengambilnya, dan `consume()` membuat satu share mustahil tercetak dua kali (termasuk saat activity dibuat ulang) |
| `android/.../share/ShareIntentReader.kt` | **Baru.** `ACTION_SEND`/`ACTION_VIEW` → `SharedIntentPayload`. File dibaca 16 KB per potong, dibatasi 25 MB — tanpa batas, PDF besar jadi crash OOM, bukan gagal cetak |
| `android/.../plugin/ShareIntentPlugin.kt` | **Baru.** `hasSharedPayload()` + `getSharedPayload()` (sekali pakai) |
| `android/.../plugin/BluetoothClassicPlugin.kt` | **Baru.** Delegasi ke `BluetoothPrinterManager`; permission `BLUETOOTH_CONNECT` lewat alias |
| `android/.../plugin/PrinterConfigPlugin.kt` | `getPendingJobData()` — baca PDF antrian → base64, dijalankan di `Dispatchers.IO` (baca multi-MB di main thread akan ANR) |
| `android/.../MainActivity.kt` | Daftarkan 3 plugin; tangani share intent di `onNewIntent` — `singleTask` membuat share ke app yang sedang berjalan masuk sebagai `onNewIntent`, bukan launch baru. Sekaligus **memperbaiki bug**: `onCreate` lama memanggil `handlePrintIntent(intent)` yang tidak pernah jalan untuk share |
| `android/app/src/main/AndroidManifest.xml` | Filter `text/plain` untuk `SEND` **dan** `VIEW` |

**TypeScript** — 9 berkas baru, 7 diubah:

| Berkas | Perubahan |
|---|---|
| `src/services/share/sharedPayload.ts` | **Baru.** Parser murni: file menang atas teks, validasi base64 (buang spasi/newline, cek panjang %4 dan alfabet), buang BOM, turunkan nama berkas dari MIME |
| `src/services/share/incoming.ts` | **Baru.** `buildIncomingJob()` — payload bridge → `SelectedFile`. Mengembalikan `{ok:false, reason}` supaya penolakan bisa dijelaskan, bukan didiamkan |
| `src/services/native/ShareIntentBridge.ts` | **Baru.** Bungkus `ShareIntentPlugin`; `SHARED_INTENT_EVENT` untuk warm start |
| `src/services/native/BluetoothClassicBridge.ts` | **Baru.** `isClassicSupported`, `classicListBondedDevices`, `classicConnect`, `classicWriteBase64`, `classicDisconnect` |
| `src/services/transport/PrinterTransport.ts` | **Baru.** Antarmuka bersama + `ScannableTransport` + `BondedTransport` |
| `src/services/transport/BleTransport.ts` | **Baru.** Bungkus `BluetoothService` yang sudah ada |
| `src/services/transport/ClassicSppTransport.ts` | **Baru.** Menghapus status "terhubung" pada kegagalan tulis — begitulah printer yang mati/di luar jangkauan terlihat |
| `src/services/transport/base64.ts` | **Baru.** Per-batch `String.fromCharCode`, bukan satu spread (batas V8 yang sama dengan K-6) |
| `src/services/transport/index.ts` | **Baru.** Singleton lazy + transport aktif |
| `src/services/file/fileTypes.ts` | **Baru.** Klasifikasi MIME/ekstensi dipisah dari `FileService` supaya bebas dependensi (dan bisa diuji Node) |
| `src/stores/incoming.ts` | **Baru.** Dokumen yang masuk dari luar layar cetak, plus alasan penolakan |
| `src/composables/useIncomingJobs.ts` | **Baru.** Dipasang di `App.vue`: tarik payload saat mount + dengar event warm start |
| `src/composables/useBluetooth.ts` | Berbasis transport; tambah `isClassicAvailable()`, `listPairedDevices()`, `connectClassic()`, `connectSaved()`, `resolveTransport()` |
| `src/composables/useFilePrint.ts` | `printSelected()` mengembalikan `boolean` — pemanggil yang memiliki job antrian perlu tahu berhasil atau tidak |
| `src/views/PrinterView.vue` | Bagian **Paired Printers** (Classic); `processPendingJobs()` benar-benar mencetak; tombol Print now / Discard |
| `src/views/FilePrintView.vue` | Konsumsi dokumen masuk, auto-print untuk job antrian, hapus job hanya setelah sukses; banner penolakan |
| `src/App.vue` | `useIncomingJobs()` |
| `src/types/printer.ts` | `TransportKind`, `TransportDevice`, `Printer.transport` (opsional → printer lama tetap jalan sebagai BLE) |
| `tsconfig.test.json` | `include` diperluas ke modul yang sekarang diuji |

**Test** — 3 berkas baru, 27 test (33 → **60**):

| Berkas | Isi |
|---|---|
| `tests/transport/base64.test.ts` | 5 test — round-trip, byte ESC/POS persis, tanpa newline, muatan 200.000 byte, kosong |
| `tests/share/sharedPayload.test.ts` | 12 test — file vs teks, base64 terbungkus/newline, base64 rusak, BOM, penamaan |
| `tests/share/incoming.test.ts` | 10 test — PDF/gambar/teks, penyelamatan lewat ekstensi, penolakan ber-alasan, `autoPrint` |

---

## 6. Jalur share: apa yang akhirnya dibangun

Rencana di sesi 1 sudah diterapkan, dengan dua koreksi penting:

**Koreksi 1 — web layer menarik, bukan didorong.** Rencana awal menyimpan payload di
`companion object` lalu mengirim event ke webview. Masalahnya: pada **cold start** intent
diproses sebelum webview menjalankan JavaScript, jadi event dikirim ke halaman yang belum punya
listener dan hilang. Karena itu payload disimpan di `SharedIntentHolder` dan **ditarik** lewat
`ShareIntent.getSharedPayload()` saat `App.vue` mount. Event `sharedIntent` tetap dikirim, tapi
hanya sebagai kemudahan untuk warm start — bukan sebagai mekanisme utama.

Bukti bahwa cold start memang lewat `onNewIntent`: `BridgeActivity.load()` memanggil
`this.onNewIntent(getIntent())` (terverifikasi di
`node_modules/@capacitor/android/.../BridgeActivity.java:51`), dan `onCreate` memanggil
`load()` di akhir. Jadi satu penanganan di `onNewIntent` mencakup launch pertama **dan** share
berikutnya, tanpa duplikasi.

**Koreksi 2 — satu parser, bukan dua.** Rencana awal menaruh logika "ini teks atau file" di
Kotlin. Sekarang Kotlin sengaja tetap bodoh: ia hanya melaporkan "ada teks" atau "ada byte,
dengan nama dan MIME ini". Keputusan — termasuk menolak base64 yang rusak — ada di
`sharedPayload.ts`, yang bisa diuji tanpa perangkat. Ini penting justru karena sisi native
tidak bisa diverifikasi di mesin ini.

---

## 7. Batasan yang diakui

- **Sisi native sesi ini belum pernah dikompilasi.** Mesin ini hanya punya JDK 8 dan JDK 12;
  Capacitor 8 menetapkan `JavaVersion.VERSION_21` dan butuh JDK 17+. `compileSdk 35` juga tidak
  terpasang (yang ada hanya `android-23`…`android-28`), tidak ada `cmdline-tools`, dan
  `kotlinc` tidak ada. Jadi **jangan** mengklaim perubahan Android "beres" tanpa build di mesin
  lain.
  Yang bisa dan sudah dilakukan sebagai gantinya: setiap signature Capacitor yang dipakai
  (`getPermissionState`, `requestPermissionForAlias`, `@PermissionCallback` pada method
  private, `handleOnDestroy`, `handleOnNewIntent`, `JSObject.put`) dicek langsung ke sumber
  `@capacitor/android` yang terpasang, dan versi `androidx.core` (1.13.1) dikonfirmasi memang
  punya `IntentCompat` (butuh ≥ 1.10).
- **CJK (GB2312/GBK) tidak diimplementasikan.** Encoding multi-byte butuh tabel ~20.000 entri
  yang tidak bisa ditulis tangan. Opsi `GB2312` di UI **dihapus** karena selama ini memang tidak
  berfungsi, dan nilai tersimpan lama dimigrasikan ke UTF-8. Jalur yang benar untuk CJK: pakai
  mode UTF-8 bawaan printer, atau bundel tabel GB18030 ringkas saat build.
- **Manifest sekarang memasang filter `text/plain`.** Konsekuensinya Raw Thermal muncul di
  share sheet untuk berbagi teks — termasuk saat membagikan URL. Ini memang tujuannya
  (itu yang membuat "print text from Gmail/Word" bekerja), tapi artinya aplikasi harus di-build
  ulang sebelum manifest baru berlaku.
- **USB OTG dan WiFi port 9100 belum ada** (P2), begitu juga API `PRINT_RAWBT` (P2).
