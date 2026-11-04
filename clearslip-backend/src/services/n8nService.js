import { config } from '../config/index.js'

export async function forwardToN8n(payload) {
  if (!config.n8nWebhookUrl) {
    throw Object.assign(
      new Error('Checklist email is not configured on this server (set N8N_WEBHOOK_URL in .env).'),
      { status: 503, code: 'N8N_NOT_CONFIGURED' }
    )
  }

  const headers = { 'Content-Type': 'application/json' }
  if (config.n8nSecret) headers['X-Webhook-Secret'] = config.n8nSecret

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(config.n8nWebhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload,
        source: 'clearslip-backend',
        sentAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw Object.assign(
        new Error('The checklist email could not be sent. Please try again later.'),
        { status: 502, code: 'N8N_ERROR', detail: `n8n ${response.status}: ${body.slice(0, 300)}` }
      )
    }

    return { success: true }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw Object.assign(
        new Error('Checklist delivery timed out. Please try again.'),
        { status: 504, code: 'N8N_TIMEOUT' }
      )
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
