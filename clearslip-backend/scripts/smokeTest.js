// Checks a deployed ClearSlip from the outside, the way a visitor's browser sees it:
//   npm run smoke -- https://clearslip-backend.onrender.com https://clearslip-frontend.onrender.com
// The frontend URL is optional; without it the site and CORS checks are skipped.
// It never calls the AI: the Ask check uses an off-topic question, which is
// answered without Groq. About five requests, well inside the rate limit.
// Exits 1 if any check fails, so it can run after a deploy.

const [apiArg, siteArg] = process.argv.slice(2)
if (!apiArg) {
  console.error('Usage: npm run smoke -- <backend URL> [frontend URL]')
  process.exit(1)
}
const API = apiArg.replace(/\/+$/, '')
const SITE = siteArg?.replace(/\/+$/, '')

// A free Render service sleeps when idle and takes up to a minute to wake
const WAKE_TIMEOUT_MS = 90000
const TIMEOUT_MS = 20000

// The app's sample payslip: ₹75,000 gross, ₹67,300 take-home
const SAMPLE = `Basic Salary 37,500 | Employee PF 4,500
House Rent Allowance 15,000 | Professional Tax 200
Special Allowance 18,900 | TDS 3,000
Conveyance Allowance 1,600
Leave Travel Allowance 2,000
Gross Salary 75,000 | Total Deductions 7,700
Net Pay 67,300`

const results = []

async function check(name, fn) {
  const started = Date.now()
  try {
    const note = await fn()
    results.push({ name, ok: true })
    console.log(`  ✓ ${name}${note ? ` — ${note}` : ''} (${Date.now() - started} ms)`)
  } catch (err) {
    results.push({ name, ok: false })
    console.log(`  ✗ ${name} — ${err.message}`)
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message)
}

async function request(url, { timeout = TIMEOUT_MS, ...options } = {}) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(timeout) })
  } catch (err) {
    throw new Error(err.name === 'TimeoutError' ? `no reply within ${timeout / 1000} s` : err.cause?.message ?? err.message)
  }
}

