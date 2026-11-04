import { config } from './src/config/index.js'
import app from './src/app.js'
import { getKnowledgeBase } from './src/rag/knowledgeBase.js'
import { shutdownOcr } from './src/services/ocrService.js'
import { initMonitoring, reportError } from './src/monitoring.js'

await initMonitoring()

// The app lives in src/app.js so tests can import it without starting a server
const server = app.listen(config.port, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   ClearSlip Backend  •  v1.0.0       ║
  ║   http://localhost:${config.port}              ║
  ╚══════════════════════════════════════╝
  Routes:
    GET  /api/health
    POST /api/decode, /api/decode/recalculate
    POST /api/ask, /api/ask/stream
    POST /api/tax/simulate
    POST /api/checklist
  Optional features:
    LLM fallback     ${config.groqApiKey ? `on (${config.groqModel}${config.groqFallbackModel ? `, backup ${config.groqFallbackModel}` : ''})` : 'off — set GROQ_API_KEY (free at console.groq.com)'}
    Checklist email  ${config.n8nWebhookUrl ? 'on' : 'off — set N8N_WEBHOOK_URL'}
  `)

  // Load the embedding model (a ~35 MB download on a fresh deploy) and the passage
  // vectors now, in the background, so the first visitor's question doesn't wait for it
  if (config.ragDense) {
    const started = Date.now()
    getKnowledgeBase().retrieve('warm up', { k: 1 })
      .then(() => console.log(`  Search model ready in ${Date.now() - started} ms`))
      .catch(err => console.log(`  Search model not loaded (${err.message}); questions use keyword search until it is`))
  }
})

// Hosts stop the old instance with SIGTERM on every deploy: finish the requests in
// flight, stop the OCR workers, then exit — instead of cutting answers off mid-way
let stopping = false
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (stopping) return
    stopping = true
    console.log(`  ${signal}: finishing requests, then stopping`)
    setTimeout(() => process.exit(1), 10000).unref() // don't wait for ever on a stuck request
    server.close(() => shutdownOcr().finally(() => process.exit(0)))
  })
}

// A bug that escapes every handler: record it, and for a thrown exception exit so
// the host restarts a clean process (continuing after one is unsafe)
process.on('unhandledRejection', err => {
  console.error('Unhandled promise rejection:', err)
  reportError(err)
})
process.on('uncaughtException', err => {
  console.error('Uncaught exception, restarting:', err)
  reportError(err)
  setTimeout(() => process.exit(1), 500)
})

export default app
