import express from 'express'
import helmet from 'helmet'
import { config } from './config/index.js'
import { corsMiddleware } from './middleware/cors.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import decodeRouter from './routes/decode.js'
import checklistRouter from './routes/checklist.js'
import askRouter from './routes/ask.js'
import taxRouter from './routes/tax.js'
import healthRouter from './routes/health.js'

const app = express()

// Hosts like Render/Railway sit behind one proxy; trust it so req.ip is
// the real client and rate limits apply per user, not to everyone at once
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

// ── Security & parsing ──────────────────────────────────────────
app.use(helmet())
app.use(corsMiddleware)
app.use(express.json({ limit: '10mb' }))   // 10mb for base64 payslip images
app.use(express.urlencoded({ extended: true }))

// Log every incoming request in dev
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  app.use((req, _res, next) => {
    console.log(`→ ${req.method} ${req.path}`)
    next()
  })
}

// ── Routes ──────────────────────────────────────────────────────
// Opening the API's address in a browser lands here — point people to the site
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'ClearSlip API',
    status: 'ok',
    message: `This is the ClearSlip backend. Open the website at ${config.frontendUrl}`,
    endpoints: ['GET /api/health', 'POST /api/decode', 'POST /api/ask', 'POST /api/tax/simulate', 'POST /api/checklist'],
  })
})
app.use('/api/health', healthRouter)
app.use('/api/decode', decodeRouter)
app.use('/api/checklist', checklistRouter)
app.use('/api/ask', askRouter)
app.use('/api/tax', taxRouter)

// ── 404 & error handler ─────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

export default app
