/**
 * Deterministic payslip decoder — replaces the Claude call with plain
 * JS rules for the common, well-formed cases. Falls back to an LLM
 * (see llmFallbackService.js) only when confidence is too low.
 *
 * Salary/tax knowledge below mirrors the original Claude system prompt
 * (now removed) and src/prompts/fallbackPrompt.js.
 */

const COMPONENTS = [
  // Earnings
  { key: 'basic', label: 'Basic Salary', type: 'earning', pattern: /\bbasic(\s*(salary|pay))?\b/i,
    explanation: 'Your core fixed salary — most other components are calculated as a % of this.' },
  { key: 'da', label: 'DA (Dearness Allowance)', type: 'earning', pattern: /\bd\.?\s?a\.?\b|dearness\s*allowance/i,
    explanation: 'Inflation-linked allowance, common in government and PSU jobs — fully taxable.' },
  { key: 'hra', label: 'HRA (House Rent Allowance)', type: 'earning', pattern: /\bh\.?\s?r\.?\s?a\.?\b|house\s*rent\s*allowance/i,
    explanation: 'Tax-exempt (partly or fully) if you pay rent and submit receipts to HR.' },
  { key: 'special', label: 'Special Allowance', type: 'earning', pattern: /special\s*allowance/i,
    explanation: 'A flexible pay component — fully taxable, no exemptions.' },
  { key: 'lta', label: 'LTA (Leave Travel Allowance)', type: 'earning', pattern: /\bl\.?\s?t\.?\s?a\.?\b|leave\s*travel\s*allowance/i,
    explanation: 'Tax-exempt for actual travel expenses, claimable twice in a 4-year block.' },
  { key: 'conveyance', label: 'Conveyance Allowance', type: 'earning', pattern: /conveyance(\s*allowance)?/i,
    explanation: 'Covers commuting costs — usually fully taxable under the new regime.' },
  { key: 'transport', label: 'Transport Allowance', type: 'earning', pattern: /transport\s*allowance/i,
    explanation: 'Commuting allowance for government employees (plus DA on it) — fully taxable under the new regime.' },
  { key: 'medical', label: 'Medical Allowance', type: 'earning', pattern: /medical\s*allowance/i,
    explanation: 'Fixed monthly allowance — fully taxable under the new regime.' },
  { key: 'bonus', label: 'Bonus / Incentive', type: 'earning', pattern: /\bbonus\b|incentive/i,
    explanation: 'Variable pay — fully taxable in the month it is paid.' },
  { key: 'otherEarning', label: 'Other Allowance', type: 'earning', pattern: /other\s*allowance/i,
    explanation: 'Additional allowance component — fully taxable.' },

  // Deductions
  { key: 'pf', label: 'Provident Fund (PF)', type: 'deduction', pattern: /\be\.?\s?p\.?\s?f\.?\b|\bp\.?\s?f\.?\b|provident\s*fund/i,
    explanation: '12% of Basic, goes into your retirement fund. Counts toward the ₹1,50,000 80C limit (old regime).' },
  { key: 'tds', label: 'TDS (Income Tax)', type: 'deduction', pattern: /\btds\b|income\s*tax/i,
    explanation: 'Tax deducted at source based on your projected annual income.' },
  { key: 'esi', label: 'ESI', type: 'deduction', pattern: /\besic?\b|employee'?s?\s*state\s*insurance/i,
    explanation: 'Health insurance contribution, applies if your gross is under ₹21,000/month.' },
  { key: 'pt', label: 'Professional Tax', type: 'deduction', pattern: /professional\s*tax|\bprof\.?\s*tax\b|\bp\.?\s?tax\b|\bp\.?\s?t\.?\b/i,
    explanation: 'Small state-government tax — usually ₹200/month, varies by state.' },
  { key: 'nps', label: 'NPS (National Pension Scheme)', type: 'deduction', pattern: /\bnps\b|national\s*pension/i,
    explanation: 'Optional retirement contribution — extra ₹50,000 deduction available under 80CCD(1B), old regime.' },
  { key: 'loan', label: 'Loan / Advance Recovery', type: 'deduction', pattern: /loan\s*(recovery)?|advance\s*recovery/i,
    explanation: 'Recovery of a salary advance or company loan instalment.' },

  // Totals (not part of the breakdown, used to anchor the calculation).
  // "Gross Deductions" is a deductions total, not gross salary.
  { key: 'gross', label: 'Gross Salary', type: 'total', pattern: /total\s*earnings|gross(?!\s*deductions?\b)(\s*(salary|pay|earnings))?/i },
  { key: 'totalDeductions', label: 'Total Deductions', type: 'total', pattern: /(total|gross)\s*deductions?/i },
  { key: 'netPay', label: 'Net Pay / Take Home', type: 'total', pattern: /net\s*(pay|salary|amount)|take[\s-]?home/i },
  { key: 'ctc', label: 'CTC', type: 'total', pattern: /\bctc\b|cost\s*to\s*company/i },

  // Labels that look like components but carry identifiers ("PF No",
  // "UAN") or employer-side amounts ("Employer PF"). Matched only so
  // their numbers are not attributed to a real component.
  { key: 'ignore', type: 'ignore', pattern: /\b(pf|uan|esic?|pan|emp(loyee)?)\s*(a\/c\s*)?(no|number|id|code)\b\.?|\buan\b|employer'?s?(\s*(share|contribution)(\s*(of|to|towards))?)?\s*(e?pf|provident\s*fund|nps|esic?)?/i },
].map(c => ({ ...c, globalPattern: new RegExp(c.pattern.source, 'gi') }))

// An amount: comma-grouped (Indian "1,00,000" or international "100,000")
// or plain, with an optional unit suffix ("8L", "8.5 LPA", "52k", "1.2 Cr").
// The comma branch MUST require at least one comma group, otherwise a
// plain "25000" gets mis-split into "250" + "00" by the greedy \d{1,3}.
const AMOUNT_RE = /(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*(lakhs?|lacs?|lpa|crores?|cr|l|k)\b)?/gi

const UNITS = {
  k: { multiplier: 1e3, annual: false },
  l: { multiplier: 1e5, annual: true },
  lpa: { multiplier: 1e5, annual: true },
  cr: { multiplier: 1e7, annual: true },
}

// Words that mark the figures next to a label as yearly amounts
const ANNUAL_HINT_RE = /\bp\.a\.?|per\s*annum|annual(ly)?|\/\s*(yr|year)\b|\ba\s*year\b/i

// A monthly CTC this large is implausible, so a bare CTC figure at or
// above it is read as the annual CTC
const MIN_ANNUAL_CTC = 200000

// Units only apply to short figures ("52k", "1.2 Cr"); on a full amount
// a trailing "Cr" means credit ("Net Pay 58,700 Cr"), not crore
const MAX_UNIT_FIGURE = 1000

// A whole number followed by "%" ("PF @ 12%"). Not the tail of a longer
// amount ("50,000 %…"), and not a "%" glued to the next amount — OCR
// reads the ₹ sign as "%" ("%6,00,000").
const PERCENTAGE_RE = /(?<![\d,.])\d+(\.\d+)?\s*%(?!\d)/g

// OCR also reads the ₹ sign as a leading "2" or "3" ("₹9,520" → "39,520").
// Such an amount gets an alternative reading without that digit, chosen
// later only if it makes the payslip's own totals add up. The rest must
// be a well-formed amount, so "30,000" or "2,500" never get one.
const RUPEE_MISREAD_RE = /^[23]([1-9][\d,]*)$/

/** Parses every amount in a piece of text, ignoring percentages ("PF @ 12%"). */
export function parseAmounts(text) {
  const withoutPercentages = text.replace(PERCENTAGE_RE, ' ')
  return [...withoutPercentages.matchAll(AMOUNT_RE)].map(([, digits, suffix]) => {
    const figure = parseFloat(digits.replace(/,/g, ''))
    const unitKey = suffix?.toLowerCase().replace(/^(lakhs?|lacs?)$/, 'l').replace(/^crores?$/, 'cr')
    const unit = (figure < MAX_UNIT_FIGURE && UNITS[unitKey]) || { multiplier: 1, annual: false }
    const amount = { value: figure * unit.multiplier, annual: unit.annual }

    const misread = unit.multiplier === 1 && digits.match(RUPEE_MISREAD_RE)
    if (misread) amount.withoutRupeeMisread = parseFloat(misread[1].replace(/,/g, ''))
    return amount
  })
}

/**
 * Finds every component label in a line, left to right. Overlapping
 * matches are resolved in favour of the earliest, then the longest, so
 * "PF No" (ignore) beats "PF" and "Employer PF" beats "PF".
 *
 * A label right after "of" is a reference, not a line item ("63% of
 * Basic Pay", "12% of Basic"), so it is skipped.
 */
function findLabels(segment) {
  const hits = []
  for (const comp of COMPONENTS) {
    for (const m of segment.matchAll(comp.globalPattern)) {
      if (/\bof\s*\(?\s*$/i.test(segment.slice(0, m.index))) continue
      hits.push({ comp, start: m.index, end: m.index + m[0].length })
    }
  }
  hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))

  const labels = []
  let lastEnd = -1
  for (const hit of hits) {
    if (hit.start >= lastEnd) {
      labels.push(hit)
      lastEnd = hit.end
    }
  }
  return labels
}

