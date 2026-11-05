import { describe, test, expect } from 'vitest'
import { loadHistory, savePayslip, deletePayslip, isValidEntry, hasSavedPayslips } from './history'

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
