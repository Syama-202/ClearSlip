import crypto from 'crypto'
import { config } from '../config/index.js'

/**
 * Signs the checklist and summary that a decode returned, so POST /api/checklist
 * only emails text ClearSlip itself produced. Without this, anyone could use the
 * endpoint to send arbitrary messages and links to any address in ClearSlip's name.
 */
function canonical(actionItems = [], summary = {}) {
  const items = actionItems.map(i => [i.priority ?? null, i.action, i.link ?? null])
  const figures = Object.keys(summary).sort().map(k => [k, summary[k]])
  return JSON.stringify([items, figures])
}

export function signChecklist({ actionItems, summary }) {
  return crypto.createHmac('sha256', config.signingSecret).update(canonical(actionItems, summary)).digest('hex')
}

export function verifyChecklist({ checklistItems, payslipSummary, checklistToken }) {
  const expected = Buffer.from(signChecklist({ actionItems: checklistItems, summary: payslipSummary }), 'hex')
  const given = Buffer.from(checklistToken, 'hex')
  return given.length === expected.length && crypto.timingSafeEqual(given, expected)
}
