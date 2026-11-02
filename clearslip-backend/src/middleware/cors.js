import cors from 'cors'
import { config } from '../config/index.js'

const allowed = [config.frontendUrl, 'http://localhost:5173', 'http://localhost:4173']

export const corsMiddleware = cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})
