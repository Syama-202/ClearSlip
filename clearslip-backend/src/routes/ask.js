import { Router } from 'express'
import { handleAsk, handleAskStream } from '../controllers/askController.js'
import { askRateLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// POST /api/ask
router.post('/', askRateLimiter, handleAsk)

// POST /api/ask/stream — the same answer, streamed as Server-Sent Events
router.post('/stream', askRateLimiter, handleAskStream)

export default router
