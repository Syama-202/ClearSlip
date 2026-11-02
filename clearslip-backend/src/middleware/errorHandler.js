export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal server error'

  if (process.env.NODE_ENV !== 'test') console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} — ${status}: ${message}`)

  res.status(status).json({
    success: false,
    error: message,
    code: err.code || 'SERVER_ERROR',
  })
}

export function notFound(req, res) {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` })
}
