import crypto from 'crypto'

/**
 * Every request gets a short ID, sent back as X-Request-Id and in error
 * responses, so a user's "it failed" can be matched to one log line.
 *
 * In production each request is logged as one JSON line — method, path, status,
 * time — and never the body, query string or IP address, which can hold salary
 * figures or identify someone. Hosting dashboards (Render's log view) can search
 * and filter these lines.
 */
export function requestLog(req, res, next) {
  req.id = crypto.randomUUID().slice(0, 8)
  res.setHeader('X-Request-Id', req.id)
  const started = process.hrtime.bigint()

  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return
    const ms = Math.round(Number(process.hrtime.bigint() - started) / 1e6)
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify({ t: new Date().toISOString(), id: req.id, method: req.method, path: req.path, status: res.statusCode, ms }))
    } else {
      console.log(`→ ${req.method} ${req.path} ${res.statusCode} ${ms} ms`)
    }
  })
  next()
}
