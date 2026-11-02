import { createWorker } from 'tesseract.js'
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

  if (mediaType === 'application/pdf') {
    return extractFromPdf(buffer)
  }

  return extractFromImage(buffer)
}

async function extractFromImage(buffer) {
  const worker = await createWorker('eng')
  try {
    const { data } = await worker.recognize(buffer)
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
    await worker.terminate()
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