/**
 * Removes bracketed notes that explain a figure rather than label it —
 * "(10% of Basic+DA)", "(₹7,200 + 60% DA)", "(30% of Basic)" — since
 * the labels and numbers inside them would be mis-read. Brackets that
 * are part of a label ("(HRA)", "(ESI, if applicable)") or hold an
 * amount ("(3,600)") are kept, with commas blanked so the line isn't
 * split inside them.
 */
function stripExplanatoryNotes(text) {
  return text.replace(/\(([^()]*)\)/g, (bracket, inner) => {
    const hasWords = /[a-z]/i.test(inner.replace(/\b(rs|inr)\b\.?/gi, ''))
    const isNote = /[%+]/.test(inner) || (/\d/.test(inner) && hasWords)
    return isNote ? ' ' : bracket.replace(/,/g, ' ')
  })
}

/**
 * Turns the amounts that follow a label into { monthly, annual }.
 * A second figure only counts as the annual amount when it is roughly
 * 12× the first — otherwise it is a YTD / arrears column and the annual
 * figure is projected from the monthly one instead.
 */
function toMonthlyAnnual(comp, amounts, annualHint) {
  const [first, second] = amounts
  const isAnnual = first.annual || annualHint || (comp.key === 'ctc' && first.value >= MIN_ANNUAL_CTC)
  if (isAnnual) return { monthly: first.value / 12, annual: first.value }

  const projected = first.value * 12
  const annual = second && Math.abs(second.value - projected) <= projected * 0.1 ? second.value : projected
  return { monthly: first.value, annual }
}

