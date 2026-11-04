import { config } from '../config/index.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Errors that mean "AI is unavailable right now" rather than "this request is broken" —
// callers degrade (sources-only answers, friendly messages) instead of failing
export const GROQ_UNAVAILABLE_CODES = ['GROQ_RATE_LIMITED', 'GROQ_AUTH', 'GROQ_MODEL_UNAVAILABLE']

/**
 * One chat-completion call to Groq (OpenAI-compatible API). Returns the
 * first choice's message. Throws an error with `status`/`code` the error
 * handler understands; a model that produced a malformed tool call gets
 * code GROQ_TOOL_USE_FAILED so callers can retry without tools.
 */
export async function groqChat(body) {
  const model = config.groqModel
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model,
      // gpt-oss models think before answering. Medium (the default) keeps citations
      // reliable — low often dropped them — at ~2,000 tokens a call, inside the free
      // tier's 8,000 tokens per minute
      ...(model.startsWith('openai/gpt-oss') && { reasoning_effort: config.groqReasoningEffort }),
      ...body,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const err = new Error(`AI request failed (${response.status}): ${text.slice(0, 200)}`)
    err.status = 502
    err.code = groqErrorCode(response.status, text)
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
      console.log(`  groq ${model}: ${response.status} ${err.code} ${text.slice(0, 300)}`)
    }
    if (err.code === 'GROQ_RATE_LIMITED') {
      err.status = 503
      err.message = 'The AI is getting too many questions right now. Please wait a minute and try again.'
    }
    throw err
  }

  const data = await response.json()
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test' && data?.usage) {
    console.log(`  groq ${model}: ${data.usage.prompt_tokens} in + ${data.usage.completion_tokens} out tokens`)
  }
  const message = data?.choices?.[0]?.message
  if (!message) {
    const err = new Error('Empty response from AI')
    err.status = 502
    err.code = 'GROQ_EMPTY'
    throw err
  }
  return message
}

function groqErrorCode(status, text) {
  if (text.includes('tool_use_failed')) return 'GROQ_TOOL_USE_FAILED'
  if (status === 429) return 'GROQ_RATE_LIMITED'
  // Invalid, revoked or expired key
  if (status === 401 || status === 403) return 'GROQ_AUTH'
  if (status === 404 || text.includes('model_not_found') || text.includes('model_decommissioned')) return 'GROQ_MODEL_UNAVAILABLE'
  return 'GROQ_ERROR'
}
