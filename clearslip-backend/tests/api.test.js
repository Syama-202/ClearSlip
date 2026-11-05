import { jest } from '@jest/globals'
import request from 'supertest'

// Pin optional integrations off before the app (and dotenv) load, so a
// local .env with real keys never makes these tests call Groq or n8n.
// dotenv does not override variables that are already set.
process.env.GROQ_API_KEY = ''
process.env.N8N_WEBHOOK_URL = ''

const { default: app } = await import('../src/app.js')
const { config } = await import('../src/config/index.js')
const { shutdownOcr } = await import('../src/services/ocrService.js')

// The OCR test starts the worker pool; stop it so Jest can exit
afterAll(() => shutdownOcr())

const textBody = text => ({ messages: [{ type: 'text', text }] })

// Builds a minimal one-page PDF with a real text layer
function makeTextPdf(lines) {
  const content = `BT /F1 14 Tf 50 750 Td ${lines.map(l => `(${l}) Tj 0 -24 Td`).join(' ')} ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((obj, i) => {
    const offset = pdf.length
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
    return offset
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf).toString('base64')
}

const pdfBody = base64 => ({
  messages: [{ type: 'image', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }],
})

const imageBody = (mediaType, buffer) => ({
  messages: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } }],
})

describe('GET /', () => {
  test('explains this is the API and points to the website', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/Open the website at http/)
  })
})

describe('request IDs', () => {
  test('every response carries one, and error bodies repeat it for support', async () => {
    const ok = await request(app).get('/api/health')
    expect(ok.headers['x-request-id']).toMatch(/^[0-9a-f]{8}$/)

    const bad = await request(app).post('/api/tax/simulate').send({})
    expect(bad.status).toBe(400)
    expect(bad.body.requestId).toBe(bad.headers['x-request-id'])
  })
})

describe('CORS', () => {
  test('refuses a site that is not ClearSlip with 403, not a server error', async () => {
    const res = await request(app).post('/api/tax/simulate').set('Origin', 'https://evil.example').send({ grossAnnual: 900000 })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('FORBIDDEN')
  })
})

describe('GET /api/health', () => {
  test('reports ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })

  test('reports which optional features are configured', async () => {
    const res = await request(app).get('/api/health')
    expect(res.body.features).toEqual({ llmFallback: false, checklistEmail: false })
  })
})

describe('POST /api/decode', () => {
  test('decodes pasted text with the rules engine', async () => {
    const res = await request(app).post('/api/decode').send(textBody('Basic 25000, HRA 12500, PF 3000, TDS 4200'))
    expect(res.status).toBe(200)
    expect(res.body.data.engine).toBe('rules')
    expect(res.body.data.summary.takeHome).toBe(30300)
  })

  test('decodes a PDF with a text layer', async () => {
    const res = await request(app)
      .post('/api/decode')
      .send(pdfBody(makeTextPdf(['Basic Salary 30,000', 'HRA 15,000', 'Provident Fund 3,600', 'Net Pay 41,400'])))
    expect(res.status).toBe(200)
    expect(res.body.data.engine).toBe('rules')
    expect(res.body.data.summary.takeHome).toBe(41400)
  })

  test('asks for a screenshot when a PDF has no text layer', async () => {
    const res = await request(app).post('/api/decode').send(pdfBody(makeTextPdf([])))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('UNREADABLE_PDF')
  })

  test('rejects a file labelled PDF that is not one', async () => {
    const res = await request(app).post('/api/decode').send(pdfBody(Buffer.from('not a pdf'.repeat(20)).toString('base64')))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_FILE')
  })

  test('returns 400, not 500, for a corrupt PDF', async () => {
    const res = await request(app).post('/api/decode').send(pdfBody(Buffer.from('%PDF-1.4\n' + 'garbage '.repeat(30)).toString('base64')))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_PDF')
  })

  test('rejects bytes labelled as an image that are not one', async () => {
    const res = await request(app).post('/api/decode').send(imageBody('image/png', Buffer.from('x'.repeat(200))))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_FILE')
  })

  test('refuses a large body on endpoints other than decode', async () => {
    const res = await request(app).post('/api/tax/simulate').set('Content-Type', 'application/json').send(JSON.stringify({ grossAnnual: 900000, pad: 'x'.repeat(200 * 1024) }))
    expect(res.status).toBe(413)
  })

  // Regression: a damaged image used to crash the whole server (uncaught tesseract worker error)
  test('survives a damaged image with a valid PNG header, and keeps serving', async () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const res = await request(app).post('/api/decode').send(imageBody('image/png', Buffer.concat([pngHeader, Buffer.from('broken'.repeat(40))])))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('OCR_FAILED')

    const next = await request(app).get('/api/health')
    expect(next.status).toBe(200)
  }, 30000)

  test('returns 422 for unreadable text when no fallback is configured', async () => {
    const res = await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('LOW_CONFIDENCE_NO_FALLBACK')
  })

  test('rejects Aadhaar numbers (valid check digit)', async () => {
    const res = await request(app).post('/api/decode').send(textBody('Aadhaar 2345 6789 0124, Basic 30000, HRA 15000'))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('SENSITIVE_DATA')
  })

  test('allows a 12-digit employee ID that is not an Aadhaar number', async () => {
    const res = await request(app).post('/api/decode').send(textBody('Employee ID 202611041235\nBasic 30000\nHRA 15000'))
    expect(res.status).toBe(200)
  })

  test('applies the ₹-misread correction to text the browser read with OCR', async () => {
    const ocrText = 'Basic 47,600\nDA 29,988\nHRA 39,520\nTransport Allowance 31,800\nGross Earnings 390,042\nNPS 7,759\nTotal Deductions 38,469'
    const asTyped = await request(app).post('/api/decode').send(textBody(ocrText))
    const asOcr = await request(app).post('/api/decode').send({ messages: [{ type: 'text', text: ocrText, origin: 'ocr' }] })
    expect(asTyped.body.data.breakdown.some(r => r.corrected)).toBe(false)
    expect(asOcr.body.data.breakdown.some(r => r.corrected)).toBe(true)
  })

  test('does not refuse a payslip read from a file because it prints an Aadhaar number', async () => {
    const res = await request(app).post('/api/decode')
      .send({ messages: [{ type: 'text', text: 'Aadhaar 2345 6789 0124\nBasic 30000\nHRA 15000', origin: 'ocr' }] })
    expect(res.status).toBe(200)
  })

  test('allows a labelled 12-digit UAN', async () => {
    const res = await request(app).post('/api/decode').send(textBody('UAN: 100123456789\nBasic 30000\nHRA 15000'))
    expect(res.status).toBe(200)
  })

  test('rejects a malformed request body', async () => {
    const res = await request(app).post('/api/decode').send({ messages: [] })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  describe('with the LLM fallback configured', () => {
    // Adds up: ₹55,000 earnings − ₹3,000 PF = ₹52,000 take-home
    const llmResult = {
      summary: { takeHome: 52000, ctc: 800000, tds: 0, savingsPotential: 0 },
      breakdown: [
        { component: 'Basic Pay', type: 'earning', monthly: 30000, annual: 360000, explanation: 'Core pay.' },
        { component: 'Special Allowance', type: 'earning', monthly: 25000, annual: 300000, explanation: 'Taxable.' },
        { component: 'EPF', type: 'deduction', monthly: 3000, annual: 36000, explanation: 'Retirement savings.' },
      ],
      actionItems: [
        { priority: 'high', action: 'Ask HR for your salary structure', link: null },
        { priority: 'medium', action: 'Check your tax on the e-filing portal', link: 'https://www.incometax.gov.in/iec/foportal/' },
      ],
      disclaimer: 'Assumed figures',
    }
    const groqReply = result => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }))

    beforeEach(() => {
      config.groqApiKey = 'test-key'
    })

    afterEach(() => {
      config.groqApiKey = ''
      jest.restoreAllMocks()
    })

    test('sends low-confidence text to the fallback and tags the result', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(groqReply(llmResult))

      const res = await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))

      expect(res.status).toBe(200)
      expect(res.body.data.engine).toBe('llm-fallback')
      expect(res.body.data.breakdown).toEqual(llmResult.breakdown)
      // The checklist is ClearSlip's own, built from the figures the AI read
      expect(res.body.data.actionItems.map(a => a.action)).toContain('Cross-check these numbers against your official Form 16 once it is issued at year-end.')
      expect(res.body.data.checklistToken).toMatch(/^[a-f0-9]{64}$/)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const sent = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(sent.messages[1].content).toContain('take-home is only 52k')
      expect(sent.response_format).toEqual({ type: 'json_object' })
    })

    test('removes names, PAN and account numbers before the text reaches the AI', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(groqReply(llmResult))
      const text = 'Employee Name: Ravi Kumar\nPAN: ABCDE1234F\nBank A/c No: 50100234567812\nMy CTC is 8L but take-home is only 52k'

      await request(app).post('/api/decode').send(textBody(text))

      const sent = fetchSpy.mock.calls[0][1].body
      expect(sent).not.toMatch(/Ravi Kumar|ABCDE1234F|50100234567812/)
      expect(sent).toContain('take-home is only 52k')
    })

    // Re-audit R9: action items are signed and can be emailed, so text the model
    // wrote while reading someone else's document must never become one
    test("never passes on the model's own action items, text or links", async () => {
      const planted = {
        ...llmResult,
        actionItems: [
          { priority: 'high', action: 'Your salary account is frozen. Call +91 90000 00000 to unlock it.', link: 'javascript:alert(1)' },
          { priority: 'low', action: 'Log in here', link: 'https://incometax.gov.in.evil.example/login' },
        ],
      }
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(groqReply(planted))
      const res = await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))
      expect(res.status).toBe(200)
      const sent = JSON.stringify(res.body.data.actionItems)
      expect(sent).not.toMatch(/frozen|90000|javascript:|evil\.example|Log in here/)
      expect(res.body.data.actionItems.length).toBeGreaterThan(0)
    })

    test("doesn't ask the model for action items at all", async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(groqReply(llmResult))
      await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))
      const system = JSON.parse(fetchSpy.mock.calls[0][1].body).messages[0].content
      expect(system).not.toMatch(/"actionItems"/)
    })

    test('says the AI reader is down, not "paste your lines", when Groq has an outage', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"error":{"message":"Service Unavailable"}}', { status: 503 }))
      const res = await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))
      expect(res.status).toBe(503)
      expect(res.body.code).toBe('FALLBACK_UNAVAILABLE')
      expect(res.body.error).toMatch(/isn't responding right now/)
    })

    test.each([
      ['a negative take-home', { ...llmResult, summary: { ...llmResult.summary, takeHome: -17400 } }],
      ['take-home that does not match earnings − deductions', { ...llmResult, summary: { ...llmResult.summary, takeHome: 40000 } }],
      ['no earnings at all', { ...llmResult, breakdown: llmResult.breakdown.filter(r => r.type === 'deduction') }],
      ['a negative amount', { ...llmResult, breakdown: [...llmResult.breakdown, { component: 'Bonus', type: 'earning', monthly: -50000, annual: -600000 }] }],
    ])('refuses to show figures with %s', async (_, result) => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(groqReply(result))
      const res = await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))
      expect(res.status).toBe(422)
      expect(res.body.code).toBe('FALLBACK_UNRELIABLE')
    })

    test("replaces the model's own savings guess with the calculator's", async () => {
      const guessed = {
        ...llmResult,
        summary: { takeHome: 70500, ctc: 950000, tds: 36000, savingsPotential: 7300 },
        breakdown: [
          { component: 'Basic Pay', type: 'earning', monthly: 37500, annual: 450000, explanation: '' },
          { component: 'Other Allowances', type: 'earning', monthly: 37500, annual: 450000, explanation: '' },
          { component: 'EPF', type: 'deduction', monthly: 4500, annual: 54000, explanation: '' },
        ],
      }
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(groqReply(guessed))

      const res = await request(app).post('/api/decode').send(textBody('My CTC is 9.5L but take-home is only 70k'))

      // ₹9L gross: the new regime's tax is already ₹0, so more investing saves nothing
      expect(res.body.data.summary).toEqual({ takeHome: 70500, ctc: 950000, tds: 36000, estimatedTax: 0, savingsPotential: 0 })
    })

    test('does not call the fallback when the rules engine is confident', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch')
      const res = await request(app).post('/api/decode').send(textBody('Basic 25000, HRA 12500, PF 3000'))
      expect(res.body.data.engine).toBe('rules')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    const jsonCheckFailed = () => new Response('{"error":{"code":"json_validate_failed","message":"Failed to generate JSON"}}', { status: 400 })

    test("retries once when Groq's JSON check rejects the answer", async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonCheckFailed()).mockResolvedValueOnce(groqReply(llmResult))
      const res = await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))
      expect(res.status).toBe(200)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    test('gives the friendly message, not the provider error, if the retry fails too', async () => {
      jest.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonCheckFailed())
      const res = await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))
      expect(res.status).toBe(422)
      expect(res.body.code).toBe('FALLBACK_UNRELIABLE')
      expect(res.body.error).not.toMatch(/json_validate_failed|Groq/)
    })

    test('asks for the payslip lines when the fallback replies with malformed JSON', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }))
      )
      const res = await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))
      expect(res.status).toBe(422)
      expect(res.body.code).toBe('FALLBACK_UNRELIABLE')
    })

    test('treats an expired AI key like no key: the friendly "paste your lines" message', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"error":{"code":"invalid_api_key"}}', { status: 401 }))
      const res = await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))
      expect(res.status).toBe(422)
      expect(res.body.code).toBe('LOW_CONFIDENCE_NO_FALLBACK')
    })

    test('asks the user to retry when the AI rate limit is hit', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"error":{"message":"Rate limit reached"}}', { status: 429 }))
      const res = await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))
      expect(res.status).toBe(503)
      expect(res.body.error).toMatch(/wait a minute/)
    })
  })
})

describe('POST /api/decode/recalculate', () => {
  const rows = [
    { component: 'Basic Salary', type: 'earning', monthly: 37500 },
    { component: 'House Rent Allowance', type: 'earning', monthly: 15000 },
    { component: 'Canteen', type: 'deduction', monthly: 500 },
    { component: 'Employee PF', type: 'deduction', monthly: 1800 },
    { component: 'TDS', type: 'deduction', monthly: 3000 },
  ]

  test('recalculates take-home, tax and the checklist from corrected figures', async () => {
    const res = await request(app).post('/api/decode/recalculate').send({ breakdown: rows })
    expect(res.status).toBe(200)
    expect(res.body.data.engine).toBe('edited')
    // 52,500 − 500 − 1,800 − 3,000; rows ClearSlip doesn't know (Canteen) still count
    expect(res.body.data.summary.takeHome).toBe(47200)
    // Employer PF follows the corrected employee PF (capped at ₹1,800), not 12% of basic
    expect(res.body.data.summary.ctc).toBe((52500 + 1800) * 12)
    expect(res.body.data.breakdown.every(r => r.edited)).toBe(true)
    // ₹6.3 L: the new regime's tax is ₹0, so the checklist says so instead of old-regime tips
    expect(res.body.data.actionItems.some(a => /^The new regime suits your salary/.test(a.action))).toBe(true)
    expect(res.body.data.checklistToken).toMatch(/^[a-f0-9]{64}$/)
  })

  test('refuses figures where take-home is zero or less', async () => {
    const res = await request(app).post('/api/decode/recalculate')
      .send({ breakdown: [{ component: 'Basic', type: 'earning', monthly: 10000 }, { component: 'Loan Recovery', type: 'deduction', monthly: 20000 }] })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('IMPOSSIBLE_FIGURES')
  })

  test('keeps a row the user marked one-off out of the ×12', async () => {
    const res = await request(app).post('/api/decode/recalculate')
      .send({ breakdown: [...rows, { component: 'Joining Bonus', type: 'earning', monthly: 50000, oneOff: true }] })
    expect(res.status).toBe(200)
    expect(res.body.data.breakdown.find(r => r.component === 'Joining Bonus')).toMatchObject({ annual: 50000, oneOff: true })
  })

  test('rejects rows without a name', async () => {
    const res = await request(app).post('/api/decode/recalculate').send({ breakdown: [{ component: ' ', type: 'earning', monthly: 1000 }] })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/checklist', () => {
  // A real decode result, with the token the server signed it with
  const decoded = async () => {
    const { body } = await request(app).post('/api/decode').send(textBody('Basic 25000, HRA 12500, PF 3000, TDS 4200'))
    return { checklistItems: body.data.actionItems, payslipSummary: body.data.summary, checklistToken: body.data.checklistToken }
  }

  test('accepts a checklist ClearSlip produced (then 503: n8n is not configured)', async () => {
    const res = await request(app).post('/api/checklist').send({ email: 'test@example.com', ...(await decoded()) })
    expect(res.status).toBe(503)
    expect(res.body.code).toBe('N8N_NOT_CONFIGURED')
  })

  test('refuses a checklist whose text was changed (no phishing through our email)', async () => {
    const genuine = await decoded()
    const tampered = { ...genuine, checklistItems: [{ priority: 'high', action: 'Your salary account is locked. Verify now.', link: genuine.checklistItems[0].link }] }
    const res = await request(app).post('/api/checklist').send({ email: 'victim@example.com', ...tampered })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('CHECKLIST_NOT_VERIFIED')
  })

  test('requires the checklist token', async () => {
    const { checklistToken, ...withoutToken } = await decoded()
    const res = await request(app).post('/api/checklist').send({ email: 'test@example.com', ...withoutToken })
    expect(res.status).toBe(400)
  })

  test.each(['javascript:alert(1)', 'https://phish.example/login'])('rejects the link %s', async link => {
    const genuine = await decoded()
    const res = await request(app).post('/api/checklist').send({ email: 'test@example.com', ...genuine, checklistItems: [{ action: 'x', link }] })
    expect(res.status).toBe(400)
  })

  test('rejects an invalid email', async () => {
    const res = await request(app).post('/api/checklist').send({ email: 'not-an-email', ...(await decoded()) })
    expect(res.status).toBe(400)
  })
})
