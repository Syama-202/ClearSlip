/**
 * Removes personal identifiers from payslip text before it is sent to a
 * third-party AI. Salary figures are left untouched: amounts use commas or
 * have at most 8 digits, while the identifiers below are longer or shaped
 * differently.
 */

// Labelled values that identify the person rather than describe their pay. The value
// stops at a column break ("|", a tab or 2+ spaces), so the salary half of a
// two-column line ("Employee Name: Ravi Kumar | Basic 37,500") is kept.
const IDENTITY_FIELD = /(^|\||\t| {2,})(\s*(?:employee|emp\.?|staff)?\s*(?:name|code|id|no\.?|number)|\s*(?:father'?s?|spouse)\s*name|\s*address|\s*(?:bank|a\/c|account)[^:|\t\n]*|\s*ifsc[^:|\t\n]*|\s*(?:pan|uan|esic?|pf)\s*(?:no\.?|number|a\/c)?|\s*(?:date of birth|dob)|\s*(?:mobile|phone|email))\s*[:\-–]\s*[^|\t\n]*?(?= {2,}|\||\t|$)/gim

const PATTERNS = [
  [/\b[A-Z]{5}\d{4}[A-Z]\b/gi, '[PAN]'],
  [/\b\d{4}\s\d{4}\s\d{4}\b/g, '[ID NUMBER]'],                 // Aadhaar written in groups
  [/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, '[IFSC]'],
  [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[EMAIL]'],
  [/(?:\+91[\s-]?)?\b[6-9]\d{9}\b/g, '[PHONE]'],
  [/\b\d{9,18}\b/g, '[NUMBER]'],                               // account numbers, UAN, unspaced Aadhaar
]

export function redactPersonalData(text) {
  let out = String(text ?? '').replace(IDENTITY_FIELD, (field, before, label) => `${before}${label.trim()}: [REDACTED]`)
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement)
  return out
}
