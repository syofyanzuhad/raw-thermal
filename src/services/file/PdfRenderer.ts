import * as pdfjsLib from 'pdfjs-dist'

// Set worker source - using CDN for simplicity
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export interface PdfDocument {
  numPages: number
  getPage: (pageNum: number) => Promise<PdfPage>
  destroy: () => void
}

export interface PdfPage {
  pageNumber: number
  getViewport: (options: { scale: number }) => { width: number; height: number }
  render: (options: {
    canvasContext: CanvasRenderingContext2D
    viewport: { width: number; height: number; scale: number }
  }) => { promise: Promise<void> }
}

export interface PageThumbnail {
  pageNum: number
  dataUrl: string
  width: number
  height: number
}

let loadedDocument: pdfjsLib.PDFDocumentProxy | null = null

/**
 * Load PDF from blob
 */
export async function loadPdf(blob: Blob): Promise<{ numPages: number }> {
  // Clean up previous document
  if (loadedDocument) {
    await loadedDocument.destroy()
    loadedDocument = null
  }

  const arrayBuffer = await blob.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  loadedDocument = await loadingTask.promise

  console.log('[PdfRenderer] Loaded PDF with', loadedDocument.numPages, 'pages')

  return {
    numPages: loadedDocument.numPages
  }
}

/**
 * Get thumbnail for a specific page
 */
export async function getPageThumbnail(
  pageNum: number,
  maxWidth: number = 150
): Promise<PageThumbnail> {
  if (!loadedDocument) {
    throw new Error('No PDF loaded')
  }

  const page = await loadedDocument.getPage(pageNum)
  const viewport = page.getViewport({ scale: 1 })

  // Calculate scale to fit maxWidth
  const scale = maxWidth / viewport.width
  const scaledViewport = page.getViewport({ scale })

  // Create canvas for thumbnail
  const canvas = document.createElement('canvas')
  canvas.width = scaledViewport.width
  canvas.height = scaledViewport.height

  const ctx = canvas.getContext('2d')!

  // Render page to canvas
  const renderContext = {
    canvasContext: ctx,
    viewport: scaledViewport,
    canvas: canvas
  }
  await page.render(renderContext as Parameters<typeof page.render>[0]).promise

  return {
    pageNum,
    dataUrl: canvas.toDataURL('image/jpeg', 0.7),
    width: scaledViewport.width,
    height: scaledViewport.height
  }
}

/**
 * Get thumbnails for all pages
 */
export async function getAllThumbnails(
  maxWidth: number = 150,
  onProgress?: (current: number, total: number) => void
): Promise<PageThumbnail[]> {
  if (!loadedDocument) {
    throw new Error('No PDF loaded')
  }

  const thumbnails: PageThumbnail[] = []
  const numPages = loadedDocument.numPages

  for (let i = 1; i <= numPages; i++) {
    const thumbnail = await getPageThumbnail(i, maxWidth)
    thumbnails.push(thumbnail)
    onProgress?.(i, numPages)
  }

  return thumbnails
}

/**
 * Render page at full resolution for printing
 */
export async function renderPageFull(
  pageNum: number,
  targetWidth: number
): Promise<ImageData> {
  if (!loadedDocument) {
    throw new Error('No PDF loaded')
  }

  const page = await loadedDocument.getPage(pageNum)
  const viewport = page.getViewport({ scale: 1 })

  // Calculate scale for target width
  const scale = targetWidth / viewport.width
  const scaledViewport = page.getViewport({ scale })

  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(scaledViewport.width)
  canvas.height = Math.round(scaledViewport.height)

  const ctx = canvas.getContext('2d')!

  // Fill with white background (PDFs may have transparent background)
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Render page
  const renderContext = {
    canvasContext: ctx,
    viewport: scaledViewport,
    canvas: canvas
  }
  await page.render(renderContext as Parameters<typeof page.render>[0]).promise

  console.log('[PdfRenderer] Rendered page', pageNum, 'at', canvas.width, 'x', canvas.height)

  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Get page count of loaded document
 */
export function getPageCount(): number {
  return loadedDocument?.numPages ?? 0
}

/**
 * Destroy loaded document and free memory
 */
export async function destroyDocument(): Promise<void> {
  if (loadedDocument) {
    await loadedDocument.destroy()
    loadedDocument = null
    console.log('[PdfRenderer] Document destroyed')
  }
}
