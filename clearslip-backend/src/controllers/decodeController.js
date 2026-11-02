import { extractTextFromBase64 } from '../services/ocrService.js'
import { parsePayslipText } from '../services/rulesEngine.js'
import { decodeWithFallback } from '../services/llmFallbackService.js'
import { validate, decodeRequestSchema } from '../utils/validateInput.js'

// Rules-engine results below this confidence are handed to the LLM fallback
const MIN_CONFIDENCE = 2

export async function handleDecode(req, res, next) {
  try {
    const { messages } = validate(decodeRequestSchema, req.body)

    // Block requests that look like they contain sensitive identifiers
    const textContent = messages
      .filter(m => m.type === 'text')
      .map(m => m.text)
      .join(' ')

    // UANs (PF account numbers) are also 12 digits and appear on most
    // payslips, so a labelled UAN is not treated as an Aadhaar number
    const withoutUan = textContent.replace(/\buan\s*(no\.?|number)?\s*[:\-]?\s*\d{12}\b/gi, ' ')

    if (/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(withoutUan)) {
      return res.status(400).json({
        success: false,
        error: 'Please do not share Aadhaar numbers in your request.',
        code: 'SENSITIVE_DATA',
      })
    }

    // Image/PDF uploads → OCR text. The text block sent alongside an image is
    // only a frontend instruction, so the extracted text is used on its own.
    const imageBlock = messages.find(m => m.type === 'image')
    const rawText = imageBlock
      ? await extractTextFromBase64(imageBlock.source.data, imageBlock.source.media_type)
      : textContent

    // PDFs give their text layer directly; only images go through OCR
    const fromOcr = Boolean(imageBlock) && imageBlock.source.media_type !== 'application/pdf'
    const { result, confidence } = parsePayslipText(rawText, { fromOcr })

    if (result && confidence >= MIN_CONFIDENCE) {
      return res.status(200).json({ success: true, data: { ...result, engine: 'rules' } })
    }

    const fallbackResult = await decodeWithFallback(rawText)

    return res.status(200).json({ success: true, data: { ...fallbackResult, engine: 'llm-fallback' } })
  } catch (err) {
    next(err)
  }
}
