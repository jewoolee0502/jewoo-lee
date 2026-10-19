// Phase 8 TEST LIST: stage/Hud.resume.test.jsx. The HUD "Résumé ↓" button scrolls to #resume via
// ctrl.goToResume and puts focus on the résumé heading (D11).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, within } from '@testing-library/react'
import { renderWithApp } from '../test/renderWithApp.jsx'
import Stage from './Stage.jsx'
import Resume from '../resume/Resume.jsx'

const pending = () => new Promise(() => {})

describe('stage/Hud Résumé ↓ button', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('scrolls the résumé into view (smooth, block start) and focuses its h1 when the scene is still loading', () => {
    const { container } = renderWithApp(
      <>
        <Stage />
        <Resume />
      </>,
      { loadScene: vi.fn(pending) },
    )
    const hud = within(container.querySelector('.hud'))
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView')
    fireEvent.click(hud.getByRole('button', { name: 'Résumé ↓' }))

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(document.getElementById('resume')).not.toBeNull()
    expect(document.getElementById('resume-title')).toHaveFocus()
  })
})
