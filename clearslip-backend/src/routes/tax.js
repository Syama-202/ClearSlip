import { Router } from 'express'
import { handleSimulate } from '../controllers/taxController.js'
import { simulateRateLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// POST /api/tax/simulate
router.post('/simulate', simulateRateLimiter, handleSimulate)

export default router
