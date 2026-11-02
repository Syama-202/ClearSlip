import { parsePayslipText, parseAmounts } from '../src/services/rulesEngine.js'

// Returns { component label: [monthly, annual] } for compact assertions
function breakdownOf(text) {
  return breakdownOf.fromResult(parsePayslipText(text).result)
}
breakdownOf.fromResult = result => Object.fromEntries(result.breakdown.map(b => [b.component, [b.monthly, b.annual]]))

describe('parseAmounts', () => {
  test('reads plain, international and Indian comma formats', () => {
    expect(parseAmounts('25000 100,000 1,00,000 12,500.50').map(a => a.value))
      .toEqual([25000, 100000, 100000, 12500.5])
  })

  test('does not split a plain number into pieces (regression)', () => {
    expect(parseAmounts('25000').map(a => a.value)).toEqual([25000])
  })

  test('understands k / L / LPA / lakh / Cr suffixes', () => {
    expect(parseAmounts('52k 8L 8.5 LPA 12 lakhs 1.2 Cr')).toEqual([
      { value: 52000, annual: false },
      { value: 800000, annual: true },
      { value: 850000, annual: true },
      { value: 1200000, annual: true },
      { value: 12000000, annual: true },
    ])
  })

  test('reads "Cr" after a full amount as credit, not crore', () => {
    expect(parseAmounts('58,700 Cr')).toEqual([{ value: 58700, annual: false }])
  })

  test('does not read the start of a word as a unit', () => {
    expect(parseAmounts('30000 less tax')).toEqual([{ value: 30000, annual: false }])
  })

  test('ignores percentages', () => {
    expect(parseAmounts('@ 12% 3,600').map(a => a.value)).toEqual([3600])
  })

  test('keeps an amount whose ₹ sign OCR read as "%"', () => {
    expect(parseAmounts('50,000 %6,00,000').map(a => a.value)).toEqual([50000, 600000])
  })

  test('offers a reading without a leading 2/3 that may be a misread ₹', () => {
    expect(parseAmounts('39,520 316,830')).toEqual([
      { value: 39520, annual: false, withoutRupeeMisread: 9520 },
      { value: 316830, annual: false, withoutRupeeMisread: 16830 },
    ])
  })

  test('offers no alternative when dropping the digit leaves a malformed amount', () => {
    expect(parseAmounts('30,000 2,500 3 20')).toEqual([
      { value: 30000, annual: false },
      { value: 2500, annual: false },
      { value: 3, annual: false },
      { value: 20, annual: false },
    ])
  })
})

describe('parsePayslipText — OCR ₹-misread correction', () => {
  const misread = 'Basic 47,600\nDA 29,988\nHRA 39,520\nTransport Allowance 31,800\nGross Earnings 390,042\nNPS 7,759\nTotal Deductions 38,469'

  test('picks the readings that make the totals add up', () => {
    const { result } = parsePayslipText(misread, { fromOcr: true })
    expect(breakdownOf.fromResult(result)).toMatchObject({
      'Basic Salary': [47600, 571200],
      'DA (Dearness Allowance)': [29988, 359856],
      'HRA (House Rent Allowance)': [9520, 114240],
      'Transport Allowance': [1800, 21600],
    })
    expect(result.summary.takeHome).toBe(81573)
  })

  test('uses Net = Gross − Total Deductions to settle the totals', () => {
    const { result } = parsePayslipText('Basic 50,000\nHRA 20,000\nGross 370,000\nPF 6,000\nTotal Deductions 36,000\nNet Pay 64,000', { fromOcr: true })
    expect(result.summary.takeHome).toBe(64000)
    expect(breakdownOf.fromResult(result)['Basic Salary']).toEqual([50000, 600000])
  })

  test('leaves genuine amounts starting with 2 or 3 alone when the totals already agree', () => {
    const text = 'Basic 30,000\nHRA 15,000\nSpecial Allowance 25,000\nGross 70,000\nTDS 3,500\nTotal Deductions 3,500'
    expect(breakdownOf.fromResult(parsePayslipText(text, { fromOcr: true }).result)).toEqual(breakdownOf(text))
  })

  test('is off for pasted text', () => {
    expect(parsePayslipText(misread).result.breakdown.find(b => b.component.startsWith('HRA')).monthly).toBe(39520)
  })
})

