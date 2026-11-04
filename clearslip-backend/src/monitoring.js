import { config } from './config/index.js'

/**
 * Optional error tracking with Sentry (free tier), on only when SENTRY_DSN is set.
 * Only real server faults (5xx) are reported, tagged with the request ID and path.
 * Request bodies, cookies and user details are removed first, so no payslip data
 * or personal information reaches Sentry.
 *
 * @sentry/node isn't a dependency (most deployments won't need it): install it
 * with `npm install @sentry/node` when you set SENTRY_DSN.
 */
let sentry = null

export async function initMonitoring() {
  if (!config.sentryDsn) return
  try {
    const Sentry = await import('@sentry/node')
    Sentry.init({
      dsn: config.sentryDsn,
      environment: process.env.NODE_ENV || 'development',
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.request) {
          delete event.request.data
          delete event.request.cookies
          delete event.request.query_string
        }
        delete event.user
        return event
      },
    })
    sentry = Sentry
    console.log('  Error tracking  on (Sentry)')
  } catch {
    console.log('  Error tracking  off — SENTRY_DSN is set but @sentry/node is not installed (npm install @sentry/node)')
  }
}

export function reportError(err, req) {
  sentry?.captureException(err, { tags: { requestId: req?.id, path: req?.path } })
}
