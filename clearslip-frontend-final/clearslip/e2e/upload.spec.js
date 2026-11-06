import { test, expect } from '@playwright/test'

// Uploads, read on the device: in-browser OCR (tesseract.js) and pdf.js, running
// under the site's Content-Security-Policy with their files served by ClearSlip
// itself. The test fails on any CSP violation or any request to another host.

const SAMPLE = [
  'Basic Salary 37,500 | Employee PF 4,500',
  'House Rent Allowance 15,000 | Professional Tax 200',
  'Special Allowance 18,900 | TDS 3,000',
  'Conveyance Allowance 1,600',
  'Leave Travel Allowance 2,000',
  'Gross Salary 75,000 | Total Deductions 7,700',
  'Net Pay 67,300',
]
const payslipHtml = `<html><body style="margin:40px;font:28px/1.6 Arial,sans-serif;color:#000;background:#fff">
  <h1 style="font-size:34px">Payslip — October 2026</h1>${SAMPLE.map(l => `<div>${l}</div>`).join('')}</body></html>`

// A photo-like PNG and a real text PDF of the sample payslip, made in the browser
async function makeFiles(browser) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 650 } })
  await page.setContent(payslipHtml)
  const png = await page.screenshot({ type: 'png' })
  const pdf = await page.pdf({ format: 'A4' })
  await page.close()
  return { png, pdf }
}

// Every CSP violation, and every request that leaves ClearSlip's site and API
function watch(page) {
  const allowed = [new URL(test.info().project.use.baseURL).origin, 'http://localhost:4300']
  const offsite = []
  const violations = []
  const ocrFiles = []
  page.on('request', r => {
    const url = new URL(r.url())
    if (url.pathname.startsWith('/tesseract/')) ocrFiles.push(url.pathname)
    if (!['data:', 'blob:'].includes(url.protocol) && !allowed.includes(url.origin)) offsite.push(r.url())
  })
  page.on('console', m => { if (/Content.Security.Policy/i.test(m.text())) violations.push(m.text()) })
  return { offsite, violations, ocrFiles }
}

let files
test.beforeAll(async ({ browser }) => { files = await makeFiles(browser) })

for (const kind of ['png', 'pdf']) {
  test(`reads a ${kind === 'png' ? 'photo (OCR)' : 'PDF'} on the device, under the CSP, contacting no other site`, async ({ page }) => {
    const seen = watch(page)
    await page.goto('/')
    await page.getByRole('tab', { name: 'Upload' }).click()
    await page.locator('input[type="file"]').setInputFiles({
      name: `payslip.${kind}`,
      mimeType: kind === 'png' ? 'image/png' : 'application/pdf',
      buffer: files[kind],
    })
    await page.getByRole('button', { name: 'Decode my payslip' }).click()

    await expect(page.getByRole('heading', { name: 'Your payslip, decoded' })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('₹67,300').first()).toBeVisible()
    await expect(page.getByText('Read from: ').first()).toBeVisible()
    expect(seen.violations).toEqual([])
    expect(seen.offsite).toEqual([])
    // Proof the OCR files really came from ClearSlip (and that worker requests are seen)
    if (kind === 'png') {
      expect(seen.ocrFiles).toEqual(expect.arrayContaining(['/tesseract/worker.min.js', '/tesseract/eng.traineddata.gz']))
      expect(seen.ocrFiles.some(f => /tesseract-core-(simd-)?lstm\.wasm\.js$/.test(f))).toBe(true)
    }
  })
}

test('the built page carries the Content-Security-Policy, naming the API', async ({ page }) => {
  await page.goto('/')
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(policy).toContain("default-src 'self'")
  expect(policy).toContain("connect-src 'self' http://localhost:4300")
  // 'wasm-unsafe-eval' (for OCR's engine) is allowed; plain eval and inline scripts aren't
  expect(policy).not.toMatch(/'unsafe-inline'|'unsafe-eval'/)

  // …and the browser enforces it. An injected inline <script> (the classic XSS) doesn't
  // run, and nothing can send data to another site. (eval can't be tested from here:
  // Playwright's evaluate runs through DevTools, which Chrome exempts from that rule.)
  await page.addScriptTag({ content: 'window.__injected = true' }).catch(() => {})
  const attempts = await page.evaluate(async () => ({
    inlineScript: window.__injected ? 'ran' : 'blocked',
    fetch: await fetch('https://example.com/collect').then(() => 'sent', () => 'blocked'),
  }))
  expect(attempts).toEqual({ inlineScript: 'blocked', fetch: 'blocked' })
})
