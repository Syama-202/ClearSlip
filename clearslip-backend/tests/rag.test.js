import fs from 'fs'
import { jest } from '@jest/globals'
import request from 'supertest'

// Never call Groq for real, whatever the local .env says
process.env.GROQ_API_KEY = ''

const { default: app } = await import('../src/app.js')
const { config } = await import('../src/config/index.js')
const { chunkDocument, loadCorpus, corpusHash } = await import('../src/rag/corpus.js')
const { tokenize } = await import('../src/rag/bm25.js')
const { getKnowledgeBase, fuse, INDEX_FILE } = await import('../src/rag/knowledgeBase.js')
const { citedNumbers } = await import('../src/services/askService.js')
const { EVAL_QUESTIONS, OFF_TOPIC_QUESTIONS } = await import('./fixtures/ragEval.js')

const ask = body => request(app).post('/api/ask').send(body)
const groqReply = message => new Response(JSON.stringify({ choices: [{ message }] }))

describe('corpus', () => {
  test('splits a document into one chunk per section, with its front matter', () => {
    const chunks = chunkDocument('demo', '---\ntitle: Demo\nsource: https://example.gov.in\nreference: Sec 1\n---\n\n## First part\nAlpha.\n\n## Second part\nBeta.\n')
    expect(chunks).toEqual([
      { id: 'demo#first-part', docId: 'demo', title: 'Demo', section: 'First part', source: 'https://example.gov.in', reference: 'Sec 1', text: 'Alpha.' },
      { id: 'demo#second-part', docId: 'demo', title: 'Demo', section: 'Second part', source: 'https://example.gov.in', reference: 'Sec 1', text: 'Beta.' },
    ])
  })

  test('every chunk has a source and a legal reference', () => {
    for (const c of loadCorpus()) {
      expect(c.source).toMatch(/^https:\/\//)
      expect(c.reference).toBeTruthy()
      expect(c.text.length).toBeGreaterThan(80)
    }
  })

  test('the committed embedding index matches the corpus (run `npm run rag:index` after edits)', () => {
    const stored = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
    expect(stored.corpusHash).toBe(corpusHash(loadCorpus()))
  })
})

describe('BM25 tokenizer', () => {
  test('keeps section numbers whole and drops stopwords', () => {
    expect(tokenize('What is section 80CCD(1B) and 80C?')).toEqual(['section', '80ccd1b', '80c'])
  })

  test('expands payslip abbreviations in queries', () => {
    expect(tokenize('HRA', { expand: true })).toEqual(['hra', 'house', 'rent', 'allowance'])
  })
})

describe('retrieval (BM25 — dense retrieval is off in tests)', () => {
  const kb = getKnowledgeBase()

  test.each(EVAL_QUESTIONS)('finds the right document in the top 3: $q', async ({ q, docs }) => {
    const { results, method } = await kb.retrieve(q, { k: 3 })
    expect(method).toBe('bm25')
    expect(results.some(r => docs.includes(r.docId))).toBe(true)
  })

  test.each(OFF_TOPIC_QUESTIONS)('flags an off-topic question as not relevant: %s', async q => {
    expect((await kb.retrieve(q)).relevant).toBe(false)
  })

  test('Reciprocal Rank Fusion rewards agreement between rankings', () => {
    const fused = fuse([[{ index: 1 }, { index: 2 }, { index: 3 }], [{ index: 3 }, { index: 1 }]])
    expect(fused.map(r => r.index)).toEqual([1, 3, 2])
  })
})

describe('citedNumbers', () => {
  test('collects valid citations in order of first use', () => {
    expect(citedNumbers('A [2]. B [1, 3]. C [2]. D [9].', 5)).toEqual([2, 1, 3])
  })
})

describe('POST /api/ask', () => {
  test('without an AI key, returns the best passages with their sources', async () => {
    const res = await ask({ question: 'How do I calculate HRA exemption?' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ mode: 'retrieval-only', answer: null, retrievalMethod: 'bm25' })
    expect(res.body.data.sources).toHaveLength(3)
    expect(res.body.data.sources[0]).toMatchObject({ n: 1, title: 'House Rent Allowance (HRA) exemption' })
  })

  test('refuses off-topic questions without calling the AI', async () => {
    config.groqApiKey = 'test-key'
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
    const res = await ask({ question: 'What is the capital of France?' })
    expect(res.body.data).toMatchObject({ mode: 'no-sources', sources: [] })
    expect(res.body.data.answer).toMatch(/couldn't find anything about this/)
    expect(fetchSpy).not.toHaveBeenCalled()
    config.groqApiKey = ''
    fetchSpy.mockRestore()
  })

  test('rejects questions containing a PAN', async () => {
    const res = await ask({ question: 'My PAN is ABCDE1234F, how much tax do I pay?' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('SENSITIVE_DATA')
  })

  test('rejects an empty question', async () => {
    expect((await ask({ question: ' ' })).status).toBe(400)
  })

  describe('with the AI configured', () => {
    const payslip = {
      summary: { takeHome: 58700, tds: 30000 },
      breakdown: [
        { component: 'Basic Salary', type: 'earning', monthly: 37500, annual: 450000 },
        { component: 'HRA (House Rent Allowance)', type: 'earning', monthly: 15000, annual: 180000 },
        { component: 'Special Allowance', type: 'earning', monthly: 22500, annual: 270000 },
        { component: 'Provident Fund (PF)', type: 'deduction', monthly: 4500, annual: 54000 },
      ],
    }

    beforeEach(() => { config.groqApiKey = 'test-key' })
    afterEach(() => { config.groqApiKey = ''; jest.restoreAllMocks() })

    test('runs the tax tool the model asks for and returns a cited answer', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(groqReply({
          content: null,
          tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'compare_tax_regimes', arguments: '{"annual_gross_salary":900000,"section_80c":54000}' } }],
        }))
        .mockResolvedValueOnce(groqReply({ content: 'The new regime is better for you: you pay ₹0 tax because income up to ₹12 lakh gets a full rebate [1].' }))

      const res = await ask({ question: 'Which tax regime is better for me?', payslip })
      const { data } = res.body

      expect(res.status).toBe(200)
      expect(data.mode).toBe('rag')
      expect(data.answer).toMatch(/new regime is better/)
      expect(data.cited).toEqual([1])
      expect(data.toolCalls).toHaveLength(1)
      expect(data.toolCalls[0]).toMatchObject({ name: 'compare_tax_regimes', args: { annual_gross_salary: 900000 } })
      expect(data.toolCalls[0].result).toMatchObject({ better: 'new', newRegime: { totalTax: 0 } })

      // First request: grounded prompt with numbered sources, the payslip and the tools
      const first = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(first.messages[0].content).toMatch(/SOURCES:\n\[1\]/)
      expect(first.messages[0].content).toMatch(/Annual gross salary \(sum of earnings\): ₹900000/)
      expect(first.tools.map(t => t.function.name)).toContain('compare_tax_regimes')

      // Second request: the tool's exact result fed back to the model
      const second = JSON.parse(fetchSpy.mock.calls[1][1].body)
      const toolMessage = second.messages.find(m => m.role === 'tool')
      expect(toolMessage.tool_call_id).toBe('call_1')
      expect(JSON.parse(toolMessage.content).better).toBe('new')
    })

    test('retries without tools when the model sends a malformed tool call', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('{"error":{"code":"tool_use_failed"}}', { status: 400 }))
        .mockResolvedValueOnce(groqReply({ content: 'Professional tax is capped at ₹2,500 a year [1].' }))

      const res = await ask({ question: 'What is the maximum professional tax?' })
      expect(res.body.data).toMatchObject({ mode: 'rag', cited: [1], toolCalls: [] })
      expect(JSON.parse(fetchSpy.mock.calls[1][1].body).tools).toBeUndefined()
    })

    test('passes recent turns along for follow-up questions', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(groqReply({ content: 'In the old regime the standard deduction is ₹50,000 [1].' }))

      await ask({
        question: 'And in the old regime?',
        history: [
          { role: 'user', content: 'What is the standard deduction in the new regime?' },
          { role: 'assistant', content: 'It is ₹75,000 [1].' },
        ],
      })
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(body.messages.slice(1).map(m => m.role)).toEqual(['user', 'assistant', 'user'])
    })
  })
})
