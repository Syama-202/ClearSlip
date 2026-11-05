import { newRegimeTax, oldRegimeTax, compareRegimes, hraExemption, oldRegimeBestCase } from '../src/services/taxCalculator.js'

// Expected values are worked by hand: slab tax − rebate/marginal relief, then + 4% cess.
describe('oldRegimeTax', () => {
  test('applies the ₹50,000 standard deduction and slabs', () => {
    // taxable 5.5L: 12,500 + 50,000 × 20% = 22,500 → + cess 900
    expect(oldRegimeTax(600000).totalTax).toBe(23400)
  })

  test('gives the 87A rebate up to ₹12,500 when taxable income ≤ ₹5L', () => {
    const r = oldRegimeTax(550000)
    expect(r.taxableIncome).toBe(500000)
    expect(r.rebate87A).toBe(12500)
    expect(r.totalTax).toBe(0)
  })

  test('caps each deduction at its legal limit', () => {
    const r = oldRegimeTax(1000000, { section80C: 200000, professionalTax: 3000, section80CCD1B: 80000 })
    expect(r.deductions).toMatchObject({ section80C: 150000, professionalTax: 2500, section80CCD1B: 50000 })
  })

  test('taxes ₹10L with full 80C', () => {
    // taxable 8L: 12,500 + 3L × 20% = 72,500 → + cess 2,900
    expect(oldRegimeTax(1000000, { section80C: 150000 }).totalTax).toBe(75400)
  })
})

describe('newRegimeTax', () => {
  test('allows employer NPS up to 14% of basic + DA, then marginal relief', () => {
    // taxable 14L − 75k − 70k = 12.55L: slab 68,250, capped at 55,000 by marginal relief → + cess
    const r = newRegimeTax(1400000, { employerNps: 70000, basicPlusDa: 600000 })
    expect(r.deductions.employerNps80CCD2).toBe(70000)
    expect(r.marginalRelief).toBe(13250)
    expect(r.totalTax).toBe(57200)
  })

  test('limits employer NPS to 14% of basic + DA', () => {
    expect(newRegimeTax(1400000, { employerNps: 200000, basicPlusDa: 600000 }).deductions.employerNps80CCD2).toBe(84000)
  })

  test('flags incomes where surcharge would apply', () => {
    expect(newRegimeTax(6000000).surchargeNotModelled).toBe(true)
    expect(newRegimeTax(1000000).surchargeNotModelled).toBe(false)
  })
})

describe('compareRegimes', () => {
  test('new regime wins for ₹10L with only 80C', () => {
    expect(compareRegimes(1000000, { section80C: 150000 })).toMatchObject({ better: 'new', annualSaving: 75400 })
  })

  test('old regime wins with large deductions', () => {
    // old: taxable 7,82,500 → 69,000 + cess = 71,760; new: taxable 14.25L → 93,750 + cess = 97,500
    const r = compareRegimes(1500000, {
      section80C: 150000, section80CCD1B: 50000, section80D: 25000,
      hraExemption: 240000, professionalTax: 2500, homeLoanInterest: 200000,
    })
    expect(r.oldRegime.totalTax).toBe(71760)
    expect(r.newRegime.totalTax).toBe(97500)
    expect(r).toMatchObject({ better: 'old', annualSaving: 25740 })
  })
})

describe('hraExemption', () => {
  const base = { basicAnnual: 600000, hraReceivedAnnual: 300000, rentPaidAnnual: 240000 }

  test('is the least of actual HRA, rent − 10% of salary and 50%/40% of salary', () => {
    const r = hraExemption({ ...base, metro: true })
    expect(r.limits).toEqual({ actualHraReceived: 300000, rentMinus10PercentOfSalary: 180000, percentOfSalary: 300000 })
    expect(r.exemption).toBe(180000)
    expect(r.taxableHra).toBe(120000)
  })

  test('uses 40% of salary outside the four metros', () => {
    const r = hraExemption({ ...base, rentPaidAnnual: 400000, city: 'Bengaluru' })
    expect(r.metro).toBe(false)
    expect(r.exemption).toBe(240000)
  })

  test('recognises metro cities by name', () => {
    expect(hraExemption({ ...base, city: 'Mumbai' }).metro).toBe(true)
  })

  test('is zero when no rent is paid', () => {
    expect(hraExemption({ ...base, rentPaidAnnual: 0, metro: true }).exemption).toBe(0)
  })
})

describe('oldRegimeBestCase', () => {
  test('nothing beats a new-regime tax of ₹0', () => {
    expect(oldRegimeBestCase(900000, { hraReceived: 180000, basicPlusDa: 450000 })).toMatchObject({ newTax: 0, couldSave: 0 })
  })

  test('counts full 80C, NPS, ₹50,000 80D and the HRA (up to half of basic)', () => {
    // ₹24 L: 24 L − 50k std − 6 L HRA − 1.5 L − 50k − 50k = ₹15 L taxable → ₹2,73,000; new regime ₹2,92,500
    expect(oldRegimeBestCase(2400000, { hraReceived: 600000, basicPlusDa: 1200000 }))
      .toEqual({ newTax: 292500, bestOldTax: 273000, couldSave: 19500 })
    // HRA above half of basic doesn't count
    expect(oldRegimeBestCase(2400000, { hraReceived: 900000, basicPlusDa: 1200000 }).bestOldTax).toBe(273000)
  })
})