/**
 * Like toMonthlyAnnual, plus an `alternative` reading for when the first
 * amount may start with a misread ₹ sign (see RUPEE_MISREAD_RE).
 */
function readAmounts(comp, amounts, annualHint) {
  const reading = toMonthlyAnnual(comp, amounts, annualHint)
  const [first, ...rest] = amounts
  if (first.withoutRupeeMisread !== undefined) {
    reading.alternative = toMonthlyAnnual(comp, [{ ...first, value: first.withoutRupeeMisread }, ...rest], annualHint)
  }
  return reading
}

// Searching every combination of readings stays cheap up to this many
const MAX_AMBIGUOUS_AMOUNTS = 12

/**
 * OCR self-check: for amounts that may start with a misread ₹ sign,
 * picks the readings that make the payslip's own arithmetic hold —
 *   listed earnings ≤ Gross, listed deductions ≤ Total Deductions,
 *   Net Pay = Gross − Total Deductions, Net Pay ≤ Gross —
 * preferring the combination that leaves the least unexplained amount
 * (unlisted components), then the fewest changes. If the slip's totals
 * never agree exactly, the Net Pay equation is dropped and the rest
 * still applied. Mutates `found`.
 */
function resolveRupeeMisreads(found) {
  const ambiguous = Object.keys(found).filter(k => found[k].alternative)
  if (ambiguous.length === 0 || ambiguous.length > MAX_AMBIGUOUS_AMOUNTS) return

  const earningKeys = COMPONENTS.filter(c => c.type === 'earning' && found[c.key]).map(c => c.key)
  const deductionKeys = COMPONENTS.filter(c => c.type === 'deduction' && found[c.key]).map(c => c.key)

  // Returns the unexplained amount for one combination, or null if it breaks a rule
  const unexplainedAmount = (mask, requireNetEquation) => {
    const value = key => {
      const i = ambiguous.indexOf(key)
      return i >= 0 && mask & (1 << i) ? found[key].alternative.monthly : found[key].monthly
    }
    const earnings = earningKeys.reduce((sum, k) => sum + value(k), 0)
    const deductions = deductionKeys.reduce((sum, k) => sum + value(k), 0)
    let unexplained = 0

    if (found.gross) {
      if (value('gross') < earnings - 1) return null
      unexplained += value('gross') - earnings
    }
    if (found.totalDeductions) {
      if (value('totalDeductions') < deductions - 1) return null
      unexplained += value('totalDeductions') - deductions
    }
    if (found.gross && found.netPay && value('netPay') > value('gross')) return null
    if (requireNetEquation && found.gross && found.totalDeductions && found.netPay &&
        Math.abs(value('gross') - value('totalDeductions') - value('netPay')) > 2) return null

    return unexplained
  }

  const changes = mask => mask.toString(2).replace(/0/g, '').length

  for (const requireNetEquation of [true, false]) {
    let best = null
    for (let mask = 0; mask < 1 << ambiguous.length; mask++) {
      const unexplained = unexplainedAmount(mask, requireNetEquation)
      if (unexplained === null) continue
      if (!best || unexplained < best.unexplained ||
          (unexplained === best.unexplained && changes(mask) < changes(best.mask))) {
        best = { mask, unexplained }
      }
    }
    if (best) {
      ambiguous.forEach((key, i) => {
        if (best.mask & (1 << i)) found[key] = found[key].alternative
      })
      return
    }
  }
}

