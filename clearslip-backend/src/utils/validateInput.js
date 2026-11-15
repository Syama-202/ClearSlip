import { z } from 'zod'
import { safeLink } from './safeLink.js'

// Optional link that must be https and on an official site (see safeLink.js)
const officialLink = z.string().refine(url => safeLink(url) !== null, 'Links must be https and on an official site').nullable().optional()

const imageSourceSchema = z.object({
  type: z.literal('base64'),
  media_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  data: z.string().min(100, 'Image data too short'),
})

const textContentSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1).max(12000),
  // Where the text came from: typed/pasted, or read from a file in the browser
  // (a PDF's text layer, or OCR, which also gets the ₹-misread correction)
  origin: z.enum(['typed', 'pdf', 'ocr']).optional(),
})

const imageContentSchema = z.object({
  type: z.literal('image'),
  source: imageSourceSchema,
})

const contentSchema = z.union([textContentSchema, imageContentSchema])

export const decodeRequestSchema = z.object({
  messages: z
    .array(contentSchema)
    .min(1, 'At least one message content block required')
    .max(5, 'Too many content blocks'),
})

export const checklistRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  userName: z.string().max(100).optional(),
  checklistItems: z
    .array(
      z.object({
        index: z.number().optional(),
        priority: z.enum(['high', 'medium', 'low']).optional(),
        action: z.string().min(1).max(500),
        link: officialLink,
      })
    )
    .min(1, 'At least one checklist item required')
    .max(10),
  payslipSummary: z
    .object({
      takeHome: z.number().optional(),
      ctc: z.number().optional(),
      tds: z.number().optional(),
      estimatedTax: z.number().optional(),
      savingsPotential: z.number().optional(),
    })
    .optional(),
  // Issued with the decode result; proves the checklist text came from ClearSlip
  checklistToken: z.string().regex(/^[a-f0-9]{64}$/, 'Missing or invalid checklist token'),
})

// Figures the user checked or corrected in the breakdown (POST /api/decode/recalculate)
export const recalculateRequestSchema = z.object({
  breakdown: z
    .array(z.object({
      component: z.string().trim().min(1, 'Every row needs a name').max(80),
      type: z.enum(['earning', 'deduction']),
      monthly: z.number().finite().min(-10000000).max(10000000),
      // Paid this month only (a bonus, arrears): counted once in the year
      oneOff: z.boolean().optional(),
    }))
    .min(1)
    .max(30),
})

// What the AI fallback must return before its figures are shown (sanity checks follow in llmFallbackService)
const rupees = z.number().finite().nonnegative()
export const fallbackResultSchema = z.object({
  summary: z.object({ takeHome: rupees, ctc: rupees, tds: rupees }).passthrough(),
  breakdown: z
    .array(z.object({
      component: z.string().min(1).max(80),
      type: z.enum(['earning', 'deduction']),
      monthly: rupees,
      annual: rupees,
      explanation: z.string().max(400).optional(),
    }))
    .min(1)
    .max(30)
    .refine(rows => rows.some(r => r.type === 'earning'), 'No earnings found'),
  // Not asked for any more (the rules engine writes them); ignored if the model adds some
  actionItems: z.array(z.unknown()).optional(),
  disclaimer: z.string().max(1000).optional(),
})

export const askRequestSchema = z.object({
  question: z.string().trim().min(2, 'Please type a question').max(500),
  // The decoded payslip, so answers can use the user's own figures
  payslip: z
    .object({
      summary: z.record(z.string(), z.number()).optional(),
      breakdown: z
        .array(z.object({
          component: z.string().max(80),
          type: z.enum(['earning', 'deduction']),
          monthly: z.number(),
          annual: z.number(),
        }).passthrough())
        .max(30),
    })
    .passthrough()
    .optional(),
  // Recent turns, for follow-up questions
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) }))
    .max(6)
    .optional(),
})

// "Was this helpful?" on an Ask ClearSlip answer. Passages are named by their
// knowledge-base ID ("hra-exemption#how-it-is-calculated"), never free text, so
// nothing a visitor types can end up in the log.
export const askFeedbackSchema = z.object({
  helpful: z.boolean(),
  mode: z.enum(['rag', 'retrieval-only']),
  sources: z.array(z.string().regex(/^[a-z0-9-]{1,60}#[a-z0-9-]{1,80}$/)).max(8).optional(),
  flagged: z.boolean().optional(),
})

// What-if simulator inputs, all annual rupees except monthly rent
const amount = (max) => z.number().min(0).max(max).optional()
export const simulateRequestSchema = z.object({
  grossAnnual: z.number().positive('Enter your yearly salary').max(100000000),
  basicAnnual: amount(100000000),
  daAnnual: amount(100000000),
  hraReceivedAnnual: amount(100000000),
  employeePfAnnual: amount(10000000),
  professionalTaxAnnual: amount(100000),
  extra80C: amount(10000000),
  nps80CCD1B: amount(10000000),
  health80D: amount(10000000),
  rentPaidMonthly: amount(10000000),
  metro: z.boolean().optional(),
  homeLoanInterest: amount(10000000),
})

export function validate(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) {
    const messages = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    const err = new Error(messages)
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }
  return result.data
}