function postJson(path, body, headers = {}) {
  return request(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(SITE && { Origin: SITE }), ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function jsonData(res) {
  const body = await res.json().catch(() => null)
  expect(res.ok, `HTTP ${res.status}${body?.error ? `: ${body.error}` : ''}`)
  expect(body?.success === true, 'response is not { success: true }')
  return body.data
}

console.log(`\nClearSlip smoke test\n  API:  ${API}${SITE ? `\n  Site: ${SITE}` : ''}\n`)

// ── Backend ─────────────────────────────────────────────────────
let health
await check('API is up (GET /api/health)', async () => {
  const res = await request(`${API}/api/health`, { timeout: WAKE_TIMEOUT_MS })
  expect(res.status === 200, `HTTP ${res.status}`)
  health = await res.json()
  expect(health.status === 'ok', `status is ${health.status}`)
  expect(health.environment === 'production', `NODE_ENV is "${health.environment}", not production`)
  const on = Object.entries(health.features ?? {}).filter(([, v]) => v).map(([k]) => k)
  return `features on: ${on.length ? on.join(', ') : 'none (no Groq key or n8n)'}`
})
if (!results[0].ok) {
  console.log('\nThe API is not healthy, so the other checks were skipped. Is the URL right, and did the deploy finish?\n')
  process.exit(1)
}

await check('Security headers on API responses', async () => {
  const res = await request(`${API}/api/health`)
  const h = res.headers
  expect(h.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options missing')
  expect(h.get('strict-transport-security'), 'Strict-Transport-Security missing')
  expect(!h.get('x-powered-by'), 'X-Powered-By is exposed')
  expect(h.get('x-request-id'), 'X-Request-Id missing')
})

await check('Decodes the sample payslip (POST /api/decode)', async () => {
  const data = await jsonData(await postJson('/api/decode', { messages: [{ type: 'text', text: SAMPLE, origin: 'typed' }] }))
  expect(data.engine === 'rules', `read by "${data.engine}", expected the rules engine`)
  expect(data.summary?.takeHome === 67300, `take-home is ${data.summary?.takeHome}, expected 67300`)
  expect(data.checklistToken, 'no checklist token (is SIGNING_SECRET set?)')
  return 'take-home ₹67,300'
})

await check('Tax calculator (POST /api/tax/simulate)', async () => {
  const data = await jsonData(await postJson('/api/tax/simulate', { grossAnnual: 1300000 }))
  expect(data.newRegime?.totalTax === 26000, `new-regime tax on ₹13 lakh is ${data.newRegime?.totalTax}, expected 26000`)
  return 'new regime on ₹13 lakh = ₹26,000'
})

await check('Ask ClearSlip refuses off-topic questions (POST /api/ask)', async () => {
  const data = await jsonData(await postJson('/api/ask', { question: 'Who won the football world cup in 2018?' }))
  expect(['no-sources', 'clarify'].includes(data.mode), `mode is "${data.mode}"`)
  expect(data.sources?.length === 0, 'returned sources for an off-topic question')
  return `mode "${data.mode}", no AI call`
})

await check('Large bodies are refused (413)', async () => {
  const res = await postJson('/api/ask', { question: 'x'.repeat(200 * 1024) })
  expect(res.status === 413, `HTTP ${res.status}, expected 413`)
})

await check('Unknown paths answer with JSON 404', async () => {
  const res = await request(`${API}/api/does-not-exist`)
  expect(res.status === 404, `HTTP ${res.status}`)
  expect(res.headers.get('content-type')?.includes('application/json'), 'not JSON')
})

// ── CORS (needs the site's URL) ─────────────────────────────────
if (SITE) {
  await check('CORS allows the site', async () => {
    const res = await request(`${API}/api/ask`, {
      method: 'OPTIONS',
      headers: { Origin: SITE, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    })
    const allowed = res.headers.get('access-control-allow-origin')
    expect(allowed === SITE, `Access-Control-Allow-Origin is ${allowed ?? 'missing'} — set FRONTEND_URL=${SITE} on the backend`)
  })

  await check('CORS refuses other sites', async () => {
    const res = await request(`${API}/api/health`, { headers: { Origin: 'https://example.com' } })
    expect(res.status === 403, `HTTP ${res.status}, expected 403`)
    expect(!res.headers.get('access-control-allow-origin'), 'Access-Control-Allow-Origin was sent')
  })
}

// ── Frontend ────────────────────────────────────────────────────
if (SITE) {
  await check('Site loads with security headers', async () => {
    const res = await request(SITE, { timeout: WAKE_TIMEOUT_MS })
    expect(res.status === 200, `HTTP ${res.status}`)
    const html = await res.text()
    expect(html.includes('id="root"'), 'page has no #root, is this the ClearSlip build?')
    expect(res.headers.get('x-frame-options') === 'DENY', 'X-Frame-Options missing (check render.yaml headers)')
    expect(res.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options missing')
  })

  // Vite writes VITE_API_URL into the bundle at build time. If it was missing,
  // the site calls http://localhost:4000 and every request fails in the browser.
  await check('Site was built with this API address (VITE_API_URL)', async () => {
    const html = await (await request(SITE)).text()
    const script = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1]
    expect(script, 'no script tag found')
    const res = await request(new URL(script, SITE))
    expect(res.headers.get('cache-control')?.includes('immutable'), 'built files are not cached (check render.yaml headers)')
    const js = await res.text()
    expect(js.includes(API), `the bundle does not contain ${API} — set VITE_API_URL and redeploy the site`)
  })

  // The policy is written at build time from VITE_API_URL; a wrong one blocks every API call
  await check('Content-Security-Policy allows this API, and only this API', async () => {
    const html = await (await request(SITE)).text()
    const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1]?.replace(/&#39;/g, "'")
    expect(policy, 'no Content-Security-Policy in the page (built with an old vite.config.js?)')
    const connect = policy.match(/connect-src ([^;]+)/)?.[1] ?? ''
    expect(connect.split(/\s+/).includes(new URL(API).origin), `connect-src is "${connect}" — set VITE_API_URL=${API} and rebuild the site`)
  })

  await check('OCR files are served by the site itself', async () => {
    for (const file of ['worker.min.js', 'tesseract-core-simd-lstm.wasm.js', 'eng.traineddata.gz']) {
      const res = await request(new URL(`/tesseract/${file}`, SITE), { method: 'HEAD' })
      expect(res.status === 200, `/tesseract/${file}: HTTP ${res.status}`)
      expect(!res.headers.get('content-type')?.includes('text/html'), `/tesseract/${file} returned the web page, not the file`)
    }
  })
}

const failed = results.filter(r => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed${failed ? '' : ' — deployment looks healthy'}\n`)
// exitCode, not exit(): ending while fetch's sockets are still closing can crash Node on Windows
process.exitCode = failed ? 1 : 0
