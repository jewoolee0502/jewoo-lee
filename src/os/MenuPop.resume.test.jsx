// Phase 8 TEST LIST: os/MenuPop.resume.test.jsx. ◆ JAY-OS → Résumé calls nav.goToResume once.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, within } from '@testing-library/react'
import { renderWithApp } from '../test/renderWithApp.jsx'
import OsPortal from './OsPortal.jsx'

describe('os/MenuPop Résumé item', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('on a booted OS, ◆ JAY-OS then Résumé calls nav.goToResume exactly once', () => {
    vi.useFakeTimers()
    const goToResume = vi.fn()
    const openLaptop = vi.fn()
    const { app } = renderWithApp(<OsPortal />, { nav: { goToResume, openLaptop } })

    act(() => {
      app.os.boot()
    })
    act(() => {
      vi.advanceTimersByTime(2200)
    })

    const logo = app.host.osEl.querySelector('#mb-logo')
    expect(logo).toHaveTextContent('◆ JAY-OS')
    fireEvent.click(logo)

    const menu = app.host.osEl.querySelector('#menu-pop')
    expect(menu).not.toBeNull()
    fireEvent.click(within(menu).getByRole('button', { name: 'Résumé' }))

    expect(goToResume).toHaveBeenCalledTimes(1)
    expect(openLaptop).not.toHaveBeenCalled()
  })
})
