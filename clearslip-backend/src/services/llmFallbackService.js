import { config } from '../config/index.js'
import { FALLBACK_SYSTEM_PROMPT } from '../prompts/fallbackPrompt.js'
import { groqChat, GROQ_UNAVAILABLE_CODES } from './groqClient.js'
import { investmentSaving } from './taxCalculator.js'
import { recalculateFromRows } from './rulesEngine.js'
import { redactPersonalData } from '../utils/redact.js'
import { fallbackResultSchema } from '../utils/validateInput.js'

// Shown to end users, so no setup details here — server.js logs at
// startup that GROQ_API_KEY is missing
const CANT_DECODE_MESSAGE =
  "We couldn't find enough payslip lines in this to decode it. Paste the earnings and deductions lines from your payslip (for example \"Basic 25,000, HRA 10,000, PF 3,000\"), or upload a clear photo of it."

const AI_DOWN_MESSAGE =
  "ClearSlip's AI reader isn't responding right now. Try again in a few minutes, or paste the earnings and deductions lines (for example \"Basic 25,000, HRA 10,000, PF 3,000\")."

// No reply, no connection or a Groq outage: worth retrying later, unlike a bad key
const AI_DOWN_CODES = ['GROQ_SERVER', 'GROQ_TIMEOUT', 'GROQ_NETWORK']

const UNRELIABLE_MESSAGE =
  "We couldn't read this payslip reliably enough to show figures. Paste the earnings and deductions lines (for example \"Basic 25,000, HRA 10,000, PF 3,000\"), or upload a clearer photo."

/**
 * Free-tier LLM fallback for payslip text the rule-based engine
 * couldn't confidently parse. Uses Groq (OpenAI-compatible, generous
 * free tier, no cost) instead of the Claude API.
 *
 * Requires GROQ_API_KEY in .env — get one free at https://console.groq.com
 * Without a key, or when Groq is unavailable (expired key, retired model),
 * this throws the same friendly 422 the rules engine's caller shows; a
 * rate limit passes through as a "try again in a minute" 503.
 */
export async function decodeWithFallback(rawText) {
  if (!config.groqApiKey) throw cantDecode()

  const request = {
    temperature: 0.2,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: FALLBACK_SYSTEM_PROMPT },
      // Names, PAN, account numbers etc. never leave the server
      { role: 'user', content: `Here is the extracted payslip text:\n\n${redactPersonalData(rawText)}` },
    ],
  }

  let message
  try {
    message = await groqChat(request).catch(err => {
      // Groq's JSON check occasionally rejects a valid-looking answer; one retry usually passes
      if (err.code === 'GROQ_JSON_FAILED') return groqChat(request)
      throw err
    })
  } catch (err) {
    if (err.code === 'GROQ_JSON_FAILED') throw unreliable()
    if (AI_DOWN_CODES.includes(err.code)) throw aiDown()
    if (GROQ_UNAVAILABLE_CODES.includes(err.code) && err.code !== 'GROQ_RATE_LIMITED') throw cantDecode()
    throw err
  }

  if (!message.content) {
    const err = new Error('Empty response from fallback AI')
    err.status = 502
    err.code = 'FALLBACK_LLM_EMPTY'
    throw err
  }

  return withCalculatedSaving(checkedResult(parseJSON(message.content)))
}

// Tolerance for take-home vs earnings − deductions (rounding on the payslip itself)
const NET_TOLERANCE = { share: 0.02, rupees: 100 }

/**
 * The model's answer is shown as payslip figures, so it must have the right shape
 * and add up. Anything impossible (negative amounts, take-home that doesn't match
 * earnings − deductions) is rejected rather than shown.
 *
 * The model only reads figures. The action items are written by the rules engine
 * from those figures, never by the model: its text comes from reading a document
 * someone else may have written ("Your account is frozen, call…"), and action
 * items are signed so they can be emailed as ClearSlip's own checklist.
 */
function checkedResult(parsed) {
  const shape = fallbackResultSchema.safeParse(parsed)
  if (!shape.success) throw unreliable()
  const result = shape.data

  const sum = type => result.breakdown.filter(r => r.type === type).reduce((s, r) => s + r.monthly, 0)
  const earnings = sum('earning')
  const deductions = sum('deduction')
  const { takeHome } = result.summary
  const tolerance = Math.max(earnings * NET_TOLERANCE.share, NET_TOLERANCE.rupees)
  const expectedTakeHome = deductions > 0 ? earnings - deductions : null

  const plausible = earnings >= 1000 && earnings <= 10000000
    && takeHome > 0 && takeHome <= earnings + tolerance
    && (expectedTakeHome === null || Math.abs(takeHome - expectedTakeHome) <= tolerance)
  if (!plausible) throw unreliable()

  const fromRules = recalculateFromRows(result.breakdown.map(r => ({ component: r.component, type: r.type, monthly: r.monthly })))
  return { ...result, actionItems: fromRules?.actionItems ?? [] }
}

function aiDown() {
  const err = new Error(AI_DOWN_MESSAGE)
  err.status = 503
  err.code = 'FALLBACK_UNAVAILABLE'
  return err
}

function unreliable() {
  const err = new Error(UNRELIABLE_MESSAGE)
  err.status = 422
  err.code = 'FALLBACK_UNRELIABLE'
  return err
}

// The model reads the payslip; the tax arithmetic is redone with the calculator
// the rules engine uses, so both paths give the same "tax you could save"
function withCalculatedSaving(result) {
  const rows = result.breakdown.filter(r => Number.isFinite(r.annual))
  const annual = (type, pattern) => rows.find(r => r.type === type && pattern.test(r.component))?.annual ?? 0
  const grossAnnual = rows.filter(r => r.type === 'earning').reduce((sum, r) => sum + r.annual, 0)
  if (!grossAnnual) return result
  const { taxNow, saving } = investmentSaving(grossAnnual, {
    section80C: annual('deduction', /provident|\bE?PF\b/i),
    professionalTax: annual('deduction', /professional\s*tax/i),
    basicPlusDa: annual('earning', /basic/i) + annual('earning', /\bDA\b|dearness/i),
  })
  return { ...result, summary: { ...result.summary, estimatedTax: taxNow, savingsPotential: saving } }
}

function cantDecode() {
  const err = new Error(CANT_DECODE_MESSAGE)
  err.status = 422
  err.code = 'LOW_CONFIDENCE_NO_FALLBACK'
  return err
}

function parseJSON(raw) {
  let text = raw.trim()
  text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
  text = text.replace(/^```\s*/, '').replace(/```\s*$/, '').trim()

  try {
    return JSON.parse(text)
  } catch {
    // Usually the payslip text derailed the model (e.g. instructions planted in it)
    throw unreliable()
  }
}
