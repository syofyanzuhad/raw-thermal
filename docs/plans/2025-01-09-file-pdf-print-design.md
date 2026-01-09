# File/PDF Print Feature Design

## Overview
Fitur untuk print file PDF dan gambar (JPG, PNG) ke thermal printer via Bluetooth.

## Requirements
- **File types**: PDF, JPG, PNG
- **File access**: File picker + Share intent dari app lain
- **PDF handling**: Preview thumbnails, user pilih halaman untuk print
- **Sizing**: Auto-fit ke lebar kertas (58mm/80mm)

## Dependencies
```
pdfjs-dist        - Render PDF ke canvas
@capacitor/share  - Handle share intent (optional, bisa pakai @capacitor/app)
```

## Architecture

### File Structure
```
src/
├── services/
│   └── file/
│       ├── FileService.ts      # File picker & share handler
│       └── PdfRenderer.ts      # PDF to image conversion
├── composables/
│   └── useFilePrint.ts         # Composable untuk file printing
└── views/
    └── FilePrintView.vue       # UI untuk preview & print file
```

### Data Flow
```
File/Share Intent
    → FileService (load file)
    → PdfRenderer (jika PDF, render ke canvas)
    → ImageProcessor (resize, dither)
    → EscPosEncoder.image()
    → BluetoothService.write()
```

## Components

### FileService.ts
```typescript
pickFile(types: ['pdf', 'image'])    // Buka native file picker
handleShareIntent()                   // Listen share intent
readFileAsBlob(path: string)          // Baca file, return Blob
```

### PdfRenderer.ts
```typescript
loadPdf(blob: Blob)                           // Load PDF, return page count
getPageThumbnail(pageNum, width: 150)         // Render thumbnail
renderPageFull(pageNum, targetWidth)          // Render full resolution
```

## UI Layout

```
┌─────────────────────────────┐
│ ← Back     Print File       │
├─────────────────────────────┤
│  ┌─────┐  ┌─────┐  ┌─────┐ │
│  │  1  │  │  2  │  │  3  │ │  Thumbnail Grid
│  │ [✓] │  │     │  │ [✓] │ │
│  └─────┘  └─────┘  └─────┘ │
│  Selected: 2 pages          │
├─────────────────────────────┤
│ [📁 Pick File]              │
├─────────────────────────────┤
│      [ 🖨️ Print Selected ]  │
└─────────────────────────────┘
```

## Share Intent (Android)

### AndroidManifest.xml
```xml
<intent-filter>
  <action android:name="android.intent.action.SEND" />
  <category android:name="android.intent.category.DEFAULT" />
  <data android:mimeType="image/*" />
  <data android:mimeType="application/pdf" />
</intent-filter>
```

### Flow
1. User share file dari Gallery/WhatsApp/dll
2. Android buka Raw Thermal app
3. App detect shared file, navigate ke FilePrintView
4. Load & preview file
5. User pilih halaman (jika PDF) & print

## Edge Cases
- File >10MB: warning, konfirmasi lanjut
- Format tidak didukung: error message
- Printer belum connected: arahkan ke PrinterView

## Router
```typescript
{ path: '/file-print', name: 'file-print', component: FilePrintView }
```

## Navigation
- HomeView: tambah quick action "File/PDF"
- Share Intent: auto navigate ke FilePrintView
