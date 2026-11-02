import { Router } from 'express'
import { handleDecode } from '../controllers/decodeController.js'
import { decodeRateLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// POST /api/decode
router.post('/', decodeRateLimiter, handleDecode)

export default router
