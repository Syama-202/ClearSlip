import { compareRegimes, hraExemption, oldRegimeBreakEven } from './taxCalculator.js'

const SECTION_80C_CAP = 150000

/**
 * The what-if simulator: the user's payslip figures plus the deductions they
 * are trying out, run through the same calculators the decoder and Ask
 * ClearSlip use. All amounts are annual rupees except `rentPaidMonthly`.
 */
export function simulateTax({
  grossAnnual, basicAnnual = 0, daAnnual = 0, hraReceivedAnnual = 0,
  employeePfAnnual = 0, professionalTaxAnnual = 0,
  extra80C = 0, nps80CCD1B = 0, health80D = 0,
  rentPaidMonthly = 0, metro = false, homeLoanInterest = 0,
}) {
  const basicPlusDa = basicAnnual + daAnnual

  // HRA is only exempt when the payslip pays HRA and rent is actually paid
  const hra = hraReceivedAnnual > 0 && rentPaidMonthly > 0
    ? hraExemption({ basicAnnual, daAnnual, hraReceivedAnnual, rentPaidAnnual: rentPaidMonthly * 12, metro })
    : null

  // Employee PF already counts towards 80C, so it uses up part of the ₹1.5 lakh
  const pfIn80C = Math.min(employeePfAnnual, SECTION_80C_CAP)
  const section80C = {
    fromPf: pfIn80C,
    extra: Math.min(extra80C, SECTION_80C_CAP - pfIn80C),
    cap: SECTION_80C_CAP,
  }

  const comparison = compareRegimes(grossAnnual, {
    section80C: section80C.fromPf + section80C.extra,
    section80CCD1B: nps80CCD1B,
    section80D: health80D,
    hraExemption: hra?.exemption ?? 0,
    professionalTax: professionalTaxAnnual,
    homeLoanInterest,
    basicPlusDa,
  })

  const currentDeductions = Object.values(comparison.oldRegime.deductions).reduce((a, b) => a + b, 0)
  const { deductionsNeeded } = oldRegimeBreakEven(grossAnnual, { basicPlusDa })

  return {
    ...comparison,
    hra,
    section80C,
    breakEven: {
      currentDeductions,
      deductionsNeeded,
      shortfall: Math.max(0, deductionsNeeded - currentDeductions),
    },
  }
}
