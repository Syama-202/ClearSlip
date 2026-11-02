import { Router } from 'express'

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
  })
})

export default router
