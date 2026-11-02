/**
 * Deterministic income-tax calculators for salaried individuals, FY 2025-26.
 * Used by the rules engine (new-regime estimate) and as tools the Ask
 * ClearSlip assistant calls, so the LLM never does tax arithmetic itself.
 *
 * All amounts are annual rupees. Surcharge (income above ₹50 lakh) is not
 * modelled — results flag it via `surchargeNotModelled`.
 */

const CESS_RATE = 0.04
const SURCHARGE_THRESHOLD = 5000000

const NEW_REGIME = {
  standardDeduction: 75000,
  rebateLimit: 1200000,         // 87A: no tax up to this taxable income
  slabs: [
    { upto: 400000, rate: 0 },
    { upto: 800000, rate: 0.05 },
    { upto: 1200000, rate: 0.10 },
    { upto: 1600000, rate: 0.15 },
    { upto: 2000000, rate: 0.20 },
    { upto: 2400000, rate: 0.25 },
    { upto: Infinity, rate: 0.30 },
  ],
}

const OLD_REGIME = {
  standardDeduction: 50000,
  rebateLimit: 500000,          // 87A: up to ₹12,500 rebate at or below this
  maxRebate: 12500,
  slabs: [
    { upto: 250000, rate: 0 },
    { upto: 500000, rate: 0.05 },
    { upto: 1000000, rate: 0.20 },
    { upto: Infinity, rate: 0.30 },
  ],
}

// Old-regime deduction caps (per year)
const CAPS = {
  section80C: 150000,
  section80CCD1B: 50000,
  section80D: 100000,           // self/family + parents, highest case (both senior)
  professionalTax: 2500,
  homeLoanInterest: 200000,     // section 24(b), self-occupied
}

// Employer NPS (80CCD(2)) is allowed as a % of salary (basic + DA)
const EMPLOYER_NPS_LIMIT = { new: 0.14, old: 0.10 }

function slabTax(taxable, slabs) {
  let tax = 0
  let lower = 0
  for (const slab of slabs) {
    if (taxable <= lower) break
    tax += (Math.min(taxable, slab.upto) - lower) * slab.rate
    lower = slab.upto
  }
  return tax
}

const toAmount = v => Math.max(0, Number(v) || 0)

function employerNpsDeduction(employerNps, basicPlusDa, regime) {
  const claimed = toAmount(employerNps)
  if (!claimed) return 0
  // Without the salary figure the % limit can't be checked, so take it as given
  return basicPlusDa ? Math.min(claimed, toAmount(basicPlusDa) * EMPLOYER_NPS_LIMIT[regime]) : claimed
}

function finish(result, taxBeforeRebate, rebate, marginalRelief) {
  const taxAfterRebate = Math.max(0, taxBeforeRebate - rebate - marginalRelief)
  const cess = taxAfterRebate * CESS_RATE
  return {
    ...result,
    taxBeforeRebate: Math.round(taxBeforeRebate),
    rebate87A: Math.round(rebate),
    marginalRelief: Math.round(marginalRelief),
    cess: Math.round(cess),
    totalTax: Math.round(taxAfterRebate + cess),
    monthlyTax: Math.round((taxAfterRebate + cess) / 12),
    surchargeNotModelled: result.grossSalary > SURCHARGE_THRESHOLD,
  }
}

/** New Regime (default): standard deduction, employer NPS, 87A rebate up to ₹12L with marginal relief. */
export function newRegimeTax(grossSalary, { employerNps = 0, basicPlusDa = 0 } = {}) {
  const gross = toAmount(grossSalary)
  const deductions = { employerNps80CCD2: Math.round(employerNpsDeduction(employerNps, basicPlusDa, 'new')) }
  const taxableIncome = Math.max(0, gross - NEW_REGIME.standardDeduction - deductions.employerNps80CCD2)

  const tax = slabTax(taxableIncome, NEW_REGIME.slabs)
  let rebate = 0
  let marginalRelief = 0
  if (taxableIncome <= NEW_REGIME.rebateLimit) rebate = tax
  else marginalRelief = Math.max(0, tax - (taxableIncome - NEW_REGIME.rebateLimit))

  return finish(
    { regime: 'new', grossSalary: gross, standardDeduction: NEW_REGIME.standardDeduction, deductions, taxableIncome: Math.round(taxableIncome) },
    tax, rebate, marginalRelief,
  )
}

