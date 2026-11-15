import { describe, test, expect } from 'vitest'
import { loadHistory, savePayslip, deletePayslip, isValidEntry, hasSavedPayslips, yearSoFar } from './history'

const KEY = 'clearslip.history.v1'

const result = {
  summary: { takeHome: 67300, tds: 36000 },
  breakdown: [
    { component: 'Basic Salary', type: 'earning', monthly: 37500, annual: 450000, source: 'Name: Ravi | Basic 37,500' },
    { component: 'PF', type: 'deduction', monthly: 4500, annual: 54000 },
  ],
  actionItems: [],
  checklistToken: 'a'.repeat(64),
  unplaced: [{ text: 'Ravi Kumar 1234', component: 'Ravi Kumar', monthly: 1234, suggestedType: 'earning' }],
}

describe('savePayslip', () => {
  test('keeps the figures, but not the payslip lines, unplaced lines or the token', () => {
    const [entry] = savePayslip('2026-10', result)
    expect(entry.month).toBe('2026-10')
    expect(entry.result.breakdown[0]).not.toHaveProperty('source')
    expect(entry.result).not.toHaveProperty('unplaced')
    expect(entry.result).not.toHaveProperty('checklistToken')
    expect(localStorage.getItem(KEY)).not.toMatch(/Ravi/)
  })

  test('a second save for the same month replaces the first; newest month first', () => {
    savePayslip('2026-09', result)
    savePayslip('2026-10', result)
    const entries = savePayslip('2026-10', { ...result, summary: { takeHome: 70000 } })
    expect(entries.map(e => e.month)).toEqual(['2026-10', '2026-09'])
    expect(entries[0].result.summary.takeHome).toBe(70000)
  })

  test('deletes one entry', () => {
    const [entry] = savePayslip('2026-10', result)
    expect(deletePayslip(entry.id)).toEqual([])
  })
})

// Re-audit R5: one malformed entry crashed the Payslip page on every load
describe('loadHistory with damaged storage', () => {
  test('skips entries the page could not show, and removes them for good', () => {
    const [good] = savePayslip('2026-10', result)
    const bad = [{ id: 'x', month: '2026-10', result: { engine: 'rules' } }, { id: 'y' }, null, 'text']
    localStorage.setItem(KEY, JSON.stringify([good, ...bad]))

    expect(loadHistory().map(e => e.id)).toEqual([good.id])
    expect(JSON.parse(localStorage.getItem(KEY))).toHaveLength(1)
  })

  test('copes with storage that is not a list, or not JSON', () => {
    localStorage.setItem(KEY, JSON.stringify({ month: '2026-10' }))
    expect(loadHistory()).toEqual([])
    expect(hasSavedPayslips()).toBe(false)
    localStorage.setItem(KEY, '{not json')
    expect(loadHistory()).toEqual([])
  })

  test.each([
    ['no month', e => { delete e.month }],
    ['a month that is not YYYY-MM', e => { e.month = 'October' }],
    ['no take-home', e => { delete e.result.summary.takeHome }],
    ['an empty breakdown', e => { e.result.breakdown = [] }],
    ['a row with a text amount', e => { e.result.breakdown[0].monthly = '37,500' }],
    ['a row of an unknown type', e => { e.result.breakdown[0].type = 'bonus' }],
    ['action items that are not a list', e => { e.result.actionItems = 'none' }],
  ])('rejects an entry with %s', (what, damage) => {
    const [entry] = savePayslip('2026-10', result)
    const copy = structuredClone(entry)
    damage(copy)
    expect(isValidEntry(entry)).toBe(true)
    expect(isValidEntry(copy)).toBe(false)
  })
})

describe('yearSoFar', () => {
  const month = (m, extra = []) => ({
    id: m, month: m,
    result: {
      summary: { takeHome: 60000 },
      breakdown: [
        { component: 'Basic Salary', type: 'earning', monthly: 70000, annual: 840000 },
        { component: 'TDS (Income Tax)', type: 'deduction', monthly: 6000, annual: 72000 },
        { component: 'Employee PF', type: 'deduction', monthly: 4000, annual: 48000 },
        ...extra,
      ],
    },
  })

  test('adds up the saved months of the newest financial year (April to March)', () => {
    const bonus = { component: 'Bonus / Incentive', type: 'earning', monthly: 50000, annual: 50000 }
    // March 2026 belongs to the year before, so it is left out
    const total = yearSoFar([month('2026-10', [bonus]), month('2026-04'), month('2026-03')])
    expect(total).toEqual({ label: 'FY 2026-27', months: 2, earnings: 190000, deductions: 20000, incomeTax: 12000, takeHome: 120000 })
  })

  test('January to March count towards the year that began the April before', () => {
    expect(yearSoFar([month('2027-01'), month('2026-12')])).toMatchObject({ label: 'FY 2026-27', months: 2 })
  })

  test('needs two saved months in the year', () => {
    expect(yearSoFar([])).toBeNull()
    expect(yearSoFar([month('2026-10'), month('2026-03')])).toBeNull()
  })
})
