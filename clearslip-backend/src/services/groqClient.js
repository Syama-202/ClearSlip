import { config } from '../config/index.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

/**
 * One chat-completion call to Groq (OpenAI-compatible API). Returns the
 * first choice's message. Throws an error with `status`/`code` the error
 * handler understands; a model that produced a malformed tool call gets
 * code GROQ_TOOL_USE_FAILED so callers can retry without tools.
 */
export async function groqChat(body) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({ model: config.groqModel, ...body }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const err = new Error(`AI request failed (${response.status}): ${text.slice(0, 200)}`)
    err.status = 502
    err.code = text.includes('tool_use_failed') ? 'GROQ_TOOL_USE_FAILED' : 'GROQ_ERROR'
    throw err
  }

  const data = await response.json()
  const message = data?.choices?.[0]?.message
  if (!message) {
    const err = new Error('Empty response from AI')
    err.status = 502
    err.code = 'GROQ_EMPTY'
    throw err
  }
  return message
}
