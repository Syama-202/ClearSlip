import { Router } from 'express'
import { handleDecode, handleRecalculate } from '../controllers/decodeController.js'
import { decodeRateLimiter, simulateRateLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// POST /api/decode
router.post('/', decodeRateLimiter, handleDecode)

// POST /api/decode/recalculate — no OCR or AI, so the cheaper simulator allowance applies
router.post('/recalculate', simulateRateLimiter, handleRecalculate)

export default router
