import { parsePayslipText, recalculateFromRows } from '../src/services/rulesEngine.js'

// Payslips as they really arrive: bonus months, arrears, lines ClearSlip has no
// label for, totals that don't match, two months pasted together. Each of these
// used to give confident, wrong figures with no warning (re-audit R1–R3, R7).

const parse = text => parsePayslipText(text).result
const row = (result, name) => result.breakdown.find(r => r.component.startsWith(name))
const checkMatching = (result, re) => result.checks.find(c => re.test(c))

describe('one-off payments are counted once a year (R1)', () => {
  const bonusMonth = `Basic 40,000
HRA 20,000
Special Allowance 20,000
Performance Bonus 1,50,000
PF 4,800
TDS 25,000
Net Pay 1,80,200`

  test('a bonus adds to the yearly salary once, not 12 times', () => {
    const result = parse(bonusMonth)
    expect(row(result, 'Bonus')).toMatchObject({ monthly: 150000, annual: 150000, oneOff: true })
    // ₹80,000 × 12 + ₹1,50,000 = ₹11.1 L, under the new regime's ₹12 L rebate after the standard deduction
    expect(result.summary.estimatedTax).toBe(0)
    expect(result.summary.ctc).toBe(80000 * 12 + 150000 + 4800 * 12)
    expect(result.summary.takeHome).toBe(180200)
  })

  test("doesn't compare 12× a bonus month's TDS with the year's tax", () => {
    const result = parse(bonusMonth)
    const actions = result.actionItems.map(a => a.action).join(' ')
    expect(actions).not.toMatch(/expect TDS to rise|paying too much tax/)
    expect(actions).toMatch(/includes a one-off payment \(Bonus \/ Incentive ₹1,50,000\).*about ₹0/)
    expect(checkMatching(result, /counted once in your yearly salary/)).toBeDefined()
  })

  test('a big bonus does not make the salary look yearly', () => {
    const result = parse('Basic 60,000\nHRA 30,000\nDiwali Bonus 6,00,000\nPF 7,200')
    expect(checkMatching(result, /read as monthly/)).toBeUndefined()
  })

  test("a bonus the payslip's yearly column shows every month is regular pay", () => {
    const result = parse('Basic | 50,000 | 6,00,000\nBonus | 8,500 | 1,02,000\nPF | 6,000 | 72,000')
    expect(row(result, 'Bonus')).toMatchObject({ monthly: 8500, annual: 102000 })
    expect(row(result, 'Bonus').oneOff).toBeUndefined()
  })

  test('recognises arrears, leave encashment and variable pay as one-off', () => {
    const result = parse('Basic 30,000\nSalary Arrears 12,000\nLeave Encashment 9,000\nVariable Pay 20,000\nPF 3,600')
    for (const name of ['Arrears', 'Leave Encashment', 'Variable Pay']) {
      expect(row(result, name).oneOff).toBe(true)
      expect(row(result, name).annual).toBe(row(result, name).monthly)
    }
  })
})

describe('loss of pay and day counts', () => {
  test('a negative "Loss of Pay" line reduces take-home, once', () => {
    const result = parse('Basic 30,000\nHRA 15,000\nSalary Arrears 12,000\nLoss of Pay -5,000\nPF 3,600\nTDS 1,500')
    expect(row(result, 'Loss of Pay')).toMatchObject({ type: 'deduction', monthly: 5000, annual: 5000 })
    // 30,000 + 15,000 + 12,000 − 5,000 − 3,600 − 1,500
    expect(result.summary.takeHome).toBe(46900)
    expect(checkMatching(result, /minus sign/)).toBeUndefined()
  })

  test('day counts are never read as rupees', () => {
    const result = parse('Paid Days 30 | LOP Days 2\nDays paid / Loss of pay 30/0\nLeave Without Pay (if any): 2 Days\nBasic 30,000\nPF 3,600')
    expect(row(result, 'Loss of Pay')).toBeUndefined()
    expect(result.unplaced).toBeUndefined()
  })
})

