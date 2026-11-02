import fs from 'fs'
import { parsePayslipText } from '../src/services/rulesEngine.js'
import { WEB_SAMPLES } from './fixtures/webSamples.js'

// Real-world layouts collected from Indian payroll/HR websites — see
// tests/fixtures/webSamples.js for the source of each sample. Each one is
// checked twice: as pasted text, and as the text Tesseract actually read
// from an image of it (tests/fixtures/ocr/sampleN.txt), where the ₹ sign
// comes out as "%", "¥", "]" or a stray leading "2"/"3".
const cases = WEB_SAMPLES.flatMap((sample, i) => [
  { ...sample, input: 'pasted text', text: sample.text, fromOcr: false },
  {
    ...sample,
    input: 'OCR of an image',
    text: fs.readFileSync(new URL(`./fixtures/ocr/sample${i}.txt`, import.meta.url), 'utf8'),
    fromOcr: true,
  },
])

describe.each(cases)('$name ($input)', ({ text, fromOcr, expected }) => {
  const { result } = parsePayslipText(text, { fromOcr })
  const monthly = Object.fromEntries((result?.breakdown ?? []).map(b => [b.component, b.monthly]))
  const annual = Object.fromEntries((result?.breakdown ?? []).map(b => [b.component, b.annual]))

  test('is decoded by the rules engine', () => {
    expect(result).not.toBeNull()
  })

  test('has the right take-home pay', () => {
    expect(result.summary.takeHome).toBe(expected.takeHome)
  })

  test('finds exactly the expected components with the right amounts', () => {
    expect(monthly).toEqual(expected.components)
  })

  if (expected.annual) {
    test('keeps the annual column', () => {
      for (const [component, amount] of Object.entries(expected.annual)) {
        expect(annual[component]).toBe(amount)
      }
    })
  }
})
