import express from 'express'
import helmet from 'helmet'
import { config } from './config/index.js'
import { corsMiddleware } from './middleware/cors.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { requestLog } from './middleware/requestLog.js'
import decodeRouter from './routes/decode.js'
import checklistRouter from './routes/checklist.js'
import askRouter from './routes/ask.js'
import taxRouter from './routes/tax.js'
import healthRouter from './routes/health.js'

const app = express()

// Hosts like Render/Railway sit behind one proxy; trust it so req.ip is
// the real client and rate limits apply per user, not to everyone at once
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

// ── Logging, security & parsing ─────────────────────────────────
// First, so even requests refused below (CORS, body too large) get an ID and a log line
app.use(requestLog)
app.use(helmet())
app.use(corsMiddleware)
// Only decoding takes large bodies (a base64 image when it can't be read in the
// browser). Everything else is small JSON, so a big body is refused straight
// away instead of being parsed. The decode parser runs first; the general one
// then skips bodies already parsed.
app.use('/api/decode', express.json({ limit: '10mb' }))
app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true, limit: '100kb' }))

// ── Routes ──────────────────────────────────────────────────────
// Opening the API's address in a browser lands here — point people to the site
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'ClearSlip API',
    status: 'ok',
    message: `This is the ClearSlip backend. Open the website at ${config.frontendUrl}`,
    endpoints: ['GET /api/health', 'POST /api/decode', 'POST /api/decode/recalculate', 'POST /api/ask', 'POST /api/tax/simulate', 'POST /api/checklist'],
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
