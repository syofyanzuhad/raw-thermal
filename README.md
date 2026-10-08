# Raw Thermal

An open-source ESC/POS thermal printer app for Android. It prints receipts, PDFs, images and
plain text over Bluetooth — from inside the app, or from any other app through Android's share
sheet and system print dialog.

Built as a free alternative to [RawBT](https://github.com/402d/RawbtAPI).

- **Web layer:** Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS 4
- **Android shell:** Capacitor 8 (Kotlin), plus a native Android `PrintService`
- **Wire protocol:** ESC/POS over Bluetooth Classic SPP or Bluetooth LE

---

## Project status

- **TypeScript side:** Verified (**60 tests pass**, `typecheck` is clean, `build` succeeds).
- **Android / Kotlin side:** Built and compiled successfully with JDK 21 (`./gradlew assembleDebug` produces `app-debug.apk`). See [Building the Android app](#building-the-android-app).

---

## What it does

| Feature | Where |
|---|---|
| Print plain text with alignment, bold, underline, font size | `PrintView` |
| Print QR codes and 1D barcodes (CODE128, EAN13, EAN8, UPC-A/E, CODE39, ITF, CODABAR, CODE93) | `PrintView` |
| Print PDF and image files, rendered to 1-bit raster with dithering | `FilePrintView` |
| Print `.txt` files as real text (not raster), wrapped to the paper width | `FilePrintView` |
| Scan and pair printers over Bluetooth LE | `PrinterView` |
| Connect to printers already paired in Android settings (Bluetooth Classic SPP) | `PrinterView` |
| Appear in the Android print dialog of other apps (Gmail, Word, Chrome, …) | `ThermalPrintService` |
| Receive `text/plain`, images and PDFs from the Android share sheet | `ShareIntentPlugin` |
| Queue documents when no printer is configured yet, and print them later | `PrinterConfigPlugin` |
| 9 single-byte code pages + Katakana, selected with `ESC t n` | `SettingsView` |
| Paper width (58/80 mm), print density, auto-cut, feed lines | `SettingsView` |
| In-app log viewer (tap **Version** 7 times in Settings) | `LogView` |

Not implemented: USB OTG, WiFi/network printers (port 9100), and the `PRINT_RAWBT` intent API
that other POS apps could use. See [Known limitations](#known-limitations).

---

## How it works

### Two entry points, one printing pipeline

The app can be entered two ways, and both end up in the same encoder:

```
                        ┌──────────────────────────────┐
  In-app screens ──────▶│  usePrint / useFilePrint      │
  (Print, File Print)   │  builds ESC/POS bytes         │
                        └───────────────┬──────────────┘
                                        │
                        ┌───────────────▼──────────────┐
  Android print dialog ─┤  active PrinterTransport      │
  (ThermalPrintService) │  BLE  ─or─  Classic SPP       │
  Share sheet ──────────┤                               │
  (ShareIntentPlugin)   └───────────────┬──────────────┘
                                        │
                              Bluetooth → thermal printer
```

### The ESC/POS pipeline

Thermal printers do not speak UTF-8. Everything funnels through `src/services/escpos/`:

1. `EscPosEncoder` builds the command stream — `ESC @` (reset), then `ESC t n` to select the
   character code table, then the content, then feed/cut commands.
2. `codepages.ts` encodes the text for the selected table. Characters the table cannot
   represent are transliterated to ASCII (`é` → `e`, `€` → `EUR`); if there is no sensible
   stand-in they are sent as `?` **and reported back** so the UI can warn the user instead of
   silently printing garbage.
3. `codepageTables.ts` holds the raw `0x80`–`0xFF` byte tables, generated from standard codecs
   rather than typed by hand.

The code page is a single setting (`encoding` in `src/stores/settings.ts`) and is applied
automatically by `initialize()`, so no printing path can forget it.

### The transports

BLE and Bluetooth Classic differ enormously underneath — one writes 20–512 byte GATT
characteristics, the other streams into an RFCOMM socket. Both are hidden behind one small
interface, `PrinterTransport` (`connect` / `write` / `disconnect` / `isConnected`), with
`ScannableTransport` for BLE and `BondedTransport` for Classic. Everything above that
interface is transport-agnostic.

### The Android side

| Native piece | Job |
|---|---|
| `ThermalPrintService` + `ThermalPrinterDiscoverySession` | Registers a virtual printer named **Raw Thermal** so the app appears in every system print dialog. |
| `ThermalPdfRenderer` + `ImageDithering` | Renders the incoming PDF page to a 1-bit bitmap for the thermal head. |
| `ShareIntentPlugin` + `ShareIntentReader` + `SharedIntentHolder` | Reads `EXTRA_TEXT` / `EXTRA_STREAM` from `ACTION_SEND` and `ACTION_VIEW`. |
| `PrinterConfigPlugin` + `PrinterConfigManager` | Shares printer config and pending jobs between SharedPreferences and the web layer. |
| `BluetoothClassicPlugin` + `BluetoothPrinterManager` | RFCOMM/SPP socket, delegating to the same manager the PrintService uses. |
| `EscPosEncoder.kt` | The native copy of the encoder, used by the PrintService path. |

**The web layer pulls, it is not pushed to.** On a cold start the share intent is processed
before the WebView has run any JavaScript, so an event sent at that moment would be lost. The
payload is therefore held in `SharedIntentHolder` and *pulled* by `useIncomingJobs()` when
`App.vue` mounts. A `sharedIntent` event is still emitted, but only as a convenience for warm
starts. `consume()` guarantees one share cannot be printed twice.

**Kotlin stays deliberately dumb.** The native side only reports "there is text" or "there are
bytes, with this name and MIME type". The decision — including rejecting malformed base64 —
lives in `src/services/share/sharedPayload.ts`, which is unit-testable without a device. That
matters precisely because the native side is hard to verify.

**Pending jobs are deleted only after a successful print.** When the PrintService receives a job
but no printer is configured, the document is stored in the cache, the app opens on the Printer
screen with a banner, and the job stays queued until it actually prints. If printing fails, the
document is still there.

---

## Using the app

### 1. Connect a printer

1. Open **Scan Printers** from the home screen.
2. **Bluetooth LE:** tap **Scan**, pick your printer from the list, then **Connect**.
3. **Bluetooth Classic:** pair the printer in Android's own Bluetooth settings first. It then
   appears under **Paired Printers** — tap it to connect.
4. The home screen shows the active printer and a connection badge.

### 2. Print text, a QR code or a barcode

Go to **Print Text**, pick the Text / Image / Barcode tab, type the content, choose alignment,
bold and size, then press print. **Test Print** sends a sample receipt.

### 3. Print a file

Go to **Print File**, select a PDF, an image, or a text file.

- **PDF / image** → rendered to raster and dithered for the thermal head.
- **`.txt`** → printed as real text, word-wrapped to the paper width. If the file contains
  characters the selected code page cannot represent, the preview warns you before printing.

### 4. Print from another app

Two ways, both requiring the app to be installed and a printer configured at least once:

- **Share sheet** — in Gmail, WhatsApp, Word, Chrome, etc. select text or a file, tap Share,
  and pick **Raw Thermal**.
- **Print dialog** — tap ⋮ → Print and choose **Raw Thermal** from the printer list.

If no printer is configured yet, the document is queued and the app opens to set one up; the
queued job then prints from the **Printer** screen (**Print now** / **Discard**).

### 5. Settings

- **Paper Width** — 58 mm (32 columns) or 80 mm (48 columns). Affects text wrapping.
- **Character Encoding** — must match the printer's code page. If accented characters or
  currency symbols come out as garbage, switch to **WPC1252** or **CP850**.
- **Print Density** — light / normal / dark (model-dependent).
- **Auto Cut Paper** and **Feed Lines After Print**.

---

## Getting started (development)

Requires **Node.js 22+**.

```bash
npm install
npm run dev        # Vite dev server, http://localhost:5173
```

The web layer runs in a plain browser, but every native capability (Bluetooth, share intent,
print service) is a no-op there — the bridges all check `Capacitor.isNativePlatform()` first.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `vue-tsc -b && vite build` → `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm test` | Node's built-in test runner over `tests/**/*.test.ts` |
| `npm run typecheck` | `vue-tsc -b && tsc -p tsconfig.test.json` |

### Testing

Tests use **Node's built-in test runner** — no Vitest, no Jest, zero extra dependencies.
`npm test` runs the TypeScript directly, which is why pure modules import each other with an
explicit `.ts` extension (`./codepages.ts`) instead of the `@/` alias: Node cannot resolve the
alias, so a module that must be testable keeps relative, extension-ful imports.

Modules that pull in heavy dependencies (Capacitor, Vue) are kept out of the tested set by
splitting the pure part into its own file — for example `file/fileTypes.ts` is split out of
`file/FileService.ts`.

Current suite:

```
$ npm test
# tests 60
# pass 60
# fail 0
```

Covering the ESC/POS encoder and code pages, the share payload parser, incoming-job
construction, and base64 transport encoding.

### Full verification

```bash
npm test && npm run typecheck && npm run build
```

---

## Building the Android app

**Prerequisites: JDK 17+** (the build targets Java 21), the Android SDK with `compileSdk 35`,
and Gradle 8.14.3 (the wrapper is committed).

```bash
npm run build          # produce dist/
npx cap sync android   # copy dist/ into the Android project
cd android
./gradlew assembleDebug
```

Key Android configuration:

| Setting | Value |
|---|---|
| `appId` / `namespace` | `com.rawthermal.app` |
| `minSdkVersion` | 24 |
| `compileSdkVersion` / `targetSdkVersion` | 35 |
| Kotlin | 2.0.21 |
| Android Gradle Plugin | 8.13.0 |

Permissions requested: Bluetooth (`BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, plus the legacy
`BLUETOOTH` / `BLUETOOTH_ADMIN` and location on API ≤ 30), `INTERNET`, and
`FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_CONNECTED_DEVICE` for the print service.

---

## Project layout

```
src/
  views/            HomeView, PrinterView, PrintView, FilePrintView, SettingsView, LogView
  components/       shared UI
  composables/      usePrint, useFilePrint, useBluetooth, useIncomingJobs, usePaper
  services/
    escpos/         EscPosEncoder, codepages, codepageTables   ← pure, unit-tested
    transport/      PrinterTransport, BleTransport, ClassicSppTransport, base64
    share/          sharedPayload, incoming                    ← pure, unit-tested
    file/           FileService, fileTypes, PdfRenderer
    native/         Capacitor plugin bridges
    bluetooth/      BLE service
  stores/           printer, settings, incoming (Pinia)
  types/            shared types
tests/              Node test runner suites (outside src/ on purpose)
android/            Capacitor Android project (Kotlin)
docs/plans/         design notes and the RawBT parity analysis
```

`tests/` lives outside `src/` so the app's `tsconfig` does not need Node types;
`tsconfig.test.json` adds them separately.

---

## Known limitations

- **No USB OTG and no network printing** (WiFi/Ethernet port 9100).
- **No `PRINT_RAWBT` intent API**, so third-party POS apps cannot hand raw ESC/POS bytes to
  this app the way they can with RawBT.
- **No CJK (GB2312/GBK).** Multi-byte encoding needs a ~20,000-entry table that cannot be
  written by hand. The old, non-functional `GB2312` option was removed and stored values are
  migrated to UTF-8. The correct path for CJK is the printer's built-in UTF-8 mode, or bundling
  a compact GB18030 table at build time.
- **The share sheet `text/plain` filter makes the app appear when sharing a URL**, which is the
  intended trade-off — it is what makes "print text from Gmail/Word" work.
- Some ESC/POS commands (notably `GS | n` print density) are model-specific and may be ignored
  by some printers.

Roadmap detail, including a capability-by-capability comparison with RawBT, is in
[`docs/plans/2026-09-29-rawbt-parity-analysis.md`](docs/plans/2026-09-29-rawbt-parity-analysis.md).

---

## References

- [ESC/POS command reference (Epson)](https://reference.epson-biz.com/modules/ref_escpos/index.php)
- [RawBT — demo integrations](https://github.com/402d/DemoRawBtPrinter)
- [RawBT — API](https://github.com/402d/RawbtAPI)

## License

No license file is present in this repository yet. Add one before distributing the app.
