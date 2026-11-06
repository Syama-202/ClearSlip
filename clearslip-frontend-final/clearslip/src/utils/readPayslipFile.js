/**
 * Reads a payslip file on the user's own device, so the image or PDF itself is
 * never uploaded: only the text found in it is sent to ClearSlip.
 *
 *   PDF with a text layer → that text (origin "pdf")
 *   scanned PDF           → each page rendered and read with OCR (origin "ocr")
 *   JPG / PNG / WebP      → OCR (origin "ocr")
 *
 * Both libraries load only when a file is chosen. Tesseract downloads its
 * engine and English language data (~11 MB) from the jsDelivr CDN once; the
 * browser caches it. `onProgress(fraction, label)` reports progress.
 */

// Payslips are one or two pages; a long PDF is probably not a payslip
const MAX_PDF_PAGES = 3
// Rendering scale for scanned pages: enough resolution for OCR without huge canvases
const SCAN_SCALE = 2
// Fewer characters than this in the text layer means the PDF is a scan
const MIN_TEXT_LAYER_CHARS = 20

// A problem with the file itself (damaged, password-protected, no text): shown to the user as is
export class ReadError extends Error {
  code = 'READ_ERROR'
}

export async function readPayslipFile(file, onProgress = () => {}) {
  if (file.type === 'application/pdf') return readPdf(file, onProgress)
  onProgress(0, 'Reading the image on your device…')
  return { text: await ocr([file], onProgress), origin: 'ocr' }
}

async function readPdf(file, onProgress) {
  onProgress(0, 'Opening the PDF on your device…')
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

  let pdf
  try {
    // No eval: the site's Content-Security-Policy forbids it, and pdf.js doesn't need it
    pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise
  } catch (err) {
    if (err?.name === 'PasswordException') throw new ReadError('This PDF is password-protected. Please open it, save a copy without a password (or take a screenshot), and upload that.')
    throw new ReadError('This PDF could not be opened — it may be damaged. Please upload a screenshot of the payslip instead.')
  }

  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES)
  const pages = []
  for (let n = 1; n <= pageCount; n++) pages.push(await pdf.getPage(n))

  const text = (await Promise.all(pages.map(pageText))).join('\n').trim()
  if (text.replace(/\s/g, '').length >= MIN_TEXT_LAYER_CHARS) return { text, origin: 'pdf' }

  // A scanned PDF: draw each page and read it like a photo
  onProgress(0, 'This PDF is a scan — reading it with OCR on your device…')
  const canvases = []
  for (const page of pages) {
    const viewport = page.getViewport({ scale: SCAN_SCALE })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    // "print" renders in one go; the default "display" mode waits for animation
    // frames, so it stalls if the user switches to another tab meanwhile
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, intent: 'print' }).promise
    canvases.push(canvas)
  }
  return { text: await ocr(canvases, onProgress), origin: 'ocr' }
}

/**
 * Rebuilds lines from a PDF page's text items. Items on the same line share a
 * baseline (y); columns are kept apart with two spaces, so a two-column row
 * reads "Basic Salary 30,000  Provident Fund 3,600" as the parser expects.
 */
async function pageText(page) {
  const { items } = await page.getTextContent()
  const lines = new Map()
  for (const item of items) {
    if (!item.str?.trim()) continue
    const y = Math.round(item.transform[5])
    const line = [...lines.keys()].find(k => Math.abs(k - y) <= 2) ?? y
    if (!lines.has(line)) lines.set(line, [])
    lines.get(line).push({ x: item.transform[4], width: item.width, str: item.str })
  }
  return [...lines.entries()]
    .sort((a, b) => b[0] - a[0]) // top of the page first
    .map(([, parts]) => parts
      .sort((a, b) => a.x - b.x)
      .map((p, i, all) => (i > 0 && p.x - (all[i - 1].x + all[i - 1].width) > 12 ? '  ' : i > 0 ? ' ' : '') + p.str.trim())
      .join(''))
    .join('\n')
}

// OCR's worker, engine and English data come from this site (see vite.config.js),
// not from a CDN. The worker loads them itself, so the addresses must be absolute.
const ocrFiles = () => new URL('/tesseract/', window.location.origin).href

async function ocr(images, onProgress) {
  const { createWorker } = await import('tesseract.js')
  let done = 0
  const worker = await createWorker('eng', 1, {
    workerPath: `${ocrFiles()}worker.min.js`,
    corePath: ocrFiles(),
    langPath: ocrFiles().replace(/\/$/, ''),
    // Start the worker from its own file rather than a blob: copy, so the CSP needs no blob: workers
    workerBlobURL: false,
    logger: m => {
      if (m.status === 'recognizing text') onProgress((done + m.progress) / images.length, 'Reading the text on your device…')
    },
    // Without this, a damaged image throws inside the worker instead of rejecting
    errorHandler: () => {},
  })
  try {
    const texts = []
    for (const image of images) {
      try {
        texts.push((await worker.recognize(image)).data.text)
      } catch {
        throw new ReadError('This image could not be read. It may be damaged — please try a clear photo or screenshot of the payslip.')
      }
      done++
    }
    const text = texts.join('\n').trim()
    if (text.replace(/\s/g, '').length < 5) {
      throw new ReadError('No text could be read from this file. Please upload a clearer, well-lit photo or screenshot of the payslip.')
    }
    return text
  } finally {
    await worker.terminate()
  }
}