/** Old Regime: standard deduction plus the chapter VI-A / HRA / home-loan deductions, each capped. */
export function oldRegimeTax(grossSalary, {
  section80C = 0, section80CCD1B = 0, section80D = 0, hraExemption = 0,
  professionalTax = 0, homeLoanInterest = 0, employerNps = 0, basicPlusDa = 0,
} = {}) {
  const gross = toAmount(grossSalary)
  const deductions = {
    hraExemption: Math.round(toAmount(hraExemption)),
    professionalTax: Math.min(toAmount(professionalTax), CAPS.professionalTax),
    section80C: Math.min(toAmount(section80C), CAPS.section80C),
    section80CCD1B: Math.min(toAmount(section80CCD1B), CAPS.section80CCD1B),
    section80D: Math.min(toAmount(section80D), CAPS.section80D),
    homeLoanInterest24b: Math.min(toAmount(homeLoanInterest), CAPS.homeLoanInterest),
    employerNps80CCD2: Math.round(employerNpsDeduction(employerNps, basicPlusDa, 'old')),
  }
  const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
  const taxableIncome = Math.max(0, gross - OLD_REGIME.standardDeduction - totalDeductions)

  const tax = slabTax(taxableIncome, OLD_REGIME.slabs)
  const rebate = taxableIncome <= OLD_REGIME.rebateLimit ? Math.min(tax, OLD_REGIME.maxRebate) : 0

  return finish(
    { regime: 'old', grossSalary: gross, standardDeduction: OLD_REGIME.standardDeduction, deductions, taxableIncome: Math.round(taxableIncome) },
    tax, rebate, 0,
  )
}

/** Both regimes side by side, with which one costs less. */
export function compareRegimes(grossSalary, deductions = {}) {
  const newRegime = newRegimeTax(grossSalary, deductions)
  const oldRegime = oldRegimeTax(grossSalary, deductions)
  const difference = Math.abs(newRegime.totalTax - oldRegime.totalTax)
  const better = newRegime.totalTax === oldRegime.totalTax ? 'same' : newRegime.totalTax < oldRegime.totalTax ? 'new' : 'old'
  return { newRegime, oldRegime, better, annualSaving: difference }
}

// Section 10(13A) / Rule 2A: metro cities get 50% of salary, others 40%
const METRO_CITIES = ['delhi', 'new delhi', 'mumbai', 'kolkata', 'chennai']

/**
 * HRA exemption (old regime only) = the least of: HRA received; rent paid
 * minus 10% of salary; 50% (metro) or 40% (non-metro) of salary.
 * "Salary" here is basic + DA. Pass `metro` or a `city` name.
 */
export function hraExemption({ basicAnnual, daAnnual = 0, hraReceivedAnnual, rentPaidAnnual, metro, city }) {
  const salary = toAmount(basicAnnual) + toAmount(daAnnual)
  const isMetro = metro ?? METRO_CITIES.includes(String(city || '').trim().toLowerCase())
  const limits = {
    actualHraReceived: toAmount(hraReceivedAnnual),
    rentMinus10PercentOfSalary: Math.max(0, toAmount(rentPaidAnnual) - 0.1 * salary),
    percentOfSalary: (isMetro ? 0.5 : 0.4) * salary,
  }
  const exemption = Math.min(...Object.values(limits))
  return {
    salaryForHra: Math.round(salary),
    metro: isMetro,
    limits: Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, Math.round(v)])),
    exemption: Math.round(exemption),
    taxableHra: Math.round(limits.actualHraReceived - exemption),
    note: 'HRA exemption is available only under the old regime.',
  }
}

/** Annual new-regime tax on a gross salary — the rules engine's estimate when TDS isn't on the payslip. */
export function estimateAnnualTax(annualGross) {
  return newRegimeTax(annualGross).totalTax
}
