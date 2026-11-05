import { describe, test, expect } from 'vitest'
import { buildDecodeMessages } from './buildDecodeMessages'

describe('buildDecodeMessages', () => {
  test('sends pasted text exactly as typed, so "Read from" quotes the payslip', () => {
    expect(buildDecodeMessages('text', 'Basic 25,000\nPF 3,000')).toEqual([{ type: 'text', text: 'Basic 25,000\nPF 3,000' }])
  })

  test('wraps a description so the AI knows it is not a payslip', () => {
    const [message] = buildDecodeMessages('describe', 'My CTC is 8L')
    expect(message.type).toBe('text')
    expect(message.text).toMatch(/described their salary situation/)
    expect(message.text).toContain('"My CTC is 8L"')
  })

  test('sends an image as base64 with its type, followed by the instruction', () => {
    const messages = buildDecodeMessages('image', null, { mediaType: 'image/png', base64: 'iVBOR' })
    expect(messages[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBOR' } })
    expect(messages[1].type).toBe('text')
  })

  test('refuses an image mode without an image, and unknown modes', () => {
    expect(() => buildDecodeMessages('image', null, null)).toThrow(/No image/)
    expect(() => buildDecodeMessages('voice', 'hi')).toThrow(/Unknown input mode/)
  })
})
