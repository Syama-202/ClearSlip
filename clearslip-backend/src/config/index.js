import 'dotenv/config'

export const config = {
  port: parseInt(process.env.PORT || '4000'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  // Optional — without it, low-confidence payslips return a clear 422 instead of using the LLM fallback
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  // gpt-oss models only: how much they think before answering (low | medium | high)
  groqReasoningEffort: process.env.GROQ_REASONING_EFFORT || 'medium',
  // Dense (embedding) retrieval for Ask ClearSlip. Off in tests so they
  // never download the model; RAG_DENSE=off falls back to BM25 only.
  ragDense: process.env.RAG_DENSE ? process.env.RAG_DENSE !== 'off' : process.env.NODE_ENV !== 'test',
  // Optional — without it, POST /api/checklist returns a clear 503
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || '',
  n8nSecret: process.env.N8N_SECRET || '',
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX || '20'),
  },
}
