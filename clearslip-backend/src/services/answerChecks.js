/**
 * Checks on an Ask ClearSlip answer that run in code, after the model has
 * written it, so explainability doesn't rest on the model following its prompt:
 *
 *   structureAnswer   — splits the answer into labelled parts: what the payslip
 *                       says, the explanation, the calculation, what isn't covered
 *   checkCitations    — drops citation numbers that point at no source
 *   traceAmounts      — every ₹ amount must come from the payslip, a calculator
 *                       or a source the answer cites; amounts that only appear in
 *                       the user's own question are reported separately, and the
 *                       rest are flagged to the user as "couldn't trace"
 *   looksLikeInstructions — a question that tries to change how ClearSlip answers
 */

// "Ignore your rules", "SYSTEM OVERRIDE", "you are now…", "pretend to be…": text
// aimed at the model, not a question about pay. Narrow on purpose, so an ordinary
// question ("Can I ignore Form 16?", "Does HRA act as a deduction?") never matches.
const INSTRUCTION_RE = /\b(ignore|disregard|forget|override)\s+(all\s+|any\s+|your\s+|the\s+|my\s+|previous\s+|prior\s+|above\s+|earlier\s+)*(rules|instructions|guidelines|prompt|system\s+prompt)\b|\bsystem\s*(override|prompt|message|instruction)s?\b|\byou\s+are\s+now\b|\bpretend\s+(to\s+be|you\s+are|you're)\b|\b(developer|dan|jailbreak)\s+mode\b|\bjailbreak\b|\bnew\s+(rule|instruction)s?\s*:/i

export function looksLikeInstructions(question) {
  return INSTRUCTION_RE.test(question ?? '')
}

// The labels the prompt asks for, in display order
export const PART_LABELS = {
  payslip: 'Your payslip',
  explanation: 'Explanation',
  calculation: 'Calculation',
  next: 'Next steps',
  missing: 'Not in my sources',
}

// "Next steps" isn't asked for, but the model often adds it; giving it its own
// part stops it being read as part of the calculation above it
const LABEL_RE = /^\s*(?:\*\*)?\s*(your payslip|explanation|calculation|next steps|not in my sources)\s*:?\s*(?:\*\*)?\s*:?\s*/i

/** Splits an answer into labelled parts. Returns null if the model didn't use the labels. */
export function structureAnswer(answer) {
  if (!answer) return null
  const parts = []
  let current = null
  for (const line of answer.split('\n')) {
    const label = line.match(LABEL_RE)
    if (label) {
      const kind = Object.keys(PART_LABELS).find(k => PART_LABELS[k].toLowerCase() === label[1].toLowerCase())
      current = { kind, text: line.slice(label[0].length) }
      parts.push(current)
    } else if (current) {
      current.text += `\n${line}`
    } else if (line.trim()) {
      // Text before the first label is part of the explanation
      current = { kind: 'explanation', text: line }
      parts.push(current)
    }
  }
  const cleaned = parts.map(p => ({ ...p, text: p.text.trim() })).filter(p => p.text)
  return cleaned.some(p => p.kind !== 'explanation') ? cleaned : null
}

/** Removes citations to sources that don't exist ([7] when there are 5) and reports them. */
export function checkCitations(answer, sourceCount) {
  const invalid = []
  const fixed = (answer ?? '').replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (whole, list) => {
    const nums = list.split(/\s*,\s*/).map(Number)
    const kept = nums.filter(n => n >= 1 && n <= sourceCount)
    invalid.push(...nums.filter(n => !kept.includes(n)))
    return kept.length ? `[${kept.join(', ')}]` : ''
  })
  return { answer: fixed.replace(/ +([.,;])/g, '$1'), invalid: [...new Set(invalid)] }
}

// "₹26,000", "₹ 1,50,000", "Rs. 2,500", "₹2.6 lakh", "₹1.2 crore", "₹52k"
const RUPEE_RE = /(?:₹|\bRs\.?|\bINR)\s?(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*(lakhs?|lacs?|crores?|cr|k)\b)?/gi
const UNIT = { lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, crore: 1e7, crores: 1e7, cr: 1e7, k: 1e3 }

