// Round 2 Phase 2 TEST LIST: stage/Stage.test.jsx. Rendered through renderWithApp with loadScene overridable.
// Native scroll: the only non-passive listener is #stage wheel; the window carries the idle settle.
// Phase 6A (plan-r2 section 7): onIdle passes { dir, travel }; arrow keys step 40 px while the page snaps.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { StrictMode } from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { triggerIntersection, triggerResize, setReducedMotion } from '../test/setup.js'
import { renderWithApp } from '../test/renderWithApp.jsx'
import Stage from './Stage.jsx'
import OsPortal from '../os/OsPortal.jsx'
import { PROJECTS } from '../content/index.js'
import { IDLE_MS, SETTLE_GRACE_MS, NARROW_PX, SHORT_PX } from '../core/constants.js'
import { runwayLayout } from './runway.js'

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

  it('1. the HUD shows Recruiter view, Résumé ↓, ★ 0/12 and Sound: off with aria-pressed false', () => {
    const { container } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    const hud = within(container)
    expect(hud.getByRole('button', { name: 'Recruiter view' })).toBeInTheDocument()
    expect(hud.getByRole('button', { name: 'Résumé ↓' })).toBeInTheDocument()
    expect(hud.getByRole('button', { name: '★ 0/12' })).toBeInTheDocument()
    const sound = hud.getByRole('button', { name: /Sound: off/ })
    expect(sound).toHaveAttribute('aria-pressed', 'false')
  })

  it('1b. with jayos-ach preset to boot and term, the HUD shows ★ 2/12', () => {
    localStorage.setItem('jayos-ach', JSON.stringify(['boot', 'term']))
    const { container } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    expect(within(container).getByRole('button', { name: '★ 2/12' })).toBeInTheDocument()
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

  it('4. clicking ★ 0/12 calls nav.openLaptop and then os.openApp("ach")', () => {
    const { container, app } = renderWithApp(<Stage />, {
      loadScene: vi.fn(pending),
      nav: { goToResume: vi.fn(), openLaptop: vi.fn() },
    })
    const openApp = vi.spyOn(app.os, 'openApp')
    fireEvent.click(within(container).getByRole('button', { name: '★ 0/12' }))
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

  it('9. unmount removes every listener it added: #stage wheel and the window scroll, key, touch and pointer listeners', () => {
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
    const WINDOW_TYPES = ['keydown', 'scroll', 'touchstart', 'touchend', 'touchcancel', 'pointerdown', 'pointerup', 'pointercancel']
    let unmount
    try {
      ;({ unmount } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) }))
      const stageEl = added.find((a) => a.type === 'wheel' && a.target.id === 'stage')?.target
      expect(stageEl).toBeDefined()
      const ours = added.filter(
        (a) => (a.target === window && WINDOW_TYPES.includes(a.type)) || (a.target === stageEl && a.type === 'wheel'),
      )
      for (const type of WINDOW_TYPES) {
        expect(ours.some((a) => a.target === window && a.type === type), `window ${type} added`).toBe(true)
      }
      expect(ours.some((a) => a.target === stageEl && a.type === 'wheel')).toBe(true)

      unmount()

      for (const a of ours) {
        expect(
          removed.some((r) => r.target === a.target && r.type === a.type && r.fn === a.fn),
          `${a.target === window ? 'window' : '#stage'} ${a.type} removed`,
        ).toBe(true)
      }
    } finally {
      EventTarget.prototype.addEventListener = origAdd
      EventTarget.prototype.removeEventListener = origRemove
      window.addEventListener = winAdd
      window.removeEventListener = winRemove
      unmount?.()
    }
  })

  it('9b. with onscrollend defined, the window scrollend listener is added and removed too', () => {
    Object.defineProperty(window, 'onscrollend', { configurable: true, writable: true, value: null })
    const added = []
    const removed = []
    const winAdd = window.addEventListener
    const winRemove = window.removeEventListener
    window.addEventListener = function (type, fn, opts) {
      added.push({ type, fn })
      return winAdd.call(this, type, fn, opts)
    }
    window.removeEventListener = function (type, fn, opts) {
      removed.push({ type, fn })
      return winRemove.call(this, type, fn, opts)
    }
    try {
      const { unmount } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      const scrollend = added.filter((a) => a.type === 'scrollend')
      expect(scrollend).toHaveLength(1)
      unmount()
      expect(removed.some((r) => r.type === 'scrollend' && r.fn === scrollend[0].fn)).toBe(true)
    } finally {
      window.addEventListener = winAdd
      window.removeEventListener = winRemove
      delete window.onscrollend
    }
  })

  // Bug J: overflow:hidden containers that hold the OS get their scroll offsets pinned to 0.
  it('10. scrolling #stage, .flat-host or #os resets their scrollTop and scrollLeft to 0', () => {
    const { container, app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    const targets = [container.querySelector('#stage'), container.querySelector('.flat-host'), app.host.osEl]
    for (const el of targets) {
      el.scrollTop = 239
      el.scrollLeft = 12
      el.dispatchEvent(new Event('scroll'))
      expect(el.scrollTop).toBe(0)
      expect(el.scrollLeft).toBe(0)
    }
  })

  // Regression guard: pinScroll targets only the overflow:hidden containers, never window bodies.
  it('12. a .wb window body inside app.host.osEl keeps its scroll offset', () => {
    const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    const wb = document.createElement('div')
    wb.className = 'wb'
    app.host.osEl.appendChild(wb)
    wb.scrollTop = 120
    wb.dispatchEvent(new Event('scroll'))
    expect(wb.scrollTop).toBe(120)
  })
  // Round 2: the pill that leaves the laptop for the résumé (shown only while the stage is zoomed).
  it('15. the Go to résumé ↓ pill is #hud-exit and calls nav.goToResume on click', () => {
    const { container, app } = renderWithApp(<Stage />, {
      loadScene: vi.fn(pending),
      nav: { goToResume: vi.fn(), openLaptop: vi.fn() },
    })
    const pill = within(container).getByRole('button', { name: 'Go to résumé ↓' })
    expect(pill).toHaveAttribute('id', 'hud-exit')
    fireEvent.click(pill)
    expect(app.nav.goToResume).toHaveBeenCalledTimes(1)
  })

  // Round 2 (R5): #stage is the only non-passive wheel listener; it asks the controller.
  it('16. a #stage wheel the controller takes is cancelled, and cancels any running glide first', () => {
    const { container, app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    const onWheel = vi.fn(() => true)
    app.ctrl.onWheel = onWheel
    app.glide.cancel = vi.fn()
    const ev = new WheelEvent('wheel', { deltaY: 50, cancelable: true, bubbles: true })
    container.querySelector('#stage').dispatchEvent(ev)
    expect(app.glide.cancel).toHaveBeenCalled()
    expect(onWheel).toHaveBeenCalledTimes(1)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('16b. when the controller does not take the wheel, the event is not prevented', () => {
    const { container, app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    app.ctrl.onWheel = vi.fn(() => false)
    const ev = new WheelEvent('wheel', { deltaY: 50, cancelable: true, bubbles: true })
    container.querySelector('#stage').dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })

  it('16c. the #stage wheel listener is added with passive: false', () => {
    const origAdd = EventTarget.prototype.addEventListener
    const calls = []
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if (type === 'wheel' && this.id === 'stage') calls.push(opts)
      return origAdd.call(this, type, fn, opts)
    }
    try {
      const { unmount } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      expect(calls.length).toBeGreaterThan(0)
      expect(calls.every((o) => o && o.passive === false)).toBe(true)
      unmount()
    } finally {
      EventTarget.prototype.addEventListener = origAdd
    }
  })

  // Round 2 (R6): the window scroll feeds the idle settle; a touch hold defers it.
  it('17. two scroll events (0 then 40) settle downward after 200 ms with the travel since load; a touch hold defers the settle until touchend', () => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 })
    const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    const settle = vi.spyOn(app.ctrl, 'settle')

    window.scrollY = 0
    window.dispatchEvent(new Event('scroll'))
    window.scrollY = 40
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(200)
    expect(settle).toHaveBeenCalledWith({ dir: 1, travel: 40 })
    expect(settle).toHaveBeenCalledTimes(1)

    settle.mockClear()
    window.dispatchEvent(new Event('touchstart'))
    window.scrollY = 0
    window.dispatchEvent(new Event('scroll'))
    window.scrollY = 40
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(200)
    expect(settle).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('touchend'))
    vi.advanceTimersByTime(200)
    expect(settle).toHaveBeenCalledTimes(1)
    expect(settle).toHaveBeenCalledWith(expect.objectContaining({ dir: 1 }))
    delete window.scrollY
  })

  // Phase 6A (U7): a scroll the glide wrote (glide.owns) is an own move: no direction, no travel.
  it('17b. a scroll the glide owns is not user direction: the settle sees dir 0 and travel 0', () => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 })
    const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    const settle = vi.spyOn(app.ctrl, 'settle')
    app.glide.owns = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)

    window.scrollY = 0
    window.dispatchEvent(new Event('scroll'))
    window.scrollY = 40
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(200)
    expect(app.glide.owns).toHaveBeenLastCalledWith(40)
    expect(settle).toHaveBeenCalledTimes(1)
    expect(settle).toHaveBeenCalledWith({ dir: 0, travel: 0 })
    delete window.scrollY
  })

  // The Recruiter view is a dialog over the page: while it is open, a rest mid-dive never settles
  // (no glide), and the first rest after it closes settles as usual.
  it('17c. while the Recruiter view is open, a downward rest mid-dive never settles; after it closes, the next rest settles again', () => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'onscrollend', { configurable: true, writable: true, value: null })
    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 })
    try {
      const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      const settle = vi.spyOn(app.ctrl, 'settle')
      const glideTo = vi.spyOn(app.glide, 'to')
      app.ui.store.set({ recOpen: true })

      window.scrollY = 300
      window.dispatchEvent(new Event('scroll'))
      window.scrollY = 340
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('scrollend'))
      vi.advanceTimersByTime(IDLE_MS + SETTLE_GRACE_MS)
      expect(settle).not.toHaveBeenCalled()
      expect(glideTo).not.toHaveBeenCalled()

      app.ui.store.set({ recOpen: false })
      settle.mockClear()
      window.scrollY = 380
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('scrollend'))
      expect(settle).toHaveBeenCalledTimes(1)
      expect(settle).toHaveBeenCalledWith({ dir: 1, travel: 40 })
    } finally {
      vi.useRealTimers()
      delete window.onscrollend
      delete window.scrollY
    }
  })

  // Round 2 (R10): with no scene the track collapses to the flat runway once the stage is in view.
  it('18. no-WebGL: once the stage intersects the viewport, #track has class flat-runway', async () => {
    const { app, container } = renderWithApp(<Stage />, { loadScene: vi.fn(async () => null) })
    await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
    triggerIntersection(container.querySelector('#stage'), true)
    const track = container.querySelector('#track')
    await waitFor(() => expect(track).toHaveClass('flat-runway'))
  })

  // Round 2 (R10): the page may load scrolled to #resume, where the stage is not intersecting and
  // the ticker is stopped. The runway collapse must not wait for a frame.
  it('18b. no-WebGL without a frame: setting the scene to unavailable adds flat-runway synchronously', () => {
    const { app, container } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    const track = container.querySelector('#track')
    expect(track).not.toHaveClass('flat-runway')
    app.scene.store.set({ status: 'unavailable' })
    expect(track).toHaveClass('flat-runway')
  })

  // Round 2 Phase 2 (keys): the keyboard scroll keys hold the idle settle exactly like the wheel
  // grace, so the settle cannot fire between two key repeats.
  describe('keyboard scroll keys hold the idle settle', () => {
    function withScrollend() {
      Object.defineProperty(window, 'onscrollend', { configurable: true, writable: true, value: null })
      Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 })
      return () => {
        delete window.onscrollend
        delete window.scrollY
      }
    }

    it('an ArrowDown keydown then scrollend at a mid-dive position: the settle waits for SETTLE_GRACE_MS, then IDLE_MS', () => {
      vi.useFakeTimers()
      const restore = withScrollend()
      try {
        const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
        const settle = vi.spyOn(app.ctrl, 'settle')

        window.scrollY = 300
        window.dispatchEvent(new Event('scroll'))
        fireEvent.keyDown(window, { key: 'ArrowDown' })
        window.dispatchEvent(new Event('scrollend'))
        expect(settle).not.toHaveBeenCalled()

        vi.advanceTimersByTime(SETTLE_GRACE_MS - 1)
        expect(settle).not.toHaveBeenCalled()

        vi.advanceTimersByTime(IDLE_MS + 1)
        expect(settle).toHaveBeenCalledTimes(1)
        expect(settle).toHaveBeenCalledWith({ dir: 1, travel: 300 })
      } finally {
        vi.useRealTimers()
        restore()
      }
    })

    it('the same holds for PageDown, Space, Home and End (not only ArrowDown)', () => {
      vi.useFakeTimers()
      const restore = withScrollend()
      try {
        const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
        const settle = vi.spyOn(app.ctrl, 'settle')
        for (const key of ['PageDown', ' ', 'Home', 'End']) {
          settle.mockClear()
          window.scrollY = 300
          window.dispatchEvent(new Event('scroll'))
          fireEvent.keyDown(window, { key })
          window.dispatchEvent(new Event('scrollend'))
          expect(settle, key).not.toHaveBeenCalled()
          vi.advanceTimersByTime(SETTLE_GRACE_MS - 1)
          expect(settle, key).not.toHaveBeenCalled()
          vi.advanceTimersByTime(IDLE_MS + SETTLE_GRACE_MS)
          expect(settle, key).toHaveBeenCalledTimes(1)
        }
      } finally {
        vi.useRealTimers()
        restore()
      }
    })

    it('a keydown inside an <input> does not hold the settle, so scrollend settles at once', () => {
      vi.useFakeTimers()
      const restore = withScrollend()
      const input = document.createElement('input')
      document.body.append(input)
      try {
        const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
        const settle = vi.spyOn(app.ctrl, 'settle')

        window.scrollY = 0
        window.dispatchEvent(new Event('scroll'))
        window.scrollY = 300
        window.dispatchEvent(new Event('scroll'))
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
        window.dispatchEvent(new Event('scrollend'))
        expect(settle).toHaveBeenCalledTimes(1)
        expect(settle).toHaveBeenCalledWith(expect.objectContaining({ dir: 1 }))
      } finally {
        input.remove()
        vi.useRealTimers()
        restore()
      }
    })

    it('Space on a focused <a href> is a page-scroll key: it holds the settle for the grace window', () => {
      vi.useFakeTimers()
      const restore = withScrollend()
      const link = document.createElement('a')
      link.href = '#resume'
      document.body.append(link)
      try {
        const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
        const settle = vi.spyOn(app.ctrl, 'settle')

        window.scrollY = 300
        window.dispatchEvent(new Event('scroll'))
        fireEvent.keyDown(link, { key: ' ' })
        window.dispatchEvent(new Event('scrollend'))
        expect(settle).not.toHaveBeenCalled()

        vi.advanceTimersByTime(SETTLE_GRACE_MS - 1)
        expect(settle).not.toHaveBeenCalled()

        vi.advanceTimersByTime(IDLE_MS + 1)
        expect(settle).toHaveBeenCalledTimes(1)
      } finally {
        link.remove()
        vi.useRealTimers()
        restore()
      }
    })

    it('Space on a focused <button>, [role=button] or <summary> is not a page-scroll key: scrollend settles at once', () => {
      vi.useFakeTimers()
      const restore = withScrollend()
      const els = ['button', 'div', 'summary'].map((tag, i) => {
        const el = document.createElement(tag)
        if (tag === 'div') el.setAttribute('role', 'button')
        el.id = `space-target-${i}`
        document.body.append(el)
        return el
      })
      try {
        const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
        const settle = vi.spyOn(app.ctrl, 'settle')

        for (const el of els) {
          settle.mockClear()
          window.scrollY = 0
          window.dispatchEvent(new Event('scroll'))
          window.scrollY = 300
          window.dispatchEvent(new Event('scroll'))
          fireEvent.keyDown(el, { key: ' ' })
          window.dispatchEvent(new Event('scrollend'))
          expect(settle, el.tagName).toHaveBeenCalledTimes(1)
          expect(settle, el.tagName).toHaveBeenCalledWith(expect.objectContaining({ dir: 1 }))
        }
      } finally {
        els.forEach((el) => el.remove())
        vi.useRealTimers()
        restore()
      }
    })
  })

  // Round 2 (R5, plan-r2): the non-passive #stage wheel listener is only needed for the detent near
  // the dive -> plateau boundary. It is attached while s < diveEnd and detached otherwise.
  it('19. the non-passive #stage wheel listener is attached only in the dive (s < diveEnd) and re-attached on the way back', async () => {
    const counter = { created: 0, disposed: 0 }
    const live = new Set()
    const origAdd = EventTarget.prototype.addEventListener
    const origRemove = EventTarget.prototype.removeEventListener
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if (type === 'wheel' && this.id === 'stage' && opts?.passive === false) live.add(fn)
      return origAdd.call(this, type, fn, opts)
    }
    EventTarget.prototype.removeEventListener = function (type, fn, opts) {
      if (type === 'wheel' && this.id === 'stage') live.delete(fn)
      return origRemove.call(this, type, fn, opts)
    }
    try {
      const { app, container, unmount } = renderWithApp(<Stage />, {
        loadScene: vi.fn(async () => fakeScene(counter)),
      })
      await waitFor(() => expect(app.scene.store.get().status).toBe('ready'))

      // The track rect drives the scroll position s = -track.top; the controller reads it per frame.
      const TRACK_H = 6000
      const L = runwayLayout({ trackH: TRACK_H, stageH: window.innerHeight })
      let trackTop = 0
      const track = container.querySelector('#track')
      track.getBoundingClientRect = () => ({ top: trackTop, height: TRACK_H, bottom: TRACK_H + trackTop, left: 0, right: 0, width: 0, x: 0, y: trackTop })
      const place = (s, seg) => {
        trackTop = -s
        act(() => app.ctrl.update())
        expect(app.ctrl.seg).toBe(seg)
      }

      place(0, 'top')
      expect(live.size, 'at the top').toBeGreaterThan(0)
      place(L.diveEnd / 2, 'dive')
      expect(live.size, 'mid-dive').toBeGreaterThan(0)
      place((L.diveEnd + L.insideEnd) / 2, 'inside')
      expect(live.size, 'plateau').toBe(0)
      place((L.insideEnd + L.outEnd) / 2, 'out')
      expect(live.size, 'out').toBe(0)
      place((L.outEnd + L.R) / 2, 'tail')
      expect(live.size, 'tail').toBe(0)
      place(L.R + 200, 'past')
      expect(live.size, 'résumé').toBe(0)
      place(L.diveEnd / 2, 'dive')
      expect(live.size, 'back in the dive').toBeGreaterThan(0)

      unmount()
      expect(live.size, 'after unmount').toBe(0)
    } finally {
      EventTarget.prototype.addEventListener = origAdd
      EventTarget.prototype.removeEventListener = origRemove
    }
  })

  // Round 2 Phase 3 TEST LIST 4 (compact OS for short landscape): a stage that is too short is narrow too.
  describe('narrow follows the stage size (phone portrait and short landscape)', () => {
    const sizeStage = (container, width, height) => {
      const stage = container.querySelector('#stage')
      Object.defineProperty(stage, 'clientWidth', { configurable: true, value: width })
      Object.defineProperty(stage, 'clientHeight', { configurable: true, value: height })
      triggerResize(stage, { width, height })
    }

    it('a 844×390 stage (phone landscape) sets narrow true', () => {
      const { app, container, unmount } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      try {
        sizeStage(container, 844, 390)
        expect(app.ctrl.store.get().narrow).toBe(true)
      } finally {
        unmount()
      }
    })

    it('a 1280×720 stage (desktop) sets narrow false', () => {
      const { app, container, unmount } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      try {
        sizeStage(container, 844, 390)
        sizeStage(container, 1280, 720)
        expect(app.ctrl.store.get().narrow).toBe(false)
      } finally {
        unmount()
      }
    })

    it('a wide stage that is shorter than SHORT_PX is narrow; one at SHORT_PX is not', () => {
      expect(SHORT_PX).toBe(480)
      const { app, container, unmount } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      try {
        sizeStage(container, 1000, SHORT_PX - 1)
        expect(app.ctrl.store.get().narrow).toBe(true)
        sizeStage(container, 1000, SHORT_PX)
        expect(app.ctrl.store.get().narrow).toBe(false)
      } finally {
        unmount()
      }
    })

    it('a narrow-width stage (under NARROW_PX) is narrow regardless of height', () => {
      const { app, container, unmount } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      try {
        sizeStage(container, NARROW_PX - 1, 900)
        expect(app.ctrl.store.get().narrow).toBe(true)
      } finally {
        unmount()
      }
    })
  })

  // Phase 6A (U2): the snap rail is an aria-hidden sibling of #stage, inside #track, and app.dom.rail.
  it('the snap rail is an aria-hidden #snap-rail inside #track but outside #stage, and app.dom.rail is it', () => {
    const { app, container } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    const rail = container.querySelector('#track > #snap-rail')
    expect(rail).toHaveAttribute('aria-hidden', 'true')
    expect(rail.closest('#stage')).toBeNull()
    expect(app.dom.rail).toBe(rail)
  })

  // Phase 6A (U1): unmount releases the snap (the controller removes runway-snap and the rail).
  it('unmount calls ctrl.releaseSnap', () => {
    const { app, unmount } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    const release = vi.spyOn(app.ctrl, 'releaseSnap')
    unmount()
    expect(release).toHaveBeenCalled()
  })

  // Phase 6A (U4): ArrowUp/ArrowDown step 40 px in JS while the page snaps; everything else is native.
  describe('arrow keys step 40 px while the page snaps (U4)', () => {
    const snapOn = () => document.documentElement.classList.add('runway-snap')
    afterEach(() => {
      document.documentElement.classList.remove('runway-snap', 'snap-hold')
      setReducedMotion(false)
    })

    it('ArrowDown on the page with snapping on is prevented and steps +40 smoothly', () => {
      renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      snapOn()
      const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
      const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
      document.body.dispatchEvent(ev)
      expect(ev.defaultPrevented).toBe(true)
      expect(scrollBy).toHaveBeenCalledWith({ top: 40, behavior: 'smooth' })
    })

    it('ArrowUp steps −40', () => {
      renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      snapOn()
      const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
      const ev = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
      document.body.dispatchEvent(ev)
      expect(ev.defaultPrevented).toBe(true)
      expect(scrollBy).toHaveBeenCalledWith({ top: -40, behavior: 'smooth' })
    })

    it('with reduced motion the step is instant', () => {
      setReducedMotion(true)
      renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      snapOn()
      const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
      expect(scrollBy).toHaveBeenCalledWith({ top: 40, behavior: 'instant' })
    })

    it('without the runway-snap class the arrow is native: not prevented, no scrollBy', () => {
      renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
      const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
      document.body.dispatchEvent(ev)
      expect(ev.defaultPrevented).toBe(false)
      expect(scrollBy).not.toHaveBeenCalled()
    })

    it('inside a text field the arrow is native', () => {
      renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      snapOn()
      const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
      const input = document.createElement('input')
      document.body.appendChild(input)
      try {
        const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
        input.dispatchEvent(ev)
        expect(ev.defaultPrevented).toBe(false)
        expect(scrollBy).not.toHaveBeenCalled()
      } finally {
        input.remove()
      }
    })

    it('after a pointer press in a window body that can still scroll down, the arrow stays native', () => {
      renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      snapOn()
      const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
      const wb = document.createElement('div')
      wb.className = 'wb'
      Object.defineProperties(wb, {
        clientHeight: { configurable: true, value: 100 },
        scrollHeight: { configurable: true, value: 300 },
        scrollTop: { configurable: true, value: 0, writable: true },
      })
      document.body.appendChild(wb)
      try {
        fireEvent.pointerDown(wb)
        const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
        document.body.dispatchEvent(ev)
        expect(ev.defaultPrevented).toBe(false)
        expect(scrollBy).not.toHaveBeenCalled()
      } finally {
        wb.remove()
      }
    })

    // Phase 6A TEST LIST (arrow keys never stolen from another scroller): the step is 0 when the keydown
    // target is inside (or is) a recruiter dialog, or inside an overflow:auto/scroll element that can still
    // scroll that way, even if keyboard-focused. At its end the page step happens.
    describe('arrow keys yield to another scroller (never stolen)', () => {
      function scrollerEl({ scrollTop = 0, clientHeight = 100, scrollHeight = 300 } = {}) {
        const el = document.createElement('div')
        Object.defineProperties(el, {
          clientHeight: { configurable: true, value: clientHeight },
          scrollHeight: { configurable: true, value: scrollHeight },
          scrollTop: { configurable: true, value: scrollTop, writable: true },
        })
        document.body.appendChild(el)
        return el
      }

      // jsdom has no layout: report `overflow` for the given elements, the real style for everything else.
      function stubOverflow(map) {
        const real = window.getComputedStyle.bind(window)
        vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
          const o = map.get(el)
          return o ? { overflow: o, overflowX: o, overflowY: o } : real(el, pseudo)
        })
      }

      function keyOn(target, key) {
        const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        target.dispatchEvent(ev)
        return ev
      }

      beforeEach(() => {
        renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
        snapOn()
      })

      it('a keydown inside a recruiter dialog ([role=dialog]) is native: not prevented, no scrollBy', () => {
        const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
        const dialog = document.createElement('div')
        dialog.setAttribute('role', 'dialog')
        const inner = document.createElement('button')
        dialog.appendChild(inner)
        document.body.appendChild(dialog)
        try {
          for (const key of ['ArrowDown', 'ArrowUp']) {
            expect(keyOn(inner, key).defaultPrevented, key).toBe(false)
            expect(keyOn(dialog, key).defaultPrevented, key).toBe(false)
          }
          expect(scrollBy).not.toHaveBeenCalled()
        } finally {
          dialog.remove()
        }
      })

      it('a keydown inside the .rec card is native: not prevented, no scrollBy', () => {
        const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
        const rec = document.createElement('div')
        rec.className = 'rec'
        document.body.appendChild(rec)
        try {
          const ev = keyOn(rec, 'ArrowDown')
          expect(ev.defaultPrevented).toBe(false)
          expect(scrollBy).not.toHaveBeenCalled()
        } finally {
          rec.remove()
        }
      })

      it('a keyboard-focused control inside an overflow:auto scroller that can still scroll down keeps ArrowDown native', () => {
        const scroller = scrollerEl({ scrollTop: 0 })
        const button = document.createElement('button')
        scroller.appendChild(button)
        stubOverflow(new Map([[scroller, 'auto']]))
        const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
        try {
          button.focus()
          expect(document.activeElement).toBe(button)
          expect(keyOn(button, 'ArrowDown').defaultPrevented).toBe(false)
          expect(scrollBy).not.toHaveBeenCalled()
        } finally {
          scroller.remove()
        }
      })

      it('the scroller itself as the keydown target (overflow:scroll, can scroll up) keeps ArrowUp native', () => {
        const scroller = scrollerEl({ scrollTop: 200 })
        stubOverflow(new Map([[scroller, 'scroll']]))
        const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
        try {
          expect(keyOn(scroller, 'ArrowUp').defaultPrevented).toBe(false)
          expect(scrollBy).not.toHaveBeenCalled()
        } finally {
          scroller.remove()
        }
      })

      it('inside a scroller that is at its bottom, ArrowDown is the page step (+40, prevented)', () => {
        const scroller = scrollerEl({ scrollTop: 200, clientHeight: 100, scrollHeight: 300 })
        const button = document.createElement('button')
        scroller.appendChild(button)
        stubOverflow(new Map([[scroller, 'auto']]))
        const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
        try {
          const ev = keyOn(button, 'ArrowDown')
          expect(ev.defaultPrevented).toBe(true)
          expect(scrollBy).toHaveBeenCalledWith({ top: 40, behavior: 'smooth' })
        } finally {
          scroller.remove()
        }
      })

      it('inside a scroller that is at its top, ArrowUp is the page step (−40, prevented)', () => {
        const scroller = scrollerEl({ scrollTop: 0 })
        const button = document.createElement('button')
        scroller.appendChild(button)
        stubOverflow(new Map([[scroller, 'auto']]))
        const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
        try {
          const ev = keyOn(button, 'ArrowUp')
          expect(ev.defaultPrevented).toBe(true)
          expect(scrollBy).toHaveBeenCalledWith({ top: -40, behavior: 'smooth' })
        } finally {
          scroller.remove()
        }
      })

      it('a non-scrolling element (overflow visible) is not a scroller: the page step happens', () => {
        const scroller = scrollerEl({ scrollTop: 0 })
        const button = document.createElement('button')
        scroller.appendChild(button)
        stubOverflow(new Map([[scroller, 'visible']]))
        const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
        try {
          expect(keyOn(button, 'ArrowDown').defaultPrevented).toBe(true)
          expect(scrollBy).toHaveBeenCalledWith({ top: 40, behavior: 'smooth' })
        } finally {
          scroller.remove()
        }
      })
    })

    // Phase 6A (U1): the scene turning unavailable after ready clears the runway snap at once, through the
    // status subscription (no frame needed).
    it('scene status ready then unavailable removes runway-snap from <html> at once, with no frame', () => {
      const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      document.documentElement.classList.add('runway-snap')
      try {
        act(() => app.scene.setStatus('ready'))
        act(() => app.scene.setStatus('unavailable'))
        expect(document.documentElement.classList.contains('runway-snap')).toBe(false)
      } finally {
        document.documentElement.classList.remove('runway-snap', 'snap-hold')
      }
    })
  })
})