/**
 * Parses free-form payslip text (from OCR or direct user input) into
 * a structured summary + breakdown + action items, using the same
 * response contract the frontend already expects.
 *
 * Each line can hold several label/amount pairs (two-column payslips
 * OCR as "Basic 30,000 Provident Fund 3,600"); the amounts between one
 * label and the next belong to the first. A label with no amount after
 * it takes the last amount on the next line that has no label of its
 * own (vertical layouts: "BASIC PAY" / "₹56,100", or a label followed
 * by an explanatory line such as "Level 8 — 7th CPC | ₹47,600").
 *
 * Pass { fromOcr: true } for text read from an image, to also correct
 * amounts where OCR misread the ₹ sign (see resolveRupeeMisreads).
 *
 * Returns { result, confidence } — confidence is a rough count of how
 * many recognizable components were found, so the caller can decide
 * whether to trust this or fall back to an LLM.
 */
export function parsePayslipText(rawText, { fromOcr = false } = {}) {
  // Split on newlines/semicolons freely, but only split on a comma
  // when it is NOT a thousands separator (i.e. not immediately
  // followed by a digit) — otherwise "12,500" on its own line gets
  // torn into "12" and "500".
  const segments = stripExplanatoryNotes(rawText)
    .split(/[\n;]+|,(?!\d)/)
    .map(s => s.trim())
    .filter(Boolean)

  const found = {} // key -> { monthly, annual }
  const record = (comp, amounts, text) => {
    if (comp.type === 'ignore' || found[comp.key]) return // first match wins
    found[comp.key] = readAmounts(comp, amounts, ANNUAL_HINT_RE.test(text))
  }

  let pending = null // label still waiting for its amount on a later line

  for (const segment of segments) {
    const labels = findLabels(segment)

    if (labels.length === 0) {
      const amounts = parseAmounts(segment)
      if (amounts.length === 0) continue // text-only line: keep waiting
      if (pending) record(pending, amounts.slice(-1), segment)
      pending = null
      continue
    }

    pending = null
    labels.forEach(({ comp, end }, i) => {
      const chunk = segment.slice(end, labels[i + 1]?.start ?? segment.length)
      const amounts = parseAmounts(chunk)
      if (amounts.length > 0) record(comp, amounts, chunk)
      else if (i === labels.length - 1) pending = comp
    })
  }

  if (fromOcr) resolveRupeeMisreads(found)

  const earnings = COMPONENTS.filter(c => c.type === 'earning' && found[c.key])
  const deductions = COMPONENTS.filter(c => c.type === 'deduction' && found[c.key])

  const confidence = earnings.length + deductions.length + (found.gross ? 1 : 0) + (found.netPay ? 1 : 0)

  // Without any earning or a gross figure there is nothing to build a
  // breakdown from (e.g. "CTC 8L, take-home 52k") — leave it to the LLM
  if (confidence < 2 || (earnings.length === 0 && !found.gross)) {
    return { result: null, confidence }
  }

  const grossMonthly = found.gross
    ? found.gross.monthly
    : earnings.reduce((sum, c) => sum + found[c.key].monthly, 0)

  const deductionsMonthly = found.totalDeductions
    ? found.totalDeductions.monthly
    : deductions.reduce((sum, c) => sum + found[c.key].monthly, 0)

  const takeHomeMonthly = found.netPay ? found.netPay.monthly : grossMonthly - deductionsMonthly

  // A non-positive take-home means the numbers were mis-read
  if (takeHomeMonthly <= 0) {
    return { result: null, confidence }
  }

  const basicMonthly = found.basic?.monthly || 0
  const employerPfMonthly = found.pf ? basicMonthly * 0.12 : 0
  const employerNpsMonthly = found.nps ? basicMonthly * 0.10 : 0

  const ctcMonthly = found.ctc ? found.ctc.monthly : grossMonthly + employerPfMonthly + employerNpsMonthly
  const ctcAnnual = found.ctc ? found.ctc.annual : ctcMonthly * 12

  const tdsAnnual = found.tds
    ? found.tds.annual
    : estimateAnnualTax(grossMonthly * 12)

  const employeePfAnnual = found.pf ? found.pf.annual : 0
  const remaining80C = Math.max(0, 150000 - employeePfAnnual)
  const npsExtraHeadroom = found.nps ? 0 : 50000
  const savingsPotential = Math.round((remaining80C * 0.05) + (npsExtraHeadroom * 0.05))
  // ^ rough estimate at the lowest applicable slab rate; genuinely
  // precise savings depend on the person's full tax slab — flagged
  // in the disclaimer below.

  const breakdown = [
    ...earnings.map(c => ({
      component: c.label,
      type: 'earning',
      monthly: Math.round(found[c.key].monthly),
      annual: Math.round(found[c.key].annual),
      explanation: c.explanation,
    })),
    ...deductions.map(c => ({
      component: c.label,
      type: 'deduction',
      monthly: Math.round(found[c.key].monthly),
      annual: Math.round(found[c.key].annual),
      explanation: c.explanation,
    })),
  ]

  const actionItems = buildActionItems({ found, grossMonthly, tdsAnnual })

  const result = {
    summary: {
      takeHome: Math.round(takeHomeMonthly),
      ctc: Math.round(ctcAnnual),
      tds: Math.round(tdsAnnual),
      savingsPotential,
    },
    breakdown,
    actionItems,
    disclaimer:
      'Generated by an automated rule-based parser (no AI), reading whatever labels and numbers it recognized in your input. Savings and CTC figures are estimates — please verify against your Form 16 or with HR.',
  }

  return { result, confidence }
}


