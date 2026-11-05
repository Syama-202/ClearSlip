import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom doesn't lay pages out, so it has no scrolling (the chat scrolls to new answers)
Element.prototype.scrollIntoView = () => {}

// Each test starts with an empty page and nothing saved on the "device"
afterEach(() => {
  cleanup()
  localStorage.clear()
})
