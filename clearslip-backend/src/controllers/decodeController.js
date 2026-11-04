import { extractTextFromBase64 } from '../services/ocrService.js'
import { parsePayslipText, recalculateFromRows } from '../services/rulesEngine.js'
import { decodeWithFallback } from '../services/llmFallbackService.js'
import { validate, decodeRequestSchema, recalculateRequestSchema } from '../utils/validateInput.js'
import { signChecklist } from '../utils/checklistToken.js'
import { containsAadhaar } from '../utils/aadhaar.js'

// Lets the user email this exact checklist later (see checklistToken.js)
const withChecklistToken = data => ({ ...data, checklistToken: signChecklist(data) })

// Rules-engine results below this confidence are handed to the LLM fallback
const MIN_CONFIDENCE = 2

export async function handleDecode(req, res, next) {
  try {
    const { messages } = validate(decodeRequestSchema, req.body)

    const textBlocks = messages.filter(m => m.type === 'text')
    const textContent = textBlocks.map(m => m.text).join(' ')
    // Text the browser read from an uploaded file, rather than typed by the user
    const readFromFile = textBlocks.find(m => m.origin === 'pdf' || m.origin === 'ocr')

    // UANs (PF account numbers) are also 12 digits and appear on most
    // payslips, so a labelled UAN is not treated as an Aadhaar number
    const withoutUan = textContent.replace(/\buan\s*(no\.?|number)?\s*[:\-]?\s*\d{12}\b/gi, ' ')

    // Typed text with an Aadhaar number is refused. Text read from a file is the
    // payslip as printed; anything identifying in it is redacted before any AI call.
    if (!readFromFile && containsAadhaar(withoutUan)) {
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

    // PDFs give their text layer directly; images (here or in the browser) go through OCR
    const fromOcr = imageBlock
      ? imageBlock.source.media_type !== 'application/pdf'
      : readFromFile?.origin === 'ocr'
    const { result, confidence } = parsePayslipText(rawText, { fromOcr })

    if (result && confidence >= MIN_CONFIDENCE) {
      return res.status(200).json({ success: true, data: withChecklistToken({ ...result, engine: 'rules' }) })
    }

    const fallbackResult = await decodeWithFallback(rawText)

    return res.status(200).json({ success: true, data: withChecklistToken({ ...fallbackResult, engine: 'llm-fallback' }) })
  } catch (err) {
    next(err)
  }
}

// The user checked or corrected the decoded figures: recalculate everything from them
export function handleRecalculate(req, res, next) {
  try {
    const { breakdown } = validate(recalculateRequestSchema, req.body)
    const result = recalculateFromRows(breakdown)
    if (!result) {
      return res.status(422).json({
        success: false,
        error: 'With these figures your take-home comes to zero or less. Please check the amounts and that each row is marked as an earning or a deduction.',
        code: 'IMPOSSIBLE_FIGURES',
      })
    }
    return res.status(200).json({ success: true, data: withChecklistToken({ ...result, engine: 'edited' }) })
  } catch (err) {
    next(err)
  }
}
