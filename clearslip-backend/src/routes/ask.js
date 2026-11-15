import { Router } from 'express'
import { handleAsk, handleAskStream, handleAskFeedback } from '../controllers/askController.js'
import { askRateLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// POST /api/ask
router.post('/', askRateLimiter, handleAsk)

// POST /api/ask/stream — the same answer, streamed as Server-Sent Events
router.post('/stream', askRateLimiter, handleAskStream)

// POST /api/ask/feedback — thumbs up or down on an answer (no question text)
router.post('/feedback', askRateLimiter, handleAskFeedback)

export default router
