import { Router } from 'express'
import { config } from '../config/index.js'

const router = Router()
const startedAt = new Date().toISOString()

// GET /api/health
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'clearslip-backend',
    version: '1.0.0',
    startedAt,
    uptime: `${Math.floor(process.uptime())}s`,
    environment: process.env.NODE_ENV || 'development',
    // Lets the frontend hide or explain features this server can't provide
    features: {
      llmFallback: Boolean(config.groqApiKey),
      checklistEmail: Boolean(config.n8nWebhookUrl),
    },
  })
})

export default router