describe('parsePayslipText — component recognition', () => {
  test('decodes the comma-separated example from the UI', () => {
    const { result, confidence } = parsePayslipText(
      'Please decode this payslip: Basic 25000, HRA 12500, PF 3000, TDS 4200 deducted. Am I paying too much?'
    )
    expect(confidence).toBe(4)
    expect(result.summary).toEqual({ takeHome: 30300, ctc: 486000, tds: 50400, savingsPotential: 8200 })
  })

  test('splits on list commas but not thousands separators (regression)', () => {
    expect(breakdownOf('Basic 12,500, HRA 5,000, PF 1,500')).toEqual({
      'Basic Salary': [12500, 150000],
      'HRA (House Rent Allowance)': [5000, 60000],
      'Provident Fund (PF)': [1500, 18000],
    })
  })

  test('splits two-column OCR lines into separate components', () => {
    const text = [
      'Earnings Amount Deductions Amount',
      'Basic 30,000 Provident Fund 3,600',
      'HRA 15,000 Professional Tax 200',
      'Special Allowance 20,000 Income Tax 2,500',
      'Gross Earnings 65,000 Total Deductions 6,300',
      'Net Pay 58,700',
    ].join('\n')

    expect(breakdownOf(text)).toEqual({
      'Basic Salary': [30000, 360000],
      'HRA (House Rent Allowance)': [15000, 180000],
      'Special Allowance': [20000, 240000],
      'Provident Fund (PF)': [3600, 43200],
      'TDS (Income Tax)': [2500, 30000],
      'Professional Tax': [200, 2400],
    })
    expect(parsePayslipText(text).result.summary.takeHome).toBe(58700)
  })

  test('ignores a year-to-date column', () => {
    const text = 'Earnings Current YTD\nBasic 30,000 1,80,000\nHRA 15,000 90,000'
    expect(breakdownOf(text)).toEqual({
      'Basic Salary': [30000, 360000],
      'HRA (House Rent Allowance)': [15000, 180000],
    })
  })

  test('accepts a real annual column (≈ 12× monthly)', () => {
    expect(breakdownOf('Basic 30,000 3,60,000\nHRA 15,000 1,80,000')['Basic Salary']).toEqual([30000, 360000])
  })

  test('reads k-suffixed monthly amounts and an LPA CTC', () => {
    const { result } = parsePayslipText('CTC 8 LPA, Basic 25k, HRA 12.5k, PF 3k')
    expect(result.summary.ctc).toBe(800000)
    expect(result.breakdown[0]).toMatchObject({ component: 'Basic Salary', monthly: 25000 })
  })

  test('reads a large bare CTC figure as annual', () => {
    expect(parsePayslipText('CTC 9,60,000\nBasic 40,000\nHRA 20,000').result.summary.ctc).toBe(960000)
  })

  test('treats a figure marked "per annum" as annual', () => {
    expect(breakdownOf('Basic 3,60,000 per annum\nHRA 15,000')['Basic Salary']).toEqual([30000, 360000])
  })

  test('recognises short labels: DA, P.Tax, ESIC', () => {
    expect(Object.keys(breakdownOf('Basic 18,000\nDA 9,000\nP.Tax 200\nESIC 150'))).toEqual([
      'Basic Salary', 'DA (Dearness Allowance)', 'ESI', 'Professional Tax',
    ])
  })
})

describe('parsePayslipText — things that must not be mistaken for components', () => {
  test('"Gross Deductions" is a deductions total, not gross salary', () => {
    const { result } = parsePayslipText('Basic 30000\nHRA 15000\nGross Deductions 4000\nPF 3600')
    expect(result.summary.takeHome).toBe(41000)
  })

  test('uses "Total Deductions" for take-home when there is no net pay line', () => {
    const { result } = parsePayslipText('Basic 30000\nHRA 15000\nPF 3600\nTotal Deductions 5000')
    expect(result.summary.takeHome).toBe(40000)
  })

  test('ignores PF account numbers and UANs', () => {
    const text = 'PF No: 12345 UAN 100123456789\nBasic 30,000\nHRA 15,000\nPF 3,600'
    expect(breakdownOf(text)['Provident Fund (PF)']).toEqual([3600, 43200])
  })

  test('ignores employer-side contributions', () => {
    const text = 'Basic 30,000\nHRA 15,000\nEmployer PF 3,600\nEmployee PF 1,800'
    expect(breakdownOf(text)['Provident Fund (PF)']).toEqual([1800, 21600])
  })

  test('ignores the percentage in "PF @ 12%"', () => {
    expect(breakdownOf('Basic 30,000\nPF @ 12% 3,600')['Provident Fund (PF)']).toEqual([3600, 43200])
  })

  test('ignores numbers that come before any label', () => {
    expect(breakdownOf('October 2026 Basic 30,000\nHRA 15,000')['Basic Salary']).toEqual([30000, 360000])
  })
})

describe('parsePayslipText — confidence and fallback', () => {
  test('returns no result for text with no payslip labels', () => {
    expect(parsePayslipText('hello, my name is Ravi and I joined in 2024')).toEqual({ result: null, confidence: 0 })
  })

  test('leaves questions without any earning to the LLM fallback', () => {
    const { result, confidence } = parsePayslipText('My CTC is 8L but take-home is only 52k')
    expect(confidence).toBe(1)
    expect(result).toBeNull()
  })

  test('returns no result when only one component is found', () => {
    expect(parsePayslipText('Basic 30000').result).toBeNull()
  })

  test('returns no result when the numbers give a non-positive take-home', () => {
    expect(parsePayslipText('Basic 3000\nHRA 1000\nTDS 9000').result).toBeNull()
  })
})

describe('parsePayslipText — action items', () => {
  test('returns 2–5 items ordered high → medium → low', () => {
    const { result } = parsePayslipText('Basic 30000\nHRA 15000\nPF 3600')
    const rank = { high: 0, medium: 1, low: 2 }
    const ranks = result.actionItems.map(a => rank[a.priority])

    expect(result.actionItems.length).toBeGreaterThanOrEqual(2)
    expect(result.actionItems.length).toBeLessThanOrEqual(5)
    expect(ranks).toEqual([...ranks].sort())
    expect(result.actionItems[0].action).toMatch(/rent receipts/)
  })

  test('flags TDS above 15% of gross', () => {
    const { result } = parsePayslipText('Basic 30000\nHRA 10000\nTDS 8000')
    expect(result.actionItems.some(a => /TDS looks high/.test(a.action))).toBe(true)
  })
})
