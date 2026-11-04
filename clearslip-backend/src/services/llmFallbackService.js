import { config } from '../config/index.js'
import { FALLBACK_SYSTEM_PROMPT } from '../prompts/fallbackPrompt.js'
import { groqChat, GROQ_UNAVAILABLE_CODES } from './groqClient.js'

// Shown to end users, so no setup details here — server.js logs at
// startup that GROQ_API_KEY is missing
const CANT_DECODE_MESSAGE =
  "We couldn't find enough payslip lines in this to decode it. Paste the earnings and deductions lines from your payslip (for example \"Basic 25,000, HRA 10,000, PF 3,000\"), or upload a clear photo of it."

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

  let message
  try {
    message = await groqChat({
      temperature: 0.2,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: FALLBACK_SYSTEM_PROMPT },
        { role: 'user', content: `Here is the extracted payslip text:\n\n${rawText}` },
      ],
    })
  } catch (err) {
    if (GROQ_UNAVAILABLE_CODES.includes(err.code) && err.code !== 'GROQ_RATE_LIMITED') throw cantDecode()
    throw err
  }

  if (!message.content) {
    const err = new Error('Empty response from fallback AI')
    err.status = 502
    err.code = 'FALLBACK_LLM_EMPTY'
    throw err
  }

  return parseJSON(message.content)
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
    const parsed = JSON.parse(text)
    if (!parsed.summary || !parsed.breakdown || !parsed.actionItems) {
      throw new Error('Incomplete response structure')
    }
    return parsed
  } catch {
    throw Object.assign(
      new Error('Fallback AI returned malformed JSON. Please try again.'),
      { status: 502, code: 'PARSE_ERROR' }
    )
  }
}
