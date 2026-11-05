import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import BreakdownTable from './BreakdownTable'

// A bonus month, as the server returns it (Phase 7: one-off pay counts once a year)
const breakdown = [
  { component: 'Basic Salary', type: 'earning', monthly: 40000, annual: 480000 },
  { component: 'Bonus / Incentive', type: 'earning', monthly: 150000, annual: 150000, oneOff: true },
  { component: 'Provident Fund (PF)', type: 'deduction', monthly: 4800, annual: 57600 },
]
const unplaced = [
  { text: 'Night Allowance 2,000', component: 'Night Allowance', monthly: 2000, suggestedType: 'earning' },
]

const footer = () => within(screen.getByRole('rowheader', { name: 'Take-home' }).closest('tr'))

describe('BreakdownTable', () => {
  test('marks one-off pay and adds it to the year once, not 12 times', () => {
    render(<BreakdownTable breakdown={breakdown} />)
    expect(screen.getByText('One-off · counted once a year')).toBeTruthy()
    // ₹4,80,000 + ₹1,50,000 − ₹57,600, not (₹40,000 + ₹1,50,000 − ₹4,800) × 12
    expect(footer().getByText('₹5,72,400')).toBeTruthy()
    expect(footer().getByText('₹1,85,200')).toBeTruthy()
  })

  test('lists lines it could not place, without adding them to the figures', () => {
    render(<BreakdownTable breakdown={breakdown} unplaced={unplaced} onRecalculate={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /Lines we couldn't place/ })).toBeTruthy()
    expect(screen.getByText('Night Allowance 2,000')).toBeTruthy()
    expect(footer().getByText('₹1,85,200')).toBeTruthy()
  })

  test('"Add as earning" opens the editor with the line filled in, and sends it with the one-off flags', async () => {
    const onRecalculate = vi.fn().mockResolvedValue()
    render(<BreakdownTable breakdown={breakdown} unplaced={unplaced} onRecalculate={onRecalculate} />)
    fireEvent.click(screen.getByRole('button', { name: /Add as earning/ }))

    expect(screen.getByRole('heading', { name: /Check & correct figures/ })).toBeTruthy()
    expect(screen.getByLabelText('Row 4 name').value).toBe('Night Allowance')
    expect(screen.getByLabelText('Row 4 monthly amount').value).toBe('2000')
    expect(screen.getByLabelText('Row 2 type').value).toBe('earning-once')

    // Mark the bonus as regular pay instead
    fireEvent.change(screen.getByLabelText('Row 2 type'), { target: { value: 'earning' } })
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }))

    await vi.waitFor(() => expect(onRecalculate).toHaveBeenCalled())
    expect(onRecalculate.mock.calls[0][0]).toEqual([
      { component: 'Basic Salary', type: 'earning', monthly: 40000, oneOff: false },
      { component: 'Bonus / Incentive', type: 'earning', monthly: 150000, oneOff: false },
      { component: 'Provident Fund (PF)', type: 'deduction', monthly: 4800, oneOff: false },
      { component: 'Night Allowance', type: 'earning', monthly: 2000, oneOff: false },
    ])
  })

  test('shows a server error in the editor and keeps the rows', async () => {
    const onRecalculate = vi.fn().mockRejectedValue(new Error('With these figures your take-home comes to zero or less.'))
    render(<BreakdownTable breakdown={breakdown} onRecalculate={onRecalculate} />)
    fireEvent.click(screen.getByRole('button', { name: /Check & correct figures/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/zero or less/)
    expect(screen.getByLabelText('Row 1 name').value).toBe('Basic Salary')
  })
})
