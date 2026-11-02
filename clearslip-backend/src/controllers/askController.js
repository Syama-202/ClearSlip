import { answerQuestion } from '../services/askService.js'
import { validate, askRequestSchema } from '../utils/validateInput.js'

export async function handleAsk(req, res, next) {
  try {
    const { question, payslip, history } = validate(askRequestSchema, req.body)

    // Same guard as decoding: identifiers don't belong in a question
    if (/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(question) || /\b[A-Z]{5}\d{4}[A-Z]\b/i.test(question)) {
      return res.status(400).json({
        success: false,
        error: 'Please do not share Aadhaar or PAN numbers in your question.',
        code: 'SENSITIVE_DATA',
      })
    }

    const data = await answerQuestion({ question, payslip, history })
    return res.status(200).json({ success: true, data })
  } catch (err) {
    next(err)
  }
}
