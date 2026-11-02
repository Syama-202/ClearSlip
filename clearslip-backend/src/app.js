import express from 'express'
import helmet from 'helmet'
import { corsMiddleware } from './middleware/cors.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import decodeRouter from './routes/decode.js'
import checklistRouter from './routes/checklist.js'
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
app.use('/api/health', healthRouter)
app.use('/api/decode', decodeRouter)
app.use('/api/checklist', checklistRouter)

// ── 404 & error handler ─────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

export default app
