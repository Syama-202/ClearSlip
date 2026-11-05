import { config } from '../config/index.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Errors that mean "AI is unavailable right now" rather than "this request is broken" —
// callers degrade (sources-only answers, friendly messages) instead of failing.
// A Groq outage (5xx), no reply in time and no connection count too.
export const GROQ_UNAVAILABLE_CODES = ['GROQ_RATE_LIMITED', 'GROQ_AUTH', 'GROQ_MODEL_UNAVAILABLE', 'GROQ_SERVER', 'GROQ_TIMEOUT', 'GROQ_NETWORK']

const logging = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'

/**
 * One chat-completion call to Groq (OpenAI-compatible API). Returns the
 * first choice's message. Throws an error with `status`/`code` the error
 * handler understands; a model that produced a malformed tool call gets
 * code GROQ_TOOL_USE_FAILED so callers can retry without tools.
 */
export async function groqChat(body, { signal } = {}) {
  const response = await send(body, { signal })
  const data = await response.json().catch(err => { throw connectionError(err) })
  if (logging && data?.usage) console.log(`  groq ${config.groqModel}: ${data.usage.prompt_tokens} in + ${data.usage.completion_tokens} out tokens`)
  const message = data?.choices?.[0]?.message
  if (!message) throw emptyResponse()
  return message
}

/**
 * The same call, streamed: `onContent(text)` gets each piece of the answer as
 * it is written. Resolves with the assembled message — content plus any tool
 * calls, which arrive in fragments and are pieced together here.
 * `signal` cancels the call (the user closed the page); the time limit covers
 * the whole stream, not just the first byte.
 */
export async function groqChatStream(body, onContent, { signal } = {}) {
  const response = await send({ ...body, stream: true }, { signal })
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  const toolCalls = []

  const handleEvent = data => {
    if (data === '[DONE]') return
    const chunk = JSON.parse(data)
    if (chunk.error) throw groqError(400, JSON.stringify(chunk.error))
    const delta = chunk.choices?.[0]?.delta ?? {}
    if (delta.content) {
      content += delta.content
      onContent(delta.content)
    }
    for (const part of delta.tool_calls ?? []) {
      const call = (toolCalls[part.index ?? 0] ??= { id: '', type: 'function', function: { name: '', arguments: '' } })
      if (part.id) call.id = part.id
      if (part.function?.name) call.function.name += part.function.name
      if (part.function?.arguments) call.function.arguments += part.function.arguments
    }
    const usage = chunk.x_groq?.usage ?? chunk.usage
    if (logging && usage) console.log(`  groq ${config.groqModel} (stream): ${usage.prompt_tokens} in + ${usage.completion_tokens} out tokens`)
  }

  try {
    for await (const bytes of response.body) {
      buffer += decoder.decode(bytes, { stream: true })
      let end
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const event = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        for (const line of event.split('\n')) if (line.startsWith('data:')) handleEvent(line.slice(5).trim())
      }
    }
  } catch (err) {
    throw err.code ? err : connectionError(err)
  }

  if (!content && !toolCalls.length) throw emptyResponse()
  return { role: 'assistant', content: content || null, ...(toolCalls.length && { tool_calls: toolCalls }) }
}

// A rate limit, a retired model or an outage of the main model is worth one try
// on the backup (a timeout isn't: the user has already waited)
const TRY_BACKUP_ON = ['GROQ_RATE_LIMITED', 'GROQ_MODEL_UNAVAILABLE', 'GROQ_SERVER']

async function send(body, { signal, model = config.groqModel } = {}) {
  // Without a time limit a stalled reply would hold the request open indefinitely
  const timeLimit = AbortSignal.timeout(config.groqTimeoutMs)
  const response = await fetch(GROQ_URL, {
    signal: signal ? AbortSignal.any([signal, timeLimit]) : timeLimit,
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
  }).catch(err => { throw connectionError(err) })
  if (!response.ok) {
    const err = groqError(response.status, await response.text().catch(() => ''), model)
    // Each Groq model has its own free-tier limit, so a busy main model often
    // means the backup is free. Tried once; then the caller's fallback applies.
    const backup = config.groqFallbackModel
    if (TRY_BACKUP_ON.includes(err.code) && backup && backup !== model) {
      if (logging) console.log(`  groq: ${model} unavailable (${err.code}), trying ${backup}`)
      return send(body, { signal, model: backup })
    }
    throw err
  }
  return response
}

function groqError(status, text, model = config.groqModel) {
  // Users see a plain message; the provider's details go to the server log only
  const err = new Error('The AI service had a problem answering. Please try again.')
  err.detail = `Groq ${model} ${status}: ${text.slice(0, 300)}`
  err.status = 502
  err.code = groqErrorCode(status, text)
  if (logging) console.log(`  groq ${model}: ${status} ${err.code} ${text.slice(0, 300)}`)
  if (err.code === 'GROQ_RATE_LIMITED') {
    err.status = 503
    err.message = 'The AI is getting too many questions right now. Please wait a minute and try again.'
  }
  return err
}

/**
 * No reply at all: the time limit ran out, the caller cancelled (the user left),
 * or there was no connection. The first and last mean the AI is unavailable.
 */
function connectionError(cause) {
  const reason = cause?.name === 'TimeoutError' ? 'GROQ_TIMEOUT' : cause?.name === 'AbortError' ? 'CLIENT_GONE' : 'GROQ_NETWORK'
  const err = new Error(reason === 'GROQ_TIMEOUT'
    ? 'The AI took too long to answer. Please try again.'
    : 'The AI service could not be reached. Please try again.')
  err.code = reason
  err.status = reason === 'GROQ_TIMEOUT' ? 504 : 502
  err.detail = `Groq ${reason}: ${cause?.message ?? cause}`
  if (logging && reason !== 'CLIENT_GONE') console.log(`  groq: ${reason} ${cause?.message ?? ''}`)
  return err
}

function emptyResponse() {
  const err = new Error('Empty response from AI')
  err.status = 502
  err.code = 'GROQ_EMPTY'
  return err
}

function groqErrorCode(status, text) {
  if (text.includes('tool_use_failed')) return 'GROQ_TOOL_USE_FAILED'
  // JSON mode: the model's output failed Groq's own JSON check (intermittent)
  if (text.includes('json_validate_failed')) return 'GROQ_JSON_FAILED'
  if (status === 429) return 'GROQ_RATE_LIMITED'
  // Invalid, revoked or expired key
  if (status === 401 || status === 403) return 'GROQ_AUTH'
  if (status === 404 || text.includes('model_not_found') || text.includes('model_decommissioned')) return 'GROQ_MODEL_UNAVAILABLE'
  // Groq's own outage (500, 502, 503); a 400 means our request was wrong, which isn't
  if (status >= 500) return 'GROQ_SERVER'
  return 'GROQ_ERROR'
}
