import { jest } from '@jest/globals'
import request from 'supertest'

// Pin optional integrations off before the app (and dotenv) load, so a
// local .env with real keys never makes these tests call Groq or n8n.
// dotenv does not override variables that are already set.
process.env.GROQ_API_KEY = ''
process.env.N8N_WEBHOOK_URL = ''

const { default: app } = await import('../src/app.js')
const { config } = await import('../src/config/index.js')

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

describe('GET /', () => {
  test('explains this is the API and points to the website', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/Open the website at http/)
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

  test('returns 400, not 500, for a corrupt PDF', async () => {
    const res = await request(app).post('/api/decode').send(pdfBody(Buffer.from('not a pdf'.repeat(20)).toString('base64')))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_PDF')
  })

  test('returns 422 for unreadable text when no fallback is configured', async () => {
    const res = await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('LOW_CONFIDENCE_NO_FALLBACK')
  })

  test('rejects Aadhaar-like numbers', async () => {
    const res = await request(app).post('/api/decode').send(textBody('Aadhaar 1234 5678 9012, Basic 30000, HRA 15000'))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('SENSITIVE_DATA')
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
    const llmResult = {
      summary: { takeHome: 52000, ctc: 800000, tds: 0, savingsPotential: 0 },
      breakdown: [],
      actionItems: [{ priority: 'high', action: 'Ask HR for your salary structure', link: null }],
      disclaimer: 'Assumed figures',
    }

    beforeEach(() => {
      config.groqApiKey = 'test-key'
    })

    afterEach(() => {
      config.groqApiKey = ''
      jest.restoreAllMocks()
    })

    test('sends low-confidence text to the fallback and tags the result', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(llmResult) } }] }))
      )

      const res = await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual({ ...llmResult, engine: 'llm-fallback' })
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0][1].body).toContain('take-home is only 52k')
    })

    test('does not call the fallback when the rules engine is confident', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch')
      const res = await request(app).post('/api/decode').send(textBody('Basic 25000, HRA 12500, PF 3000'))
      expect(res.body.data.engine).toBe('rules')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('returns 502 when the fallback replies with malformed JSON', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }))
      )
      const res = await request(app).post('/api/decode').send(textBody('My CTC is 8L but take-home is only 52k'))
      expect(res.status).toBe(502)
      expect(res.body.code).toBe('PARSE_ERROR')
    })
  })
})

describe('POST /api/checklist', () => {
  test('returns 503 when n8n is not configured', async () => {
    const res = await request(app)
      .post('/api/checklist')
      .send({ email: 'test@example.com', checklistItems: [{ action: 'Submit rent receipts' }] })
    expect(res.status).toBe(503)
    expect(res.body.code).toBe('N8N_NOT_CONFIGURED')
  })

  test('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/api/checklist')
      .send({ email: 'not-an-email', checklistItems: [{ action: 'x' }] })
    expect(res.status).toBe(400)
  })
})
