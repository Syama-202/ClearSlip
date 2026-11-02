import { Router } from 'express'
import { handleChecklist } from '../controllers/checklistController.js'
import { checklistRateLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// POST /api/checklist
router.post('/', checklistRateLimiter, handleChecklist)

export default router
