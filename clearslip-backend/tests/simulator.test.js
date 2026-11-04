import request from 'supertest'
import { simulateTax } from '../src/services/taxSimulator.js'
import { oldRegimeBreakEven } from '../src/services/taxCalculator.js'

const { default: app } = await import('../src/app.js')

// The sample payslip: ₹75,000/month gross, basic ₹37,500, HRA ₹15,000, PF ₹4,500, PT ₹200
const payslip = {
  grossAnnual: 900000,
  basicAnnual: 450000,
  hraReceivedAnnual: 180000,
  employeePfAnnual: 54000,
  professionalTaxAnnual: 2400,
}

describe('oldRegimeBreakEven', () => {
  test('₹9L: old regime needs taxable income ≤ ₹5L to match the new regime\'s ₹0', () => {
    // 9,00,000 − 50,000 standard deduction − D ≤ 5,00,000  →  D = 3,50,000
    expect(oldRegimeBreakEven(900000)).toEqual({ newRegimeTax: 0, deductionsNeeded: 350000 })
  })

  test('₹18L: deductions where old-regime tax falls to the new regime\'s ₹1,50,800', () => {
    // Old slab tax must be 1,45,000 → 1,12,500 + 30% × (T − 10,00,000) → T ≈ 11,08,334 → D = 17,50,000 − T
    expect(oldRegimeBreakEven(1800000)).toEqual({ newRegimeTax: 150800, deductionsNeeded: 641666 })
  })
})

describe('simulateTax', () => {
  test('payslip alone: PF and professional tax are the only old-regime deductions', () => {
    const r = simulateTax(payslip)
    expect(r.newRegime.totalTax).toBe(0)
    expect(r.oldRegime.totalTax).toBe(74069)
    expect(r.better).toBe('new')
    expect(r.hra).toBeNull()
    expect(r.breakEven).toEqual({ currentDeductions: 56400, deductionsNeeded: 350000, shortfall: 293600 })
  })

  test('rent unlocks the HRA exemption (40% outside the metros)', () => {
    const r = simulateTax({ ...payslip, rentPaidMonthly: 20000 })
    expect(r.hra.exemption).toBe(180000)
    // Taxable 9,00,000 − 50,000 − 1,80,000 − 54,000 − 2,400 = 6,13,600 → (12,500 + 22,720) × 1.04
    expect(r.oldRegime.totalTax).toBe(36629)
    expect(r.breakEven.shortfall).toBe(113600)
  })

  test('PF uses up part of 80C, so extra investments are capped at what is left', () => {
    const r = simulateTax({ ...payslip, extra80C: 200000 })
    expect(r.section80C).toEqual({ fromPf: 54000, extra: 96000, cap: 150000 })
    expect(r.oldRegime.deductions.section80C).toBe(150000)
  })

  test('enough deductions make the old regime match the new one', () => {
    const r = simulateTax({ ...payslip, rentPaidMonthly: 25000, extra80C: 96000, nps80CCD1B: 50000, health80D: 25000 })
    expect(r.oldRegime.totalTax).toBe(0)
    expect(r.better).toBe('same')
    expect(r.breakEven.shortfall).toBe(0)
  })

  test('rent gives no exemption when the payslip has no HRA', () => {
    expect(simulateTax({ ...payslip, hraReceivedAnnual: 0, rentPaidMonthly: 20000 }).hra).toBeNull()
  })
})

describe('POST /api/tax/simulate', () => {
  test('returns both regimes and the break-even point', async () => {
    const res = await request(app).post('/api/tax/simulate').send({ ...payslip, health80D: 25000, metro: true })
    expect(res.status).toBe(200)
    expect(res.body.data.newRegime.totalTax).toBe(0)
    expect(res.body.data.oldRegime.deductions.section80D).toBe(25000)
    expect(res.body.data.breakEven.deductionsNeeded).toBe(350000)
  })

  test('rejects a missing salary', async () => {
    const res = await request(app).post('/api/tax/simulate').send({ health80D: 25000 })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  test('rejects negative amounts', async () => {
    const res = await request(app).post('/api/tax/simulate').send({ grossAnnual: 900000, extra80C: -5000 })
    expect(res.status).toBe(400)
  })
})
