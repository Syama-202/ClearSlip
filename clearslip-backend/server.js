import { config } from './src/config/index.js'
import app from './src/app.js'

// The app lives in src/app.js so tests can import it without starting a server
app.listen(config.port, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   ClearSlip Backend  •  v1.0.0       ║
  ║   http://localhost:${config.port}              ║
  ╚══════════════════════════════════════╝
  Routes:
    GET  /api/health
    POST /api/decode
    POST /api/ask
    POST /api/checklist
  Optional features:
    LLM fallback     ${config.groqApiKey ? 'on' : 'off — set GROQ_API_KEY (free at console.groq.com)'}
    Checklist email  ${config.n8nWebhookUrl ? 'on' : 'off — set N8N_WEBHOOK_URL'}
  `)
})

export default app
