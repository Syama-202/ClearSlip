import { Router } from 'express'
import { handleAsk } from '../controllers/askController.js'
import { askRateLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// POST /api/ask
router.post('/', askRateLimiter, handleAsk)

export default router
