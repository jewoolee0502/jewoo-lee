// Recruiter view focus trap: while the dialog is open, Tab and Shift+Tab stay inside .rec-card.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithApp } from '../test/renderWithApp.jsx'
import RecruiterView from './RecruiterView.jsx'

const pending = () => new Promise(() => {})

function openDialog() {
  const result = renderWithApp(<RecruiterView />, { loadScene: vi.fn(pending) })
  act(() => {
    result.app.ui.store.set({ recOpen: true })
  })
  const card = result.container.querySelector('.rec-card')
  const focusables = Array.from(
    card.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'),
  )
  return { ...result, card, first: focusables[0], last: focusables[focusables.length - 1] }
}

describe('stage/RecruiterView focus trap', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Tab on the last focusable in .rec-card moves focus to the first one', async () => {
    const user = userEvent.setup()
    const { first, last } = openDialog()
    last.focus()
    expect(last).toHaveFocus()
    await user.tab()
    expect(first).toHaveFocus()
    expect(first.closest('.rec-card')).not.toBeNull()
  })

  it('Shift+Tab on the first focusable in .rec-card moves focus to the last one', async () => {
    const user = userEvent.setup()
    const { first, last } = openDialog()
    first.focus()
    expect(first).toHaveFocus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()
    expect(last.closest('.rec-card')).not.toBeNull()
  })
})
