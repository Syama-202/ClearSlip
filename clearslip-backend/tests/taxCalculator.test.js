import { estimateAnnualTax } from '../src/services/rulesEngine.js'

// Gross figures include the ₹75,000 standard deduction, so taxable = gross − 75,000.
// Expected values are slab tax (after marginal relief) × 1.04 cess.
describe('estimateAnnualTax — New Regime FY2025-26', () => {
  test.each([
    [0, 0],
    [475000, 0],          // taxable ₹4L — top of the nil slab
    [1000000, 0],         // taxable ₹9.25L — under the rebate limit
    [1275000, 0],         // taxable exactly ₹12L — rebate still applies
  ])('gross ₹%i → ₹%i (87A rebate)', (gross, tax) => {
    expect(estimateAnnualTax(gross)).toBe(tax)
  })

  test.each([
    [1276000, 1040],      // ₹1,000 above the limit → tax capped at ₹1,000
    [1325000, 52000],     // taxable ₹12.5L: slab ₹67,500 > cap ₹50,000
  ])('gross ₹%i → ₹%i (marginal relief)', (gross, tax) => {
    expect(estimateAnnualTax(gross)).toBe(tax)
  })

  test.each([
    [1375000, 78000],     // taxable ₹13L: slab ₹75,000 < cap, so no relief
    [1675000, 124800],    // taxable ₹16L: 20k + 40k + 60k
    [2075000, 208000],    // taxable ₹20L: + 80k
    [2475000, 312000],    // taxable ₹24L: + 100k
    [3000000, 475800],    // taxable ₹29.25L: + 30% on ₹5.25L
  ])('gross ₹%i → ₹%i (slab boundaries)', (gross, tax) => {
    expect(estimateAnnualTax(gross)).toBe(tax)
  })

  test('never charges more than the income above the rebate limit', () => {
    for (let gross = 1275000; gross <= 1400000; gross += 5000) {
      const taxable = gross - 75000
      expect(estimateAnnualTax(gross)).toBeLessThanOrEqual(Math.round((taxable - 1200000) * 1.04))
    }
  })
})