describe('lines ClearSlip could not place are reported, not dropped (R2)', () => {
  const slip = `Employee ID 10234 | Paid Days 30
Payslip for October 2026, paid on 26th October 2026
Bank A/c XXXXX1234
Basic 30,000 Night Allowance 2,000
HRA 15,000
Canteen Deduction 450
PF 3,600`

  test('lists each unknown line with its amount and a likely type', () => {
    expect(parse(slip).unplaced).toEqual([
      { text: 'Night Allowance 2,000', component: 'Night Allowance', monthly: 2000, suggestedType: 'earning' },
      { text: 'Canteen Deduction 450', component: 'Canteen Deduction', monthly: 450, suggestedType: 'deduction' },
    ])
  })

  test('says they are left out of the figures', () => {
    const result = parse(slip)
    expect(checkMatching(result, /2 lines weren't recognised.*"Night Allowance 2,000", "Canteen Deduction 450"/)).toBeDefined()
    expect(result.summary.takeHome).toBe(41400) // unchanged until the user adds them
  })

  test('ignores identifiers, dates, masked numbers and headings', () => {
    const result = parse('Earnings | Amount\nEmployee Code 55012\nPay Period October 2026\nPAN XXXXX1234X\nBasic 30,000\nHRA 15,000\nPF 3,600')
    expect(result.unplaced).toBeUndefined()
  })

  test('a negative unknown amount is suggested as a deduction', () => {
    const [line] = parse('Basic 30,000\nHRA 15,000\nSalary Adjustment -4,000\nPF 3,600').unplaced
    expect(line).toMatchObject({ monthly: 4000, suggestedType: 'deduction' })
  })
})

describe("the payslip's own totals are checked against the lines read (R3)", () => {
  test('flags earnings that fall short of the printed gross', () => {
    const result = parse('Basic 30,000\nHRA 15,000\nSpecial Allowance 10,000\nGross Salary 70,000\nPF 3,600\nNet Pay 60,000')
    expect(checkMatching(result, /earnings ClearSlip read add up to ₹55,000, but your payslip's total is ₹70,000 \(₹15,000 not accounted for\)/)).toBeDefined()
    // No Total Deductions line: gross − net implies ₹10,000 of deductions
    expect(checkMatching(result, /deductions ClearSlip read add up to ₹3,600, but your payslip's totals imply ₹10,000/)).toBeDefined()
  })

  test("flags a payslip whose own totals don't add up", () => {
    const result = parse('Basic 50,000\nHRA 20,000\nGross Salary 70,000\nPF 6,000\nTotal Deductions 6,000\nNet Pay 65,000')
    expect(checkMatching(result, /own totals don't add up: gross ₹70,000 minus deductions ₹6,000 is ₹64,000, not the net pay of ₹65,000/)).toBeDefined()
  })

  test('stays quiet when everything adds up (rounding allowed)', () => {
    const sample = `Basic Salary 37,500 | Employee PF 4,500
House Rent Allowance 15,000 | Professional Tax 200
Special Allowance 18,900 | TDS 3,000
Conveyance Allowance 1,600
Leave Travel Allowance 2,000
Gross Salary 75,005 | Total Deductions 7,700
Net Pay 67,305`
    expect(parse(sample).checks).toEqual([])
  })
})

describe('more than one payslip pasted together (R7)', () => {
  test('says so and names the months', () => {
    const result = parse('October 2026\nBasic 30,000 HRA 15,000 PF 3,600 TDS 2,000\nNovember 2026\nBasic 32,000 HRA 16,000 PF 3,840 TDS 2,200')
    expect(checkMatching(result, /more than one payslip \(Oct 2026, Nov 2026\)/)).toBeDefined()
    expect(row(result, 'Basic').monthly).toBe(30000)
  })

  test('warns about repeated lines without months (rate and earned columns)', () => {
    const result = parse('Rate: Basic 30,000 HRA 15,000 Special Allowance 10,000\nEarned: Basic 28,000 HRA 14,000 Special Allowance 9,300\nPF 3,600')
    expect(checkMatching(result, /appear more than once.*"rate" and "earned"/)).toBeDefined()
  })

  test('one repeated sub-line is not mistaken for two payslips', () => {
    const result = parse('Basic 47,600\nDA 29,988\nDA on Transport Allowance 1,134\nTransport Allowance 1,800\nNPS 7,759')
    expect(checkMatching(result, /more than once|more than one payslip/)).toBeUndefined()
    expect(row(result, 'DA on Transport').monthly).toBe(1134)
  })
})

describe('recalculating with one-off rows', () => {
  const rows = [
    { component: 'Basic Salary', type: 'earning', monthly: 40000 },
    { component: 'Festival Bonus', type: 'earning', monthly: 100000 },
    { component: 'PF', type: 'deduction', monthly: 4800 },
  ]

  test('a bonus is one-off by default', () => {
    expect(row(recalculateFromRows(rows), 'Festival Bonus')).toMatchObject({ annual: 100000, oneOff: true })
  })

  test("the user's choice wins either way", () => {
    const regular = recalculateFromRows(rows.map(r => ({ ...r, oneOff: false })))
    expect(row(regular, 'Festival Bonus').annual).toBe(1200000)
    const once = recalculateFromRows([...rows, { component: 'Night Allowance', type: 'earning', monthly: 5000, oneOff: true }])
    expect(row(once, 'Night Allowance')).toMatchObject({ annual: 5000, oneOff: true })
  })
})
