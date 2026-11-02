import { forwardToN8n } from '../services/n8nService.js'
import { validate, checklistRequestSchema } from '../utils/validateInput.js'

export async function handleChecklist(req, res, next) {
  try {
    const payload = validate(checklistRequestSchema, req.body)

    await forwardToN8n(payload)

    return res.status(200).json({
      success: true,
      message: 'Checklist sent! Check your inbox.',
    })
  } catch (err) {
    next(err)
  }
}
