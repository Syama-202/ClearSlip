import { redactPersonalData } from '../src/utils/redact.js'
import { safeLink } from '../src/utils/safeLink.js'
import { matchesMediaType } from '../src/services/ocrService.js'
import { containsAadhaar, verhoeffValid } from '../src/utils/aadhaar.js'

describe('redactPersonalData', () => {
  test('removes identifiers but keeps every salary figure', () => {
    const text = [
      'Employee Name: Ravi Kumar',
      'PAN: ABCDE1234F',
      'Bank A/c No: 50100234567812  IFSC HDFC0001234',
      'Phone 9876543210 ravi@example.com',
      'Aadhaar 1234 5678 9012',
      'Basic Salary 37,500 | Employee PF 4,500',
      'Net Pay 67,300',
    ].join('\n')
    const out = redactPersonalData(text)
    expect(out).not.toMatch(/Ravi|ABCDE1234F|50100234567812|HDFC0001234|9876543210|ravi@example\.com|1234 5678 9012/)
    expect(out).toContain('Basic Salary 37,500 | Employee PF 4,500')
    expect(out).toContain('Net Pay 67,300')
  })

  test('keeps the salary half of two-column lines', () => {
    const out = redactPersonalData('Employee Name: Ravi Kumar | Basic Salary 37,500\nEmp Code: AC1029    HRA 15,000\nPAN: ABCDE1234F\tSpecial Allowance 18,900')
    expect(out).toContain('Basic Salary 37,500')
    expect(out).toContain('HRA 15,000')
    expect(out).toContain('Special Allowance 18,900')
    expect(out).not.toMatch(/Ravi|AC1029|ABCDE1234F/)
  })

  test('leaves amounts written without commas alone', () => {
    expect(redactPersonalData('Annual CTC 1200000\nPF 3000')).toBe('Annual CTC 1200000\nPF 3000')
  })
})

describe('safeLink', () => {
  test.each([
    ['https://www.incometax.gov.in/iec/foportal/', 'https://www.incometax.gov.in/iec/foportal/'],
    ['https://enps.nsdl.com/', 'https://enps.nsdl.com/'],
    ['javascript:alert(1)', null],
    ['data:text/html,x', null],
    ['http://www.incometax.gov.in/', null],
    ['https://incometax.gov.in.evil.example/login', null],
    ['https://evil.example/?next=.gov.in', null],
    [undefined, null],
  ])('%s → %s', (url, expected) => {
    expect(safeLink(url)).toBe(expected)
  })
})

describe('matchesMediaType', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])

  test('accepts files whose bytes match their type', () => {
    expect(matchesMediaType(png, 'image/png')).toBe(true)
    expect(matchesMediaType(jpeg, 'image/jpeg')).toBe(true)
    expect(matchesMediaType(webp, 'image/webp')).toBe(true)
    expect(matchesMediaType(Buffer.from('%PDF-1.7\n...'), 'application/pdf')).toBe(true)
  })

  test('rejects mislabelled or junk files', () => {
    expect(matchesMediaType(jpeg, 'image/png')).toBe(false)
    expect(matchesMediaType(Buffer.from('x'.repeat(50)), 'image/png')).toBe(false)
    expect(matchesMediaType(png, 'application/pdf')).toBe(false)
  })
})

describe('containsAadhaar', () => {
  test('uses the Verhoeff check digit (textbook example: 236 → 2363)', () => {
    expect(verhoeffValid('2363')).toBe(true)
    expect(verhoeffValid('2364')).toBe(false)
  })

  test('finds a real-format Aadhaar number, with or without spaces', () => {
    expect(containsAadhaar('Aadhaar 2345 6789 0124')).toBe(true)
    expect(containsAadhaar('id 234567890124')).toBe(true)
  })

  test('ignores 12-digit numbers that cannot be Aadhaar numbers', () => {
    expect(containsAadhaar('Employee ID 202611041235')).toBe(false) // wrong check digit
    expect(containsAadhaar('UAN 100234567890')).toBe(false)       // starts with 1
  })
})
