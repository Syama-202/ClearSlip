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
    POST /api/checklist
  `)
})

export default app
