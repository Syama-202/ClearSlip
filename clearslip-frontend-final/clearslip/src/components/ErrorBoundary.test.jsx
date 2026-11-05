import { describe, test, expect, vi, onTestFinished } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

function Broken() {
  throw new Error('render bug')
}

// React reports a caught render error to the window as well; jsdom would print it
const quiet = event => event.preventDefault()

function renderCrash() {
  vi.spyOn(console, 'error').mockImplementation(() => {}) // React logs the caught error
  window.addEventListener('error', quiet)
  onTestFinished(() => window.removeEventListener('error', quiet))
  const reload = vi.fn()
  vi.stubGlobal('location', { ...window.location, reload })
  render(<ErrorBoundary><Broken /></ErrorBoundary>)
  return reload
}

describe('ErrorBoundary', () => {
  test('shows what happened and a way back instead of a blank page', () => {
    const reload = renderCrash()
    expect(screen.getByRole('alert').textContent).toMatch(/Something went wrong on this page/)
    expect(screen.getByRole('alert').textContent).toMatch(/Nothing was sent or saved/)
    fireEvent.click(screen.getByRole('button', { name: /Reload ClearSlip/ }))
    expect(reload).toHaveBeenCalled()
    // Nothing saved, so nothing to offer to clear
    expect(screen.queryByRole('button', { name: /Clear saved payslips/ })).toBeNull()
    vi.unstubAllGlobals()
  })

  // Re-audit R5: saved data the page can't read is the one cause a reload doesn't fix
  test('offers to clear saved payslips, and does, when some are saved', () => {
    localStorage.setItem('clearslip.history.v1', '[{"id":"x"}]')
    const reload = renderCrash()
    fireEvent.click(screen.getByRole('button', { name: /Clear saved payslips and reload/ }))
    expect(localStorage.getItem('clearslip.history.v1')).toBeNull()
    expect(reload).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