/**
 * New Regime FY2025-26 (Budget 2025): ₹75,000 standard deduction, full
 * 87A rebate up to ₹12L taxable income (with marginal relief just above
 * it), plus 4% health & education cess.
 */
export function estimateAnnualTax(annualGross) {
  const taxable = Math.max(0, annualGross - 75000)
  const REBATE_LIMIT = 1200000
  if (taxable <= REBATE_LIMIT) return 0 // rebate u/s 87A

  const slabs = [
    { upto: 400000, rate: 0 },
    { upto: 800000, rate: 0.05 },
    { upto: 1200000, rate: 0.10 },
    { upto: 1600000, rate: 0.15 },
    { upto: 2000000, rate: 0.20 },
    { upto: 2400000, rate: 0.25 },
    { upto: Infinity, rate: 0.30 },
  ]

  let tax = 0
  let lower = 0
  for (const slab of slabs) {
    if (taxable <= lower) break
    const upper = Math.min(taxable, slab.upto)
    tax += Math.max(0, upper - lower) * slab.rate
    lower = slab.upto
  }

  // Marginal relief: tax can't exceed the income earned above the rebate limit
  tax = Math.min(tax, taxable - REBATE_LIMIT)

  return Math.round(tax * 1.04) // + 4% cess
}

function buildActionItems({ found, grossMonthly, tdsAnnual }) {
  const items = []

  if (found.hra) {
    items.push({
      priority: 'high',
      action: 'Submit your rent receipts / rent agreement to HR before the proof-submission deadline to claim your HRA exemption.',
      link: null,
    })
  }

  if (!found.nps) {
    items.push({
      priority: 'medium',
      action: 'Consider opening an NPS account — it unlocks an extra ₹50,000 deduction under 80CCD(1B) (old regime only).',
      link: 'https://enps.nsdl.com/',
    })
  }

  items.push({
    priority: 'medium',
    action: 'Confirm with HR whether your payslip is on the Old or New tax regime — this changes which exemptions apply to you.',
    link: null,
  })

  if (grossMonthly > 0 && tdsAnnual > grossMonthly * 12 * 0.15) {
    items.push({
      priority: 'high',
      action: 'Your TDS looks high relative to your income — check your investment declarations with HR/payroll to see if you can reduce it.',
      link: null,
    })
  }

  items.push({
    priority: 'low',
    action: 'Cross-check these numbers against your official Form 16 once it is issued at year-end.',
    link: null,
  })

  const priorityRank = { high: 0, medium: 1, low: 2 }
  items.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])

  return items.slice(0, 5)
}
