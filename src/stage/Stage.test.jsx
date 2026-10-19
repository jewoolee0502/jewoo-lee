// Phase 3 TEST LIST: stage/Stage.test.jsx. Rendered through renderWithApp with loadScene overridable.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { StrictMode } from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithApp } from '../test/renderWithApp.jsx'
import Stage from './Stage.jsx'
import OsPortal from '../os/OsPortal.jsx'
import { PROJECTS } from '../content/index.js'

const pending = () => new Promise(() => {})
const NOTICE = '3D is unavailable in this browser, so JAY-OS runs flat. Everything still works.'

function fakeScene(counter) {
  return {
    createScene: () => {
      counter.created += 1
      return {
        dispose() {
          counter.disposed += 1
        },
      }
    },
  }
}

describe('stage/Stage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1. the HUD shows Recruiter view, Résumé ↓, ★ 0/13 and Sound: off with aria-pressed false', () => {
    const { container } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    const hud = within(container)
    expect(hud.getByRole('button', { name: 'Recruiter view' })).toBeInTheDocument()
    expect(hud.getByRole('button', { name: 'Résumé ↓' })).toBeInTheDocument()
    expect(hud.getByRole('button', { name: '★ 0/13' })).toBeInTheDocument()
    const sound = hud.getByRole('button', { name: /Sound: off/ })
    expect(sound).toHaveAttribute('aria-pressed', 'false')
  })

  it('1b. with jayos-ach preset to boot and term, the HUD shows ★ 2/13', () => {
    localStorage.setItem('jayos-ach', JSON.stringify(['boot', 'term']))
    const { container } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    expect(within(container).getByRole('button', { name: '★ 2/13' })).toBeInTheDocument()
  })

  it('2. clicking Sound: off shows Sound: on on the HUD button and on the menubar #mb-snd', () => {
    const { container, app } = renderWithApp(
      <>
        <Stage />
        <OsPortal />
      </>,
      { loadScene: vi.fn(pending) },
    )
    // The OS (and its menubar #mb-snd) sits in the stage's .park, inside the same container,
    // so the HUD button is found within .hud.
    const hud = within(container.querySelector('.hud'))
    fireEvent.click(hud.getByRole('button', { name: /Sound: off/ }))
    const hudSound = hud.getByRole('button', { name: /Sound: on/ })
    expect(hudSound).toHaveAttribute('aria-pressed', 'true')
    const mbSnd = app.host.osEl.querySelector('#mb-snd')
    expect(mbSnd).toHaveTextContent('Sound: on')
    expect(mbSnd).toHaveAttribute('aria-pressed', 'true')
  })

  describe('3. recruiter view', () => {
    function openRec() {
      const result = renderWithApp(<Stage />, {
        loadScene: vi.fn(pending),
        nav: { goToResume: vi.fn(), openLaptop: vi.fn() },
      })
      fireEvent.click(within(result.container).getByRole('button', { name: 'Recruiter view' }))
      const dialog = screen.getByRole('dialog', { name: 'Recruiter view' })
      return { ...result, dialog }
    }

    it('click opens the dialog named Recruiter view and focuses Back to the fun', () => {
      const { dialog } = openRec()
      expect(dialog).toBeVisible()
      expect(screen.getByRole('button', { name: 'Back to the fun' })).toHaveFocus()
    })

    it('shows the 9 projects line derived from content, with the three named projects', () => {
      expect(PROJECTS).toHaveLength(9)
      const { dialog } = openRec()
      expect(dialog).toHaveTextContent('9 projects, including RecycleWise (McGill capstone), WhenAreYouFree and Duonosaur')
    })

    it('GitHub and LinkedIn open in a new tab with noopener; CV (PDF) links to the CV file', () => {
      openRec()
      const github = screen.getByRole('link', { name: 'GitHub' })
      expect(github).toHaveAttribute('target', '_blank')
      expect(github.getAttribute('rel')).toContain('noopener')
      const linkedin = screen.getByRole('link', { name: 'LinkedIn' })
      expect(linkedin).toHaveAttribute('target', '_blank')
      expect(linkedin.getAttribute('rel')).toContain('noopener')
      const cv = screen.getByRole('link', { name: 'CV (PDF)' })
      expect(cv).toHaveAttribute('href', '/files/JEWOOLEE_CV.pdf')
      expect(cv).toHaveAttribute('download')
    })

    it('Escape closes it', () => {
      const { dialog } = openRec()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(dialog).not.toBeVisible()
    })

    it('a click on the backdrop closes it, but a click on the card text does not', () => {
      const { dialog, container } = openRec()
      fireEvent.click(screen.getByRole('heading', { name: 'Jewoo (Jay) Lee' }))
      expect(dialog).toBeVisible()
      fireEvent.click(container.querySelector('.rec'))
      expect(dialog).not.toBeVisible()
    })

    it('Full résumé ↓ calls nav.goToResume and closes the view', () => {
      const { dialog, app } = openRec()
      fireEvent.click(screen.getByRole('button', { name: 'Full résumé ↓' }))
      expect(app.nav.goToResume).toHaveBeenCalledTimes(1)
      expect(dialog).not.toBeVisible()
    })
  })

  it('4. clicking ★ 0/13 calls nav.openLaptop and then os.openApp("ach")', () => {
    const { container, app } = renderWithApp(<Stage />, {
      loadScene: vi.fn(pending),
      nav: { goToResume: vi.fn(), openLaptop: vi.fn() },
    })
    const openApp = vi.spyOn(app.os, 'openApp')
    fireEvent.click(within(container).getByRole('button', { name: '★ 0/13' }))
    expect(app.nav.openLaptop).toHaveBeenCalledTimes(1)
    expect(openApp).toHaveBeenCalledWith('ach')
    expect(app.nav.openLaptop.mock.invocationCallOrder[0]).toBeLessThan(openApp.mock.invocationCallOrder[0])
  })

  describe('5. loadScene resolving null (flat fallback)', () => {
    it('status becomes unavailable and the notice is shown', async () => {
      const { app, container } = renderWithApp(<Stage />, { loadScene: vi.fn(async () => null) })
      await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
      expect(within(container).getByText(NOTICE)).toBeInTheDocument()
    })

    it('the OS host element is inside .flat-host.on with classes flat, compact and fallback', async () => {
      const { app, container } = renderWithApp(<Stage />, { loadScene: vi.fn(async () => null) })
      await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
      const flatHost = container.querySelector('.flat-host')
      expect(flatHost).toHaveClass('on')
      expect(flatHost.contains(app.host.osEl)).toBe(true)
      expect(app.host.osEl).toHaveClass('flat')
      expect(app.host.osEl).toHaveClass('compact')
      expect(app.host.osEl).toHaveClass('fallback')
    })

    it('flat-host has inline z-index 5 and no trap class', async () => {
      const { app, container } = renderWithApp(<Stage />, { loadScene: vi.fn(async () => null) })
      await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
      const flatHost = container.querySelector('.flat-host')
      expect(flatHost.style.zIndex).toBe('5')
      expect(flatHost).not.toHaveClass('trap')
    })

    it('the OS host element also has class live in the fallback, so window bodies scroll', async () => {
      const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(async () => null) })
      await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
      expect(app.host.osEl).toHaveClass('flat')
      expect(app.host.osEl).toHaveClass('live')
    })
  })

  it('6. StrictMode: after the effects settle, one scene is alive; after unmount, none is', async () => {
    const counter = { created: 0, disposed: 0 }
    const module = fakeScene(counter)
    const { app, unmount } = renderWithApp(
      <StrictMode>
        <Stage />
      </StrictMode>,
      { loadScene: vi.fn(async () => module) },
    )
    await waitFor(() => expect(app.scene.store.get().status).toBe('ready'))
    expect(counter.created - counter.disposed).toBe(1)
    unmount()
    expect(counter.created - counter.disposed).toBe(0)
  })

  it('7. createScene throwing: status becomes unavailable and nothing escapes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const loadScene = vi.fn(async () => ({
      createScene: () => {
        throw new Error('boom')
      },
    }))
    const { app } = renderWithApp(<Stage />, { loadScene })
    await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
  })

  it('8. the cue has role img and the name "Scroll down to open the laptop"', () => {
    const { container } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    const cue = within(container).getByRole('img', { name: 'Scroll down to open the laptop' })
    expect(cue).toBeInTheDocument()
  })

  it('9. unmount removes the window keydown and stage wheel listeners it added', () => {
    const added = []
    const removed = []
    const origAdd = EventTarget.prototype.addEventListener
    const origRemove = EventTarget.prototype.removeEventListener
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      added.push({ target: this, type, fn })
      return origAdd.call(this, type, fn, opts)
    }
    EventTarget.prototype.removeEventListener = function (type, fn, opts) {
      removed.push({ target: this, type, fn })
      return origRemove.call(this, type, fn, opts)
    }
    // jsdom defines addEventListener/removeEventListener as own properties of window, so the
    // prototype patch above never sees window listeners: patch window itself too.
    const winAdd = window.addEventListener
    const winRemove = window.removeEventListener
    window.addEventListener = function (type, fn, opts) {
      added.push({ target: window, type, fn })
      return winAdd.call(this, type, fn, opts)
    }
    window.removeEventListener = function (type, fn, opts) {
      removed.push({ target: window, type, fn })
      return winRemove.call(this, type, fn, opts)
    }
    let unmount
    try {
      ;({ unmount } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) }))
      const stageEl = added.find((a) => a.type === 'wheel' && a.target.id === 'stage')?.target
      expect(stageEl).toBeDefined()
      const keydowns = added.filter((a) => a.type === 'keydown' && a.target === window)
      const wheels = added.filter((a) => a.type === 'wheel' && a.target === stageEl)
      expect(keydowns.length).toBeGreaterThan(0)
      expect(wheels.length).toBeGreaterThan(0)

      unmount()

      const removedKeydowns = removed.filter((r) => r.type === 'keydown' && r.target === window)
      const removedWheels = removed.filter((r) => r.type === 'wheel' && r.target === stageEl)
      expect(removedKeydowns.length).toBe(keydowns.length)
      expect(removedWheels.length).toBe(wheels.length)
    } finally {
      EventTarget.prototype.addEventListener = origAdd
      EventTarget.prototype.removeEventListener = origRemove
      window.addEventListener = winAdd
      window.removeEventListener = winRemove
      unmount?.()
    }
  })
})