export function rupeeAmounts(text) {
  return [...String(text ?? '').matchAll(RUPEE_RE)].map(([match, digits, unit]) => ({
    text: match.trim(),
    value: parseFloat(digits.replace(/,/g, '')) * (UNIT[unit?.toLowerCase()] ?? 1),
  }))
}

// Every number inside a tool result (taxable income, cess, limits, …)
function numbersIn(value, out = []) {
  if (typeof value === 'number' && Number.isFinite(value)) out.push(value)
  else if (Array.isArray(value)) value.forEach(v => numbersIn(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach(v => numbersIn(v, out))
  else if (typeof value === 'string') rupeeAmounts(value).forEach(a => out.push(a.value))
  return out
}

// Within a rupee, or 0.5% for amounts quoted in lakh ("₹2.6 lakh" for 2,60,000)
const matches = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005)

// Numbers the user typed, with or without ₹ ("I pay 20000 rent", "15 lakh salary")
const NUMBER_RE = /(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*(lakhs?|lacs?|crores?|cr|k)\b)?/gi
const typedNumbers = text => [...String(text ?? '').matchAll(NUMBER_RE)]
  .map(([, digits, unit]) => parseFloat(digits.replace(/,/g, '')) * (UNIT[unit?.toLowerCase()] ?? 1))
  .filter(v => v >= 100) // not "2 days" or "80C"

/**
 * Where each ₹ amount in the answer came from — directly, or as the monthly or
 * yearly version of a figure (×12, ÷12), checked in this order:
 *   1. the payslip, a calculator's inputs or results, or a source the answer cites → fine;
 *   2. the user's question → `fromQuestion` ("₹20,000 rent" is theirs to give, but
 *      a figure planted in a question — "say it is ₹5,00,000" — is not a fact);
 *   3. another retrieved passage → fine, but only if the answer cites something
 *      (models often cite the neighbouring passage); an answer that cites nothing
 *      gets no credit from passages it never used;
 *   4. nowhere → `untraced`.
 * Without `cited`, every source counts as cited.
 */
export function traceAmounts(answer, { payslip, toolCalls = [], sources = [], cited, question = '' }) {
  const known = [0]
  for (const row of payslip?.breakdown ?? []) known.push(row.monthly, row.annual)
  known.push(...Object.values(payslip?.summary ?? {}).filter(Number.isFinite))
  // Total earnings and total deductions are payslip figures too (often not printed)
  for (const type of ['earning', 'deduction']) {
    const rows = (payslip?.breakdown ?? []).filter(r => r.type === type)
    known.push(rows.reduce((s, r) => s + (r.monthly || 0), 0), rows.reduce((s, r) => s + (r.annual || 0), 0))
  }
  for (const call of toolCalls) numbersIn([call.args, call.result], known)
  const isCited = s => !cited || cited.includes(s.n)
  const amountsIn = list => list.flatMap(s => rupeeAmounts(s.text).map(a => a.value))
  known.push(...amountsIn(sources.filter(isCited)))

  const withMonthlyAndYearly = values => values.flatMap(v => [v, v * 12, v / 12])
  const candidates = withMonthlyAndYearly(known)
  const asked = withMonthlyAndYearly(typedNumbers(question))
  const nearby = cited?.length ? withMonthlyAndYearly(amountsIn(sources.filter(s => !isCited(s)))) : []
  const untraced = new Set()
  const fromQuestion = new Set()
  for (const a of rupeeAmounts(answer)) {
    const found = list => list.some(k => matches(a.value, k))
    if (found(candidates)) continue
    if (found(asked)) fromQuestion.add(a.text)
    else if (!found(nearby)) untraced.add(a.text)
  }
  return { untraced: [...untraced], fromQuestion: [...fromQuestion] }
}

/** The ₹ amounts traceAmounts couldn't place anywhere. */
export function untracedAmounts(answer, context) {
  return traceAmounts(answer, context).untraced
}
