import { forwardToN8n } from '../services/n8nService.js'
import { validate, checklistRequestSchema } from '../utils/validateInput.js'
import { verifyChecklist } from '../utils/checklistToken.js'

export async function handleChecklist(req, res, next) {
  try {
    const payload = validate(checklistRequestSchema, req.body)

    if (!verifyChecklist(payload)) {
      return res.status(403).json({
        success: false,
        error: 'This checklist could not be verified. Please decode your payslip again and resend.',
        code: 'CHECKLIST_NOT_VERIFIED',
      })
    }

    // The token has done its job; n8n gets only the checklist itself
    const { checklistToken, ...checklist } = payload
    await forwardToN8n(checklist)

    return res.status(200).json({
      success: true,
      message: 'Checklist sent! Check your inbox.',
    })
  } catch (err) {
    next(err)
  }
}
