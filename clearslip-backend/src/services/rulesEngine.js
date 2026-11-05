/**
 * Deterministic payslip decoder — replaces the Claude call with plain
 * JS rules for the common, well-formed cases. Falls back to an LLM
 * (see llmFallbackService.js) only when confidence is too low.
 *
 * Salary/tax knowledge below mirrors the original Claude system prompt
 * (now removed) and src/prompts/fallbackPrompt.js.
 */

import { estimateAnnualTax, investmentSaving, oldRegimeBestCase, SURCHARGE_THRESHOLD } from './taxCalculator.js'

const COMPONENTS = [
  // Earnings
  { key: 'basic', label: 'Basic Salary', type: 'earning', pattern: /\bbasic(\s*(salary|pay))?\b/i,
    explanation: 'Your core fixed salary — most other components are calculated as a % of this.' },
  // Government slips pay DA on the transport allowance as a line of its own
  { key: 'daOnTa', label: 'DA on Transport Allowance', type: 'earning', pattern: /\bd\.?\s?a\.?\s*on\s*(t\.?\s?a\.?\b|transport(\s*allowance)?)/i,
    explanation: 'Dearness allowance paid on top of the transport allowance (government pay) — fully taxable.' },
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
  { key: 'overtime', label: 'Overtime / Shift Allowance', type: 'earning', pattern: /over\s*time|\bot\s*(pay|allowance|wages)\b|(night\s*)?shift\s*allowance/i,
    explanation: 'Extra pay for overtime or shift work — fully taxable.' },
  { key: 'otherEarning', label: 'Other Allowance', type: 'earning', pattern: /other\s*allowance/i,
    explanation: 'Additional allowance component — fully taxable.' },

  // One-off earnings: paid in this month only, so they are counted once in the
  // yearly salary, not 12 times (a festival bonus would otherwise add 12 bonuses)
  { key: 'bonus', label: 'Bonus / Incentive', type: 'earning', oneOff: true, pattern: /\bbonus\b|incentive/i,
    explanation: 'Variable pay — fully taxable in the month it is paid. Counted once in your yearly salary, not every month.' },
  { key: 'variablePay', label: 'Variable Pay', type: 'earning', oneOff: true, pattern: /variable\s*(pay|component)|performance\s*pay|\bpli\b/i,
    explanation: 'Performance-linked pay, often paid quarterly or yearly — fully taxable. Counted once unless your payslip shows it every month.' },
  { key: 'arrears', label: 'Arrears', type: 'earning', oneOff: true, pattern: /\barrears?\b/i,
    explanation: 'Pay owed from earlier months (for example a backdated raise), paid now. Counted once, not every month.' },
  { key: 'leaveEncashment', label: 'Leave Encashment', type: 'earning', oneOff: true, pattern: /leave\s*encash(ment)?|\bencashment\b/i,
    explanation: 'Unused leave paid out in cash. Taxable while you are employed. Counted once, not every month.' },

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
  // Printed as a deduction or as a negative earning ("Loss of Pay -5,000"): either way it reduces pay
  { key: 'lop', label: 'Loss of Pay (LOP)', type: 'deduction', oneOff: true, alwaysReduces: true, minAmount: 100, pattern: /loss\s*of\s*pay|\blop\b|leave\s*without\s*pay|\blwp\b/i,
    explanation: 'Pay cut for unpaid leave or days not worked this month.' },
  { key: 'insurance', label: 'Insurance Premium', type: 'deduction', pattern: /(group|medical|health|term|life)\s*(medical\s*)?insurance|mediclaim|\bgmc\b|\bcgegis\b|insurance\s*premium/i,
    explanation: 'Your share of a group health or life insurance policy arranged by your employer.' },
  { key: 'otherDeduction', label: 'Other Deductions', type: 'deduction', pattern: /\bother\s*deductions?\b|\bmisc(ellaneous)?\.?\s*deductions?\b/i,
    explanation: 'Deductions the payslip groups together — ask HR what they cover if it doesn\'t say.' },
  { key: 'cghs', label: 'CGHS Contribution', type: 'deduction', pattern: /\bcghs\b|central\s*government\s*health\s*scheme/i,
    explanation: 'Central Government Health Scheme — medical cover for central government employees and their families.' },
  { key: 'lwf', label: 'Labour Welfare Fund', type: 'deduction', pattern: /\blwf\b|labou?r\s*welfare(\s*fund)?/i,
    explanation: 'A small state welfare contribution, usually a few rupees, deducted once or twice a year in most states.' },

  // Totals (not part of the breakdown, used to anchor the calculation).
  // "Gross Deductions" is a deductions total, not gross salary.
  { key: 'gross', label: 'Gross Salary', type: 'total', pattern: /total\s*earnings|gross(?!\s*deductions?\b)(\s*(salary|pay|earnings))?/i },
  { key: 'totalDeductions', label: 'Total Deductions', type: 'total', pattern: /(total|gross)\s*deductions?/i },
  { key: 'netPay', label: 'Net Pay / Take Home', type: 'total', pattern: /net\s*(pay|salary|amount)|take[\s-]?home/i },
  { key: 'ctc', label: 'CTC', type: 'total', pattern: /\bctc\b|cost\s*to\s*company/i },

  // Labels that look like components but carry identifiers ("PF No",
  // "UAN") or employer-side amounts ("Employer PF"). Matched only so
  // their numbers are not attributed to a real component.
  // Day counts ("LOP Days 2", "Paid Days 30") are ignored too, so a count isn't read as rupees.
  { key: 'ignore', type: 'ignore', pattern: /\b(pf|uan|esic?|pan|emp(loyee)?)\s*(a\/c\s*)?(no|number|id|code)\b\.?|\buan\b|employer'?s?(\s*(share|contribution)(\s*(of|to|towards))?)?\s*(e?pf|provident\s*fund|nps|esic?)?|\b(lop|lwp|paid|payable|working|worked|present|absent|leave)\s*days?\b/i },
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

// A number of days ("2 Days", "30 days") is a count, never an amount
const DAY_COUNT_RE = /(?<![\d,.])\d{1,3}\s*days?\b/gi

// OCR also reads the ₹ sign as a leading "2" or "3" ("₹9,520" → "39,520").
// Such an amount gets an alternative reading without that digit, chosen
// later only if it makes the payslip's own totals add up. The rest must
// be a well-formed amount, so "30,000" or "2,500" never get one.
const RUPEE_MISREAD_RE = /^[23]([1-9][\d,]*)$/

// A minus sign attached to an amount ("Bonus -50,000"), after a space or at the
// start. A dash with a space after it is a separator ("Basic - 37,500"), and one
// after a digit is part of a date or range ("01-10-2026"), so neither counts.
const MINUS_BEFORE_RE = /(^|\s)[-−]$/

/** Parses every amount in a piece of text, ignoring percentages ("PF @ 12%"). */
export function parseAmounts(text) {
  const withoutPercentages = text.replace(PERCENTAGE_RE, ' ').replace(DAY_COUNT_RE, ' ')
  return [...withoutPercentages.matchAll(AMOUNT_RE)].map(match => {
    const [, digits, suffix] = match
    const sign = MINUS_BEFORE_RE.test(withoutPercentages.slice(Math.max(0, match.index - 2), match.index)) ? -1 : 1
    const figure = parseFloat(digits.replace(/,/g, ''))
    const unitKey = suffix?.toLowerCase().replace(/^(lakhs?|lacs?)$/, 'l').replace(/^crores?$/, 'cr')
    const unit = (figure < MAX_UNIT_FIGURE && UNITS[unitKey]) || { multiplier: 1, annual: false }
    const amount = { value: sign * figure * unit.multiplier, annual: unit.annual }

    const misread = unit.multiplier === 1 && digits.match(RUPEE_MISREAD_RE)
    if (misread) amount.withoutRupeeMisread = sign * parseFloat(misread[1].replace(/,/g, ''))
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
  const yearlyColumn = second && Math.abs(second.value - projected) <= projected * 0.1
  // A one-off payment is this month's only and adds to the year once, unless the
  // payslip's own yearly column shows it every month ("Bonus | 8,500 | 1,02,000")
  if (comp.oneOff && !yearlyColumn) return { monthly: first.value, annual: first.value, oneOff: true }
  return { monthly: first.value, annual: yearlyColumn ? second.value : projected }
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

  // Government slips annotate figures ("63% of Basic Pay — 29,988"). When two
  // readings fit the totals equally, the one that matches these notes wins.
  const valueOf = (key, mask) => {
    const i = ambiguous.indexOf(key)
    return i >= 0 && mask & (1 << i) ? found[key].alternative.monthly : found[key].monthly
  }
  const matchesNotes = mask => Object.keys(found).filter(key => {
    const pct = found[key].source?.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*basic/i)
    if (!pct || !found.basic || key === 'basic') return false
    const expected = valueOf('basic', mask) * Number(pct[1]) / 100
    return Math.abs(valueOf(key, mask) - expected) <= Math.max(2, expected * 0.01)
  }).length

  for (const requireNetEquation of [true, false]) {
    let best = null
    for (let mask = 0; mask < 1 << ambiguous.length; mask++) {
      const unexplained = unexplainedAmount(mask, requireNetEquation)
      if (unexplained === null) continue
      const notes = matchesNotes(mask)
      if (!best || unexplained < best.unexplained ||
          (unexplained === best.unexplained && notes > best.notes) ||
          (unexplained === best.unexplained && notes === best.notes && changes(mask) < changes(best.mask))) {
        best = { mask, unexplained, notes }
      }
    }
    if (best) {
      ambiguous.forEach((key, i) => {
        if (best.mask & (1 << i)) found[key] = { ...found[key].alternative, corrected: true }
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

  const found = {} // key -> { monthly, annual, source }
  const repeated = new Set() // components that appear more than once (two payslips, rate and earned columns)
  const unplaced = [] // lines with an amount but no label ClearSlip knows
  const notePlace = text => {
    for (const line of unknownLines(text)) {
      if (unplaced.length < MAX_UNPLACED && !unplaced.some(u => u.text === line.text)) unplaced.push(line)
    }
  }

  // `source` is the payslip line a figure came from, shown next to it so the user can check it
  const record = (comp, amounts, text, source) => {
    if (comp.type === 'ignore') return
    if (found[comp.key]) { // first match wins
      if (comp.type !== 'total') repeated.add(comp.key)
      return
    }
    // "Loss of pay 30/0" or "LWP: 2" next to days paid is a day count, not rupees
    if (comp.minAmount && amounts.every(a => Math.abs(a.value) < comp.minAmount)) return
    if (comp.alwaysReduces) amounts = amounts.map(a => ({ ...a, value: Math.abs(a.value) }))
    const reading = readAmounts(comp, amounts, ANNUAL_HINT_RE.test(text))
    reading.source = source.slice(0, MAX_SOURCE_CHARS)
    if (reading.alternative) reading.alternative.source = reading.source
    found[comp.key] = reading
  }

  let pending = null // label still waiting for its amount on a later line

  for (const segment of segments) {
    const labels = findLabels(segment)

    if (labels.length === 0) {
      const amounts = parseAmounts(segment)
      if (amounts.length === 0) continue // text-only line: keep waiting
      if (pending) record(pending.comp, amounts.slice(-1), segment, `${pending.segment} / ${segment}`)
      else notePlace(segment)
      pending = null
      continue
    }

    pending = null
    // Text before the first label ("Salary Arrears 12,000 Provident Fund 3,600")
    notePlace(segment.slice(0, labels[0].start))
    labels.forEach(({ comp, end }, i) => {
      const chunk = segment.slice(end, labels[i + 1]?.start ?? segment.length)
      const amounts = parseAmounts(chunk)
      if (amounts.length > 0) {
        record(comp, amounts, chunk, segment)
        // An unknown label after this one's amount ("Basic 30,000 Night Allowance 2,000")
        notePlace(afterFirstAmount(chunk))
      } else if (i === labels.length - 1) pending = { comp, segment }
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

  const rows = [...earnings, ...deductions].map(c => ({
    component: c.label,
    type: c.type,
    explanation: c.explanation,
    ...found[c.key],
  }))

  const result = summarise(found, rows, 'Generated by an automated rule-based parser (no AI), reading whatever labels and numbers it recognized in your input. Savings and CTC figures are estimates — please verify against your Form 16 or with HR.')
  if (result) {
    result.checks.push(...readingChecks({ found, rows, unplaced, repeated, months: monthsMentioned(rawText) }))
    if (unplaced.length) result.unplaced = unplaced
  }
  return { result, confidence }
}

// ── What the parser could not account for ──────────────────────────

const MAX_UNPLACED = 8

// A label followed by an amount: "Salary Arrears 12,000", "Night Allowance: ₹2,000", "Canteen -450".
// As in parseAmounts, a dash with a space after it separates; one touching the digits is a minus.
const UNKNOWN_LINE_RE = /([a-z][a-z&/.'’ ()-]*?[a-z.)])\s*(?:[:=|–]|-(?=\s))?\s*(?:₹|rs\.?|inr)?\s*([-−]?\d[\d,]*(?:\.\d+)?)/gi

// Labels that aren't pay components: identifiers, dates, counts, headings, running totals
const NOT_A_COMPONENT_RE = /^[x*•#]+$|^(earnings?|deductions?|allowances?|particulars|amount|description)$|\b(id|no|number|code|days?|date|dob|doj|month|year|period|a\/c|account|ifsc|uan|pan|phone|mobile|pin|grade|level|ytd|year\s*to\s*date|cumulative|total|page|emp|employee|designation|department|dept|location|bank|branch|cheque|payslip|salary\s*slip|pay\s*slip|financial|fy|ay|age|joining|week|hours?|hrs|rate|units?|qty|quantity|version|ref|invoice|policy)\b|^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/i

// Words that usually mean money taken out of pay
const DEDUCTION_HINT_RE = /recover|deduct|loss|fine|penalt|canteen|food|meal|welfare|insurance|premium|contribution|advance|loan|tax|cess|fee|charge|subscription|donation|club|notice|union/i

/** Label + amount pairs in text that no known component claimed. */
function unknownLines(text) {
  const lines = []
  // Dates ("26th June 2026", "October 2026") hold numbers that aren't amounts
  const withoutDates = text.replace(MONTH_YEAR_RE, ' ').replace(/\b\d{1,2}(st|nd|rd|th)\b/gi, ' ')
  for (const m of withoutDates.matchAll(UNKNOWN_LINE_RE)) {
    const label = m[1].replace(/[\s|:–-]+$/, '').trim()
    const [amount] = parseAmounts(m[2].replace(/\s/g, ''))
    if (!amount || Math.abs(amount.value) < 10) continue // a count, not rupees
    if (label.length < 3 || NOT_A_COMPONENT_RE.test(label)) continue
    lines.push({
      text: m[0].trim().slice(0, MAX_SOURCE_CHARS),
      component: label.slice(0, 80),
      monthly: Math.abs(amount.value),
      suggestedType: amount.value < 0 || DEDUCTION_HINT_RE.test(label) ? 'deduction' : 'earning',
    })
  }
  return lines
}

function afterFirstAmount(text) {
  const m = new RegExp(AMOUNT_RE.source, 'i').exec(text)
  return m ? text.slice(m.index + m[0].length) : ''
}

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_YEAR_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s,'’-]*((?:19|20)\d{2})\b/gi

/** Distinct month-year mentions ("October 2026", "Nov-2026"), in order. */
function monthsMentioned(text) {
  const months = []
  for (const [, name, year] of text.matchAll(MONTH_YEAR_RE)) {
    const label = `${name[0].toUpperCase()}${MONTH_NAMES[MONTH_NAMES.indexOf(name.slice(0, 3).toLowerCase())].slice(1)} ${year}`
    if (!months.includes(label)) months.push(label)
  }
  return months
}

// Printed totals and what was read may differ by rounding; beyond this, something was missed
const close = (a, b) => Math.abs(a - b) <= Math.max(10, Math.abs(b) * 0.01)

/**
 * Notes about what the parser may have missed: lines it couldn't place, a
 * payslip's own totals that the lines read don't reach, and components that
 * appear twice (two payslips pasted together, or "rate" and "earned" columns).
 */
function readingChecks({ found, rows, unplaced, repeated, months }) {
  const checks = []
  const sum = type => rows.filter(r => r.type === type).reduce((s, r) => s + r.monthly, 0)

  // Two components repeating alongside two months is two payslips; without the
  // months, a single repeat is usually a sub-line ("DA on Transport Allowance")
  if ((repeated.size >= 2 && months.length >= 2) || repeated.size >= 3) {
    const names = COMPONENTS.filter(c => repeated.has(c.key)).map(c => c.label)
    checks.push(months.length >= 2
      ? `This looks like more than one payslip (${months.join(', ')}). ClearSlip read only the first amount for each line — decode one month at a time, then save each month to compare them.`
      : `${names.slice(0, 3).join(', ')} appear more than once, and ClearSlip used the first amount for each. If your payslip has separate "rate" and "earned" columns, check that these are the amounts you were actually paid.`)
  }

  if (unplaced.length) {
    checks.push(`${unplaced.length === 1 ? 'One line wasn\'t' : `${unplaced.length} lines weren't`} recognised, so ${unplaced.length === 1 ? 'it is' : 'they are'} left out of these figures: ${unplaced.slice(0, 3).map(u => `"${u.text}"`).join(', ')}${unplaced.length > 3 ? '…' : ''}. Add ${unplaced.length === 1 ? 'it' : 'them'} under "Lines we couldn't place" if ${unplaced.length === 1 ? 'it is' : 'they are'} part of your pay.`)
  }

  // The payslip's own totals, printed or implied by the other two
  const printed = { gross: found.gross?.monthly, deductions: found.totalDeductions?.monthly, net: found.netPay?.monthly }
  const gross = printed.gross ?? (printed.net != null && printed.deductions != null ? printed.net + printed.deductions : null)
  const deductions = printed.deductions ?? (printed.gross != null && printed.net != null ? printed.gross - printed.net : null)
  const mismatch = (what, read, total, isPrinted) => {
    const gap = total - read
    checks.push(`The ${what} ClearSlip read add up to ${inrText(read)}, but your payslip's ${isPrinted ? 'total is' : 'totals imply'} ${inrText(total)} (${inrText(gap)} ${gap > 0 ? 'not accounted for' : 'too much'}). ${gap > 0 ? 'A line may not have been read' : 'A figure may have been read twice or wrongly'} — check the breakdown and correct it.`)
  }
  if (gross != null && !close(sum('earning'), gross)) mismatch('earnings', sum('earning'), gross, printed.gross != null)
  if (deductions != null && !close(sum('deduction'), deductions)) mismatch('deductions', sum('deduction'), deductions, printed.deductions != null)
  if (printed.gross != null && printed.deductions != null && printed.net != null && !close(printed.gross - printed.deductions, printed.net)) {
    checks.push(`Your payslip's own totals don't add up: gross ${inrText(printed.gross)} minus deductions ${inrText(printed.deductions)} is ${inrText(printed.gross - printed.deductions)}, not the net pay of ${inrText(printed.net)}. The take-home shown is the payslip's net pay.`)
  }
  return checks
}

// Long enough for a two-column payslip line, short enough to show under a figure
const MAX_SOURCE_CHARS = 120

/**
 * Recalculates everything from figures the user has checked or corrected
 * (the editable breakdown). Rows keep their own names; the ones ClearSlip
 * recognises (Basic, PF, TDS…) still drive the tax and checklist logic.
 * Totals are always worked out from the rows here, never taken from the payslip.
 */
export function recalculateFromRows(inputRows) {
  const found = {}
  const rows = inputRows.map(row => {
    const comp = COMPONENTS.find(c => c.type === row.type && c.pattern.test(row.component))
    // The user's own choice wins; otherwise a bonus or arrears row is one-off as usual
    const oneOff = row.oneOff ?? Boolean(comp?.oneOff)
    const amounts = { monthly: row.monthly, annual: oneOff ? row.monthly : row.monthly * 12 }
    if (comp && !found[comp.key]) found[comp.key] = amounts
    return { component: row.component, type: row.type, explanation: comp?.explanation, ...amounts, ...(oneOff && { oneOff: true }), edited: true }
  })
  if (!rows.some(r => r.type === 'earning')) return null
  return summarise(found, rows, 'Recalculated from the figures you checked. Savings and CTC figures are estimates — please verify against your Form 16 or with HR.')
}

// Above this a monthly figure is more likely a yearly one that wasn't marked "p.a."
const MAX_PLAUSIBLE_MONTHLY_GROSS = 500000

/**
 * Builds the summary, breakdown, checks and action items from the figures found.
 * `found` holds the recognised components by key (for the tax and checklist
 * logic, and any Gross / Net Pay / CTC lines the payslip printed); `rows` is
 * what the breakdown shows. Returns null when take-home comes out at zero or
 * below, which means the figures were mis-read.
 */
function summarise(found, rows, disclaimer) {
  const sum = type => rows.filter(r => r.type === type).reduce((s, r) => s + r.monthly, 0)
  const grossMonthly = found.gross ? found.gross.monthly : sum('earning')
  const deductionsMonthly = found.totalDeductions ? found.totalDeductions.monthly : sum('deduction')
  const takeHomeMonthly = found.netPay ? found.netPay.monthly : grossMonthly - deductionsMonthly

  if (takeHomeMonthly <= 0) return null

  // One-off pay (a bonus, arrears) is in this month's gross but adds to the
  // year only once, so the yearly salary is this month × 12 minus the repeats
  const oneOffs = rows.filter(r => r.oneOff && r.type === 'earning')
  const grossAnnual = grossMonthly * 12 - oneOffs.reduce((s, r) => s + r.monthly * 12 - r.annual, 0)

  // The employer's PF matches the employee's own contribution, which already
  // reflects whether PF is on full basic or capped at the ₹15,000 wage ceiling
  // (₹1,800/month). Employer NPS, insurance and gratuity aren't on a payslip, so
  // without a CTC line this is an estimate and is labelled as one in the UI.
  const employerPfMonthly = found.pf?.monthly || 0

  const ctcAnnual = found.ctc ? found.ctc.annual : grossAnnual + employerPfMonthly * 12

  const tdsAnnual = found.tds
    ? found.tds.annual
    : estimateAnnualTax(grossAnnual)

  // Tax under the cheaper regime with what the payslip shows (PF in 80C,
  // professional tax), and what using the full 80C and NPS limits would save
  const { taxNow, saving: savingsPotential } = investmentSaving(grossAnnual, {
    section80C: found.pf?.annual ?? 0,
    professionalTax: found.pt?.annual ?? 0,
    basicPlusDa: (found.basic?.annual ?? 0) + (found.da?.annual ?? 0),
  })

  const breakdown = rows.map(r => ({
    component: r.component,
    type: r.type,
    monthly: Math.round(r.monthly),
    annual: Math.round(r.annual),
    explanation: r.explanation,
    ...(r.source && { source: r.source }),
    ...(r.corrected && { corrected: true }),
    ...(r.edited && { edited: true }),
    ...(r.oneOff && { oneOff: true }),
  }))

  // Whether old-regime tips (rent receipts, NPS) could lower this person's tax at all
  const regimes = oldRegimeBestCase(grossAnnual, {
    hraReceived: found.hra?.annual ?? 0,
    professionalTax: found.pt?.annual ?? 0,
    basicPlusDa: (found.basic?.annual ?? 0) + (found.da?.annual ?? 0),
  })
  const actionItems = buildActionItems({ found, tdsAnnual, taxNow, grossAnnual, oneOffs, regimes })

  return {
    summary: {
      takeHome: Math.round(takeHomeMonthly),
      ctc: Math.round(ctcAnnual),
      tds: Math.round(tdsAnnual),
      estimatedTax: taxNow,
      savingsPotential,
    },
    breakdown,
    checks: plausibilityChecks(rows, grossAnnual),
    actionItems,
    disclaimer,
  }
}

const inrText = n => `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`

/**
 * Figures that were read correctly but may not mean what we assumed — shown
 * as "Please check" notes above the results, never silently corrected.
 */
function plausibilityChecks(rows, grossAnnual) {
  const checks = []
  for (const r of rows.filter(r => r.monthly < 0)) {
    checks.push(r.type === 'earning'
      ? `${r.component} has a minus sign (−${inrText(r.monthly)}), which usually means a recovery or reversal, so it is subtracted from your pay. Ask HR if you didn't expect it.`
      : `${r.component} has a minus sign (−${inrText(r.monthly)}), which usually means money given back to you, so it adds to your take-home.`)
  }
  // Judged on the regular monthly pay, so a big one-off bonus doesn't trigger it
  if (grossAnnual / 12 > MAX_PLAUSIBLE_MONTHLY_GROSS) {
    checks.push(`These amounts were read as monthly, which makes your salary ${inrText(grossAnnual)} a year. If they are yearly figures, add "per annum" after them (or correct them below) and recalculate.`)
  }
  const oneOffs = rows.filter(r => r.oneOff && r.type === 'earning' && r.monthly === r.annual)
  if (oneOffs.length) {
    checks.push(`${oneOffs.map(r => `${r.component} (${inrText(r.monthly)})`).join(' and ')} ${oneOffs.length === 1 ? 'is' : 'are'} counted once in your yearly salary, not every month. If ${oneOffs.length === 1 ? 'it is' : 'they are'} paid every month, mark ${oneOffs.length === 1 ? 'it' : 'them'} as regular in "Check & correct figures".`)
  }
  for (const r of rows.filter(r => r.corrected)) {
    checks.push(`${r.component}: the ₹ sign was probably read as a digit, so ClearSlip used ${inrText(r.monthly)} because that makes your payslip's totals add up. Please confirm.`)
  }
  return checks
}


// Re-exported so existing callers and tests keep importing it from here
export { estimateAnnualTax }

// TDS and our estimate rarely match to the rupee (TDS can change during the
// year); only a gap larger than this is worth an action item
const TDS_GAP_TOLERANCE = 6000

// Below this a year, the old regime's best case — which takes full 80C and NPS
// investments plus rent receipts — isn't worth recommending
const MIN_OLD_REGIME_SAVING = 10000

function buildActionItems({ found, tdsAnnual, taxNow, grossAnnual, oneOffs = [], regimes }) {
  const items = []

  if (grossAnnual > SURCHARGE_THRESHOLD) {
    items.push({
      priority: 'high',
      action: 'Your salary is above ₹50 lakh a year, so a surcharge (10% or more of your income tax) also applies. ClearSlip\'s tax figures leave it out, so your real tax is higher — check it with a chartered accountant or your Form 16.',
      link: 'https://www.incometax.gov.in/',
    })
  }

  // First, so overpaid tax leads the list. Only when TDS is on the payslip —
  // otherwise tdsAnnual is our own estimate
  const inr = n => `₹${Math.round(n).toLocaleString('en-IN')}`
  // In a month with a bonus, TDS usually includes tax on the bonus, so 12× this
  // month's TDS says nothing about the year: explain that instead of comparing
  const tdsGap = found.tds && oneOffs.length === 0 ? tdsAnnual - taxNow : 0
  if (found.tds && oneOffs.length > 0) {
    items.push({
      priority: 'medium',
      action: `This payslip includes a one-off payment (${oneOffs.map(r => `${r.component} ${inr(r.monthly)}`).join(', ')}), so this month's TDS is probably higher than usual. ClearSlip estimates the tax on your year at about ${inr(taxNow)} (counting the payment once); compare that with the total TDS on your Form 16 rather than multiplying this month's.`,
      link: null,
    })
  } else if (tdsGap > TDS_GAP_TOLERANCE) {
    items.push({
      priority: 'high',
      action: `You may be paying too much tax: this payslip's TDS adds up to ${inr(tdsAnnual)} a year, but the tax on your salary is about ${inr(taxNow)} under the cheaper regime. Ask HR which regime they have applied — any extra TDS comes back as a refund when you file your return.`,
      link: 'https://www.incometax.gov.in/',
    })
  } else if (tdsGap < -TDS_GAP_TOLERANCE) {
    items.push({
      priority: 'medium',
      action: `Your TDS (${inr(tdsAnnual)} a year at this rate) is below the estimated tax on your salary (${inr(taxNow)}). Unless you have declared investments to HR, expect TDS to rise later in the year, or tax to pay when you file.`,
      link: null,
    })
  }

  // Rent receipts, NPS and 80C only lower tax in the old regime. When even its
  // best case can't beat the new regime (always so when the new regime's tax is
  // ₹0), say that instead of suggesting steps that can't help.
  const oldRegimeCanHelp = !regimes || regimes.couldSave >= MIN_OLD_REGIME_SAVING
  if (!oldRegimeCanHelp) {
    items.push({
      priority: 'medium',
      action: `The new regime suits your salary: its tax is ${regimes.newTax === 0 ? '₹0' : `about ${inr(regimes.newTax)} a year`}, and even with full 80C, NPS, health-insurance and HRA claims the old regime ${regimes.couldSave > 0 ? `would save at most ${inr(regimes.couldSave)} a year` : "wouldn't come lower"}. So rent receipts and tax-saving investments ${regimes.couldSave > 0 ? "aren't worth it for tax alone" : "won't reduce your tax"} — just make sure HR has you on the new regime. (A home loan can change this: try What if…? below.)`,
      link: null,
    })
  }

  if (found.hra && oldRegimeCanHelp) {
    items.push({
      priority: 'high',
      action: 'Submit your rent receipts / rent agreement to HR before the proof-submission deadline to claim your HRA exemption (old regime only).',
      link: null,
    })
  }

  if (!found.nps && oldRegimeCanHelp) {
    items.push({
      priority: 'medium',
      action: `Consider opening an NPS account — it unlocks an extra ₹50,000 deduction under 80CCD(1B) (old regime only).${regimes ? ` With every common deduction, the old regime could save you up to ${inr(regimes.couldSave)} a year.` : ''}`,
      link: 'https://enps.nsdl.com/',
    })
  }

  // The overpaid-tax item already says to ask HR about the regime, and so does
  // the "new regime suits you" one
  if (tdsGap <= TDS_GAP_TOLERANCE && oldRegimeCanHelp) {
    items.push({
      priority: 'medium',
      action: 'Confirm with HR whether your payslip is on the Old or New tax regime — this changes which exemptions apply to you.',
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
