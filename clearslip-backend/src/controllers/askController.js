import { answerQuestion } from '../services/askService.js'
import { validate, askRequestSchema, askFeedbackSchema } from '../utils/validateInput.js'
import { containsAadhaar } from '../utils/aadhaar.js'
import { createDailyQuota } from '../utils/dailyQuota.js'
import { isLocal } from '../middleware/rateLimiter.js'
import { config } from '../config/index.js'

// Full AI answers per visitor per day; past it, answers are sources only. Cached
// answers cost no AI call, so they don't count. This machine (development) isn't limited.
const aiQuota = createDailyQuota(config.askDailyAiLimit)
const aiAllowed = req => isLocal(req) || aiQuota.allows(req.ip)
const countAnswer = (req, data) => {
  if (data.mode === 'rag' && !data.cached && !isLocal(req)) aiQuota.count(req.ip)
}

const SENSITIVE = {
  success: false,
  error: 'Please do not share Aadhaar or PAN numbers in your question.',
  code: 'SENSITIVE_DATA',
}

// Same guard as decoding: identifiers don't belong in a question
const hasIdentifier = question => containsAadhaar(question) || /\b[A-Z]{5}\d{4}[A-Z]\b/i.test(question)

/**
 * Aborts when the visitor goes away before the answer is sent (closed the page,
 * pressed Stop), so the AI call stops too: abandoned answers would otherwise use
 * up the free tier's tokens per minute, which every visitor shares.
 */
function cancelOnDisconnect(res) {
  const controller = new AbortController()
  res.on('close', () => { if (!res.writableEnded) controller.abort() })
  return controller.signal
}

export async function handleAsk(req, res, next) {
  try {
    const { question, payslip, history } = validate(askRequestSchema, req.body)
    if (hasIdentifier(question)) return res.status(400).json(SENSITIVE)

    const data = await answerQuestion({ question, payslip, history, signal: cancelOnDisconnect(res), aiAllowed: aiAllowed(req) })
    countAnswer(req, data)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    if (err.code === 'CLIENT_GONE') return // nobody is waiting for the reply
    next(err)
  }
}

/**
 * POST /api/ask/stream — the same answer as Server-Sent Events:
 *   event: text   { text }   a piece of the answer as it is written
 *   event: reset  {}         discard the text so far (the model turned to a calculator)
 *   event: done   { data }   the final, checked answer, as /api/ask returns it
 *   event: error  { error, code }
 * Validation errors are ordinary JSON responses, before the stream starts.
 */
export async function handleAskStream(req, res, next) {
  let question, payslip, history
  try {
    ({ question, payslip, history } = validate(askRequestSchema, req.body))
  } catch (err) {
    return next(err)
  }
  if (hasIdentifier(question)) return res.status(400).json(SENSITIVE)

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop proxies holding the stream back
  })
  const send = (event, payload) => res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
  const signal = cancelOnDisconnect(res)

  try {
    const data = await answerQuestion({
      question, payslip, history, signal, aiAllowed: aiAllowed(req),
      stream: { onText: text => send('text', { text }), onReset: () => send('reset', {}) },
    })
    countAnswer(req, data)
    send('done', { data })
  } catch (err) {
    if (err.code === 'CLIENT_GONE') return res.end()
    console.error(`[${new Date().toISOString()}] POST /api/ask/stream — ${err.detail || err.message}`)
    send('error', { error: err.code ? err.message : 'Something went wrong on our side. Please try again.', code: err.code || 'SERVER_ERROR' })
  }
  res.end()
}

/**
 * POST /api/ask/feedback — "was this answer helpful?". Recorded as one log line:
 * the rating, the kind of answer, the knowledge-base passages it cited and whether
 * a check had flagged it. Never the question, the answer or anything from a payslip,
 * so the log shows which topics answer badly without holding anyone's data.
 */
export function handleAskFeedback(req, res, next) {
  try {
    const { helpful, mode, sources = [], flagged = false } = validate(askFeedbackSchema, req.body)
    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify({ t: new Date().toISOString(), id: req.id, event: 'ask-feedback', helpful, mode, flagged, sources }))
    }
    return res.status(200).json({ success: true, data: { recorded: true } })
  } catch (err) {
    next(err)
  }
}
