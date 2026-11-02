import { config } from '../config/index.js'
import { FALLBACK_SYSTEM_PROMPT } from '../prompts/fallbackPrompt.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

/**
 * Free-tier LLM fallback for payslip text the rule-based engine
 * couldn't confidently parse. Uses Groq (OpenAI-compatible, generous
 * free tier, no cost) instead of the Claude API.
 *
 * Requires GROQ_API_KEY in .env — get one free at https://console.groq.com
 * If it's not configured, this throws a clear error rather than
 * silently failing, so the caller can decide how to handle it.
 */
export async function decodeWithFallback(rawText) {
  if (!config.groqApiKey) {
    // Shown to end users, so no setup details here — server.js logs at
    // startup that GROQ_API_KEY is missing
    const err = new Error(
      'We couldn\'t find enough payslip lines in this to decode it. Paste the earnings and deductions lines from your payslip (for example "Basic 25,000, HRA 10,000, PF 3,000"), or upload a clear photo of it.'
    )
    err.status = 422
    err.code = 'LOW_CONFIDENCE_NO_FALLBACK'
    throw err
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model: config.groqModel,
      temperature: 0.2,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: FALLBACK_SYSTEM_PROMPT },
        { role: 'user', content: `Here is the extracted payslip text:\n\n${rawText}` },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const err = new Error(`Fallback AI request failed (${response.status}): ${body.slice(0, 200)}`)
    err.status = 502
    err.code = 'FALLBACK_LLM_ERROR'
    throw err
  }

  const data = await response.json()
  const rawContent = data?.choices?.[0]?.message?.content

  if (!rawContent) {
    const err = new Error('Empty response from fallback AI')
    err.status = 502
    err.code = 'FALLBACK_LLM_EMPTY'
    throw err
  }

  return parseJSON(rawContent)
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
