import { test, expect } from '@playwright/test'

// "Save as PDF" uses the browser's print view. This renders the decoded sample
// payslip the same way and checks what must and mustn't be on paper. Set
// SAVE_PRINT_PDF=<file> to also write the PDF out and look at it.
test('the printed payslip shows the figures and leaves out the page furniture', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a sample payslip' }).first().click()
  await expect(page.getByText('₹67,300').first()).toBeVisible()

  await page.emulateMedia({ media: 'print' })
  for (const visible of ['Your payslip, decoded', 'Payslip breakdown', 'What to do next', '₹67,300']) {
    await expect(page.getByText(visible).first()).toBeVisible()
  }
  // Buttons, the input panel, the AI chat and the footer are screen-only
  for (const hidden of [
    page.getByRole('button', { name: 'Save as PDF' }),
    page.getByRole('button', { name: /Check & correct figures/ }),
    page.getByRole('heading', { name: 'Share your payslip' }),
    page.getByRole('contentinfo'),
  ]) {
    await expect(hidden).toBeHidden()
  }

  const pdf = await page.pdf({ format: 'A4', printBackground: true, path: process.env.SAVE_PRINT_PDF })
  expect(pdf.length).toBeGreaterThan(10_000)
})
