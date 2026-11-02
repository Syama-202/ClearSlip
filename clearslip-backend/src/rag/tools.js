import { newRegimeTax, oldRegimeTax, compareRegimes, hraExemption } from '../services/taxCalculator.js'

// Optional deduction inputs shared by the tax tools (all annual rupees)
const DEDUCTION_PROPERTIES = {
  section_80c: { type: 'number', description: 'Section 80C investments incl. employee PF, old regime (cap ₹1,50,000)' },
  section_80ccd_1b: { type: 'number', description: 'Own NPS contribution under 80CCD(1B), old regime (cap ₹50,000)' },
  section_80d: { type: 'number', description: 'Health insurance premiums under 80D, old regime' },
  hra_exemption: { type: 'number', description: 'HRA exemption amount (use calculate_hra_exemption first), old regime' },
  professional_tax: { type: 'number', description: 'Professional tax paid in the year, old regime (cap ₹2,500)' },
  home_loan_interest: { type: 'number', description: 'Home loan interest, self-occupied, old regime (cap ₹2,00,000)' },
  employer_nps: { type: 'number', description: "Employer's NPS contribution under 80CCD(2), both regimes" },
  basic_plus_da: { type: 'number', description: 'Annual basic salary + DA, used to cap employer NPS' },
}

/** Tool definitions in the OpenAI/Groq function-calling format. */
export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'compare_tax_regimes',
      description: 'Calculate FY 2025-26 income tax under both the new and old regime for a salaried person and say which is lower. Use for any "which regime" or "how much tax" question.',
      parameters: {
        type: 'object',
        properties: {
          annual_gross_salary: { type: 'number', description: 'Total yearly gross salary in rupees' },
          ...DEDUCTION_PROPERTIES,
        },
        required: ['annual_gross_salary'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_tax',
      description: 'Calculate FY 2025-26 income tax under one regime, with a breakdown (standard deduction, taxable income, rebate, cess).',
      parameters: {
        type: 'object',
        properties: {
          regime: { type: 'string', enum: ['new', 'old'] },
          annual_gross_salary: { type: 'number', description: 'Total yearly gross salary in rupees' },
          ...DEDUCTION_PROPERTIES,
        },
        required: ['regime', 'annual_gross_salary'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_hra_exemption',
      description: 'Calculate the HRA exemption under section 10(13A) (old regime) from yearly basic, HRA received and rent paid.',
      parameters: {
        type: 'object',
        properties: {
          basic_annual: { type: 'number', description: 'Yearly basic salary' },
          da_annual: { type: 'number', description: 'Yearly dearness allowance, if any' },
          hra_received_annual: { type: 'number', description: 'Yearly HRA received from the employer' },
          rent_paid_annual: { type: 'number', description: 'Yearly rent paid' },
          city: { type: 'string', description: 'City the employee lives in' },
        },
        required: ['basic_annual', 'hra_received_annual', 'rent_paid_annual'],
      },
    },
  },
]

function deductionsFrom(args) {
  return {
    section80C: args.section_80c,
    section80CCD1B: args.section_80ccd_1b,
    section80D: args.section_80d,
    hraExemption: args.hra_exemption,
    professionalTax: args.professional_tax,
    homeLoanInterest: args.home_loan_interest,
    employerNps: args.employer_nps,
    basicPlusDa: args.basic_plus_da,
  }
}

/** Runs a tool the model asked for. Errors are returned as data so the model can recover. */
export function executeTool(name, args = {}) {
  switch (name) {
    case 'compare_tax_regimes':
      return compareRegimes(args.annual_gross_salary, deductionsFrom(args))
    case 'calculate_tax':
      return args.regime === 'old'
        ? oldRegimeTax(args.annual_gross_salary, deductionsFrom(args))
        : newRegimeTax(args.annual_gross_salary, deductionsFrom(args))
    case 'calculate_hra_exemption':
      return hraExemption({
        basicAnnual: args.basic_annual,
        daAnnual: args.da_annual,
        hraReceivedAnnual: args.hra_received_annual,
        rentPaidAnnual: args.rent_paid_annual,
        city: args.city,
      })
    default:
      return { error: `Unknown tool: ${name}` }
  }
}
