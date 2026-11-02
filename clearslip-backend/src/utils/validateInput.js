import { z } from 'zod'

const imageSourceSchema = z.object({
  type: z.literal('base64'),
  media_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  data: z.string().min(100, 'Image data too short'),
})

const textContentSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1).max(8000),
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
        link: z.string().url().nullable().optional(),
      })
    )
    .min(1, 'At least one checklist item required')
    .max(10),
  payslipSummary: z
    .object({
      takeHome: z.number().optional(),
      ctc: z.number().optional(),
      tds: z.number().optional(),
      savingsPotential: z.number().optional(),
    })
    .optional(),
})

export function validate(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) {
    const messages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    const err = new Error(messages)
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }
  return result.data
}
