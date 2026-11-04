import { createWorker, createScheduler } from 'tesseract.js'
import { config } from '../config/index.js'
// Import the lib file directly — pdf-parse's index.js runs a debug block
// under ESM that tries to read a bundled test PDF and crashes on startup.
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

/**
 * Extracts raw text from a base64-encoded payslip file.
 *
 * - Images (jpeg/png/webp) → OCR'd locally with Tesseract.js.
 *   Free, self-hosted, no API key, no rate limit.
 * - PDFs → text layer read with pdf-parse (works for "born-digital"
 *   PDFs, i.e. exported from payroll software, which is the common
 *   case). If the PDF has no selectable text (a scanned image saved
 *   as PDF), we ask the user to upload it as an image instead, since
 *   rasterizing PDF pages for OCR needs a native dependency
 *   (poppler/graphicsmagick) that isn't guaranteed to exist on every
 *   free hosting tier (Railway/Render).
 */
export async function extractTextFromBase64(base64, mediaType) {
  const buffer = Buffer.from(base64, 'base64')

  if (!matchesMediaType(buffer, mediaType)) {
    const err = new Error(
      mediaType === 'application/pdf'
        ? 'This file is not a valid PDF. Please upload the payslip again, or a JPG/PNG screenshot of it.'
        : 'This file is not a valid JPG, PNG or WebP image. Please upload a photo or screenshot of the payslip.'
    )
    err.status = 400
    err.code = 'INVALID_FILE'
    throw err
  }

  if (mediaType === 'application/pdf') {
    return extractFromPdf(buffer)
  }

  return extractFromImage(buffer)
}

// File signatures ("magic bytes"), so a mislabelled or corrupt file is rejected
// before it reaches the OCR engine or the PDF parser
const SIGNATURES = {
  'image/png': buf => buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': buf => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  'image/webp': buf => buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP',
  'application/pdf': buf => buf.subarray(0, 1024).includes('%PDF-'),
}

export function matchesMediaType(buffer, mediaType) {
  return Boolean(SIGNATURES[mediaType]?.(buffer))
}

// Server-side OCR is the fallback (the browser reads files first), but when it
// runs, a small pool of workers is kept ready: the language data loads once, not
// per request, and at most `config.ocrWorkers` images are read at a time — the
// rest queue, instead of each starting a worker and exhausting a small server's
// memory. The pool shuts down after `config.ocrIdleMs` without work.
let poolPromise = null
let idleTimer = null
let activeJobs = 0

function getPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      const scheduler = createScheduler()
      // Without an errorHandler, tesseract.js throws a worker failure from inside its
      // message listener, where no try/catch can reach it, and the process exits.
      // With one, the failure rejects the job and is handled below.
      const workers = await Promise.all(
        Array.from({ length: config.ocrWorkers }, () => createWorker('eng', undefined, { errorHandler: () => {} }))
      )
      workers.forEach(w => scheduler.addWorker(w))
      return scheduler
    })().catch(err => {
      poolPromise = null
      throw err
    })
  }
  return poolPromise
}

/** Stops the OCR workers (after idle time, or when tests finish). */
export async function shutdownOcr() {
  clearTimeout(idleTimer)
  const pool = poolPromise
  poolPromise = null
  const scheduler = await pool?.catch(() => null)
  await scheduler?.terminate()
}

async function extractFromImage(buffer) {
  activeJobs++
  clearTimeout(idleTimer)
  try {
    const scheduler = await getPool()
    let data
    try {
      ;({ data } = await scheduler.addJob('recognize', buffer))
    } catch {
      const err = new Error('This image could not be read. It may be damaged — please upload a clear photo or screenshot of the payslip.')
      err.status = 400
      err.code = 'OCR_FAILED'
      throw err
    }
    const text = (data?.text || '').trim()

    if (text.length < 5) {
      const err = new Error(
        'Could not read any text from this image. Please upload a clearer, well-lit photo or screenshot of the payslip.'
      )
      err.status = 400
      err.code = 'OCR_EMPTY'
      throw err
    }

    return text
  } finally {
    activeJobs--
    if (activeJobs === 0) {
      idleTimer = setTimeout(shutdownOcr, config.ocrIdleMs)
      idleTimer.unref?.() // an idle pool shouldn't keep the process alive on its own
    }
  }
}

async function extractFromPdf(buffer) {
  let text
  try {
    // A plain Uint8Array — pdf.js mis-reads Node Buffers from another
    // realm (e.g. under Jest) and reports a corrupt file
    ;({ text } = await pdfParse(new Uint8Array(buffer)))
  } catch {
    const err = new Error('This PDF could not be opened — it may be damaged or password-protected. Please upload a JPG/PNG screenshot instead.')
    err.status = 400
    err.code = 'INVALID_PDF'
    throw err
  }

  const cleaned = (text || '').trim()

  if (cleaned.length < 20) {
    const err = new Error(
      'This PDF looks like a scanned image with no selectable text. Please upload it as a JPG/PNG screenshot instead so OCR can read it.'
    )
    err.status = 400
    err.code = 'UNREADABLE_PDF'
    throw err
  }

  return cleaned
}
