import { reportError } from '../monitoring.js'

export function errorHandler(err, req, res, next) {
  // A disallowed origin is a refusal, not a server fault
  const status = err.message?.startsWith('CORS:') ? 403 : err.status || err.statusCode || 500
  // Errors we raised on purpose carry a code and a message written for users;
  // anything else (a bug, a library failure) gets a generic message
  const message = err.code || status < 500 ? err.message || 'Request failed' : 'Something went wrong on our side. Please try again.'

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[${new Date().toISOString()}] ${req.id ?? '-'} ${req.method} ${req.path} — ${status}: ${err.detail || err.message}`)
  }
  // Server faults only: a 4xx is the request's problem, not a bug to track
  if (status >= 500) reportError(err, req)

  res.status(status).json({
    success: false,
    error: message,
    code: err.code || (status === 403 ? 'FORBIDDEN' : status < 500 ? 'BAD_REQUEST' : 'SERVER_ERROR'),
    // Quote this when reporting a problem; it matches one line in the server log
    requestId: req.id,
  })
}

export function notFound(req, res) {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` })
}
