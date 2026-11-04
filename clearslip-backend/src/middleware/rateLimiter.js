import rateLimit from 'express-rate-limit'
import { config } from '../config/index.js'

// Requests from this machine (local development, tests) are not limited. Node
// reports IPv4 localhost as ::ffff:127.0.0.1 when listening on IPv6. Behind a
// host's proxy in production, req.ip is the real client, so this never matches.
const LOCAL_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
const isLocal = req => LOCAL_IPS.includes(req.ip)

export const decodeRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please wait a few minutes before trying again.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  skip: isLocal,
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
  skip: isLocal,
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
  skip: isLocal,
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
  skip: isLocal,
})
