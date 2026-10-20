// Phase 8 TEST LIST: stage/Hud.resume.test.jsx. Round 3 Phase R3-2 (plan-r3 V5, V8, V12, V13): the HUD
// "Résumé" button switches to the résumé view (a pushed #resume entry, focus on its heading), and
// "← Laptop view" goes back to the laptop with focus on the HUD's résumé button.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithApp } from '../test/renderWithApp.jsx'
import { setReducedMotion } from '../test/setup.js'
import Stage from './Stage.jsx'
import Resume from '../resume/Resume.jsx'

const pending = () => new Promise(() => {})

describe('stage/Hud Résumé button', () => {
  beforeEach(() => {
    // Reduced motion: the switches are instant, so the test needs no timers.
    setReducedMotion(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('switches to the résumé view: data-view resume, #resume in the URL, the h1 focused, and no scrollIntoView', () => {
    const { container } = renderWithApp(
      <>
        <Stage />
        <Resume />
      </>,
      { loadScene: vi.fn(pending) },
    )
    const hud = within(container.querySelector('.hud'))
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView')
    fireEvent.click(hud.getByRole('button', { name: 'Résumé' }))

    expect(document.documentElement.getAttribute('data-view')).toBe('resume')
    expect(window.location.hash).toBe('#resume')
    expect(document.getElementById('resume-title')).toHaveFocus()
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it('"← Laptop view" goes back one history entry, shows the laptop, and focuses the HUD résumé button', () => {
    // The HUD and its focus target count as visible (jsdom has no layout).
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function getClientRects() {
      return this.closest('[hidden]') ? [] : [{}]
    })
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const { container } = renderWithApp(
      <>
        <Stage />
        <Resume />
      </>,
      { loadScene: vi.fn(pending) },
    )
    fireEvent.click(within(container.querySelector('.hud')).getByRole('button', { name: 'Résumé' }))
    expect(document.documentElement.getAttribute('data-view')).toBe('resume')

    fireEvent.click(screen.getByRole('button', { name: 'Laptop view' }))

    expect(back).toHaveBeenCalledTimes(1)
    expect(document.documentElement.getAttribute('data-view')).toBe('laptop')
    expect(document.getElementById('hud-resume')).toHaveFocus()
  })
})
