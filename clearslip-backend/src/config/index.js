import 'dotenv/config'
import crypto from 'crypto'

export const config = {
  port: parseInt(process.env.PORT || '4000'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  // Optional — without it, low-confidence payslips return a clear 422 instead of using the LLM fallback
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  // gpt-oss models only: how much they think before answering (low | medium | high)
  groqReasoningEffort: process.env.GROQ_REASONING_EFFORT || 'medium',
  // Longest a Groq call may take, streaming included, before the answer falls back to sources
  groqTimeoutMs: Number(process.env.GROQ_TIMEOUT_MS) || 30000,
  // Tried once when the main model is rate-limited or retired; each Groq model has its own
  // free-tier limit. Set GROQ_FALLBACK_MODEL= (empty) to turn this off. Off in tests,
  // so a mocked rate limit isn't retried against the real API.
  groqFallbackModel: process.env.GROQ_FALLBACK_MODEL ?? (process.env.NODE_ENV === 'test' ? '' : 'openai/gpt-oss-20b'),
  // Dense (embedding) retrieval for Ask ClearSlip. Off in tests so they
  // never download the model; RAG_DENSE=off falls back to BM25 only.
  ragDense: process.env.RAG_DENSE ? process.env.RAG_DENSE !== 'off' : process.env.NODE_ENV !== 'test',
  // Server-side OCR pool (the fallback when a file can't be read in the browser):
  // workers kept ready, and how long the pool stays up without work
  ocrWorkers: Math.max(1, parseInt(process.env.OCR_WORKERS || '2')),
  ocrIdleMs: process.env.NODE_ENV === 'test' ? 100 : 5 * 60 * 1000,
  // Answers to general questions (no payslip, no chat history) are cached this long;
  // off in tests, which ask the same question with different mocked answers
  askCacheTtlMs: process.env.NODE_ENV === 'test' ? 0 : parseInt(process.env.ASK_CACHE_TTL_MS || String(6 * 60 * 60 * 1000)),
  // Optional error tracking (see src/monitoring.js)
  sentryDsn: process.env.SENTRY_DSN || '',
  // Optional — without it, POST /api/checklist returns a clear 503
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || '',
  n8nSecret: process.env.N8N_SECRET || '',
  // Signs decode results so only ClearSlip's own checklists can be emailed. Without
  // it a random key is made at start-up (checklists then need a fresh decode after a restart)
  signingSecret: process.env.SIGNING_SECRET || crypto.randomBytes(32).toString('hex'),
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX || '20'),
  },
}
