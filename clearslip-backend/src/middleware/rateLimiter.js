import rateLimit from 'express-rate-limit'
import { config } from '../config/index.js'

export const decodeRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please wait a few minutes before trying again.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1',
})

// Same allowance as decoding, counted separately
export const askRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many questions. Please wait a few minutes before asking again.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1',
})

// Sliders send a request every time they settle, so this allows far more than
// decoding does — the calculation is cheap and uses no AI
export const simulateRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many changes at once. Please wait a moment.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1',
})

export const checklistRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Checklist email limit reached. You can send up to 5 per hour.',
    code: 'CHECKLIST_RATE_LIMIT',
  },
})
