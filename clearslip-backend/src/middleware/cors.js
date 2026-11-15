import cors from 'cors'
import { config } from '../config/index.js'

// The site's own address. Outside production, Vite's dev and preview servers too:
// in production they would let any program on a visitor's own machine call the API
// as if it were the site.
const LOCAL_DEV = ['http://localhost:5173', 'http://localhost:4173']
export const allowedOrigins = (env = process.env.NODE_ENV) =>
  [config.frontendUrl, ...(env === 'production' ? [] : LOCAL_DEV)]
const allowed = allowedOrigins()

export const corsMiddleware = cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})
