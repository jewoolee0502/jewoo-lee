// Round 2 Phase 2 TEST LIST: stage/Stage.test.jsx. Rendered through renderWithApp with loadScene overridable.
// Native scroll: the window carries the idle settle and the wheel grace hold.
// Round 3 Phase R3-1 (plan-r3 V4): the page is native; the window wheel is passive, nothing is non-passive.
// onIdle passes { dir, travel }.
// Round 3 Phase R3-3 (plan-r3 V19, I16): the no-WebGL fallback works as the two views (section 5b).
// Round 3 Phase R3-2 (plan-r3 V6, I9): the HUD, the pill and the Recruiter view switch to the résumé
// view (labels without the arrow); while the controller is parked the bindings stop the ticker and
// ignore window scrolls and stage resizes.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { StrictMode } from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { setReducedMotion, triggerIntersection, triggerResize } from '../test/setup.js'
import { renderWithApp } from '../test/renderWithApp.jsx'
import Stage from './Stage.jsx'
import OsPortal from '../os/OsPortal.jsx'
import { PROJECTS } from '../content/index.js'
import { IDLE_MS, SETTLE_GRACE_MS, NARROW_PX, SHORT_PX } from '../core/constants.js'
import { KONAMI, KONAMI_IDLE_MS } from './keys.js'

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

  it('1. the HUD shows Recruiter view, Résumé, ★ 0/12 and Sound: off with aria-pressed false', () => {
    const { container } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
    const hud = within(container)
    expect(hud.getByRole('button', { name: 'Recruiter view' })).toBeInTheDocument()
    expect(hud.getByRole('button', { name: 'Résumé' })).toBeInTheDocument()
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

    // R3-2 (V8, V14): the return focus goes back to the Recruiter button, so it is passed as the opener.
    it('Full résumé calls nav.goToResume with the Recruiter button as the opener, after the view has closed', () => {
      const seen = []
      const result = renderWithApp(<Stage />, {
        loadScene: vi.fn(pending),
        nav: {
          goToResume: vi.fn(() => seen.push(result.app.ui.store.get().recOpen)),
          openLaptop: vi.fn(),
        },
      })
      const { app, container } = result
      fireEvent.click(within(container).getByRole('button', { name: 'Recruiter view' }))
      const dialog = screen.getByRole('dialog', { name: 'Recruiter view' })
      fireEvent.click(screen.getByRole('button', { name: 'Full résumé' }))
      expect(app.nav.goToResume).toHaveBeenCalledTimes(1)
      expect(app.nav.goToResume).toHaveBeenCalledWith({ opener: within(container).getByRole('button', { name: 'Recruiter view' }) })
      expect(seen).toEqual([false])
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

    // The fallback is compact only on narrow screens; wide ones get the normal scaled desktop.
    it('the OS host element is inside .flat-host.on with classes flat and fallback, not compact on a wide stage', async () => {
      const { app, container } = renderWithApp(<Stage />, { loadScene: vi.fn(async () => null) })
      await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
      const flatHost = container.querySelector('.flat-host')
      expect(flatHost).toHaveClass('on')
      expect(flatHost.contains(app.host.osEl)).toBe(true)
      expect(app.host.osEl).toHaveClass('flat')
      expect(app.host.osEl).not.toHaveClass('compact')
      expect(app.host.osEl).toHaveClass('fallback')
    })

    it('on a narrow (390×844) stage the fallback OS is compact', async () => {
      const { app, container } = renderWithApp(<Stage />, { loadScene: vi.fn(async () => null) })
      await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
      const stage = container.querySelector('#stage')
      Object.defineProperty(stage, 'clientWidth', { configurable: true, value: 390 })
      Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 844 })
      triggerResize(stage, { width: 390, height: 844 })
      expect(app.host.osEl).toHaveClass('flat')
      expect(app.host.osEl).toHaveClass('compact')
      expect(app.host.osEl).toHaveClass('fallback')
    })

    it('flat-host has no inline z-index (the stacking moved to CSS) and no trap class', async () => {
      const { app, container } = renderWithApp(<Stage />, { loadScene: vi.fn(async () => null) })
      await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
      const flatHost = container.querySelector('.flat-host')
      expect(flatHost.style.zIndex).toBe('')
      expect(flatHost).not.toHaveClass('trap')
    })

    // Round 2 §7 6B TEST LIST item 8 (U11): the notice is a note in the top bar, not a floating toast.
    it('the notice is a p.fallback-note with role note, the same text and no inline style', async () => {
      const { app, container } = renderWithApp(<Stage />, { loadScene: vi.fn(async () => null) })
      await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
      const note = within(container).getByText(NOTICE)
      expect(note.tagName).toBe('P')
      expect(note).toHaveClass('fallback-note')
      expect(note).toHaveAttribute('role', 'note')
      expect(note).not.toHaveAttribute('style')
    })

    it('the OS host element also has class live in the fallback, so window bodies scroll', async () => {
      const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(async () => null) })
      await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
      expect(app.host.osEl).toHaveClass('flat')
      expect(app.host.osEl).toHaveClass('live')
    })
  })

  // Round 3 Phase R3-3 TEST LIST (plan-r3 V19): with no WebGL the two views still switch, the fallback
  // OS stays flat, and the switch is instant (reduced motion, so no veil timers).
  describe('5b. no-WebGL fallback as two views (V19)', () => {
    beforeEach(() => {
      setReducedMotion(true)
    })

    it('app.nav.goToResume shows the résumé view (data-view resume) with no scene loaded', async () => {
      const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(async () => null) })
      await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
      act(() => app.nav.goToResume())
      expect(document.documentElement.getAttribute('data-view')).toBe('resume')
    })

    it('app.nav.backToLaptop shows the laptop view, jumps the glide to the track top and focuses #hud-resume', async () => {
      // The HUD and its focus target count as visible (jsdom has no layout).
      vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function getClientRects() {
        return this.closest('[hidden]') ? [] : [{}]
      })
      vi.spyOn(window.history, 'back').mockImplementation(() => {})
      const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(async () => null) })
      await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
      act(() => app.nav.goToResume())
      expect(document.documentElement.getAttribute('data-view')).toBe('resume')
      const jump = vi.spyOn(app.glide, 'jump')

      act(() => app.nav.backToLaptop())

      expect(document.documentElement.getAttribute('data-view')).toBe('laptop')
      expect(jump).toHaveBeenCalledWith(0)
      expect(document.getElementById('hud-resume')).toHaveFocus()
    })

    it('app.nav.openLaptop from the résumé lands on the laptop view, not interactive, with the OS still live', async () => {
      const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(async () => null) })
      await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
      act(() => app.nav.goToResume())
      act(() => app.nav.openLaptop())
      expect(document.documentElement.getAttribute('data-view')).toBe('laptop')
      expect(app.ctrl.store.get().interactive).toBe(false)
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

  it('9. unmount removes every listener it added: the window scroll, key, touch, pointer and wheel listeners (the wheel one passive); #stage gets no wheel listener', () => {
    const added = []
    const removed = []
    const origAdd = EventTarget.prototype.addEventListener
    const origRemove = EventTarget.prototype.removeEventListener
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      added.push({ target: this, type, fn, opts })
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
      added.push({ target: window, type, fn, opts })
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
      expect(added.some((a) => a.type === 'wheel' && a.target.id === 'stage'), '#stage wheel').toBe(false)
      const ours = added.filter((a) => a.target === window && [...WINDOW_TYPES, 'wheel'].includes(a.type))
      for (const type of WINDOW_TYPES) {
        expect(ours.some((a) => a.type === type), `window ${type} added`).toBe(true)
      }
      const wheel = ours.find((a) => a.type === 'wheel')
      expect(wheel, 'window wheel added').toBeDefined()
      expect(wheel.opts, 'window wheel passive').toEqual(expect.objectContaining({ passive: true }))

      unmount()

      for (const a of ours) {
        expect(
          removed.some((r) => r.target === window && r.type === a.type && r.fn === a.fn),
          `window ${a.type} removed`,
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
  // R3-2 (V14): the label names the view, and the title says what Esc does.
  it('15. the Read the résumé pill is #hud-exit, titled for the view switch, and calls nav.goToResume on click', () => {
    const { container, app } = renderWithApp(<Stage />, {
      loadScene: vi.fn(pending),
      nav: { goToResume: vi.fn(), openLaptop: vi.fn() },
    })
    const pill = within(container).getByRole('button', { name: 'Read the résumé' })
    expect(pill).toHaveAttribute('id', 'hud-exit')
    expect(pill).toHaveAttribute('title', 'Switch to the résumé (Esc closes the laptop)')
    fireEvent.click(pill)
    expect(app.nav.goToResume).toHaveBeenCalledTimes(1)
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

  // The Konami code holds the settle while it is typed (stage/keys), and the page moves its arrows
  // make meanwhile are not the user scrolling either: once the code completes, the settle sees no
  // direction and no travel, so typing it at the desk never glides the page into the laptop.
  it('17d. scrolls while the Konami code is held are not user direction: on completion the settle sees dir 0 and travel 0', () => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 })
    try {
      const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      const settle = vi.spyOn(app.ctrl, 'settle')
      const key = (k) => fireEvent.keyDown(window, { key: k })

      key('ArrowUp')
      key('ArrowUp')
      key('ArrowDown')
      window.scrollY = 40
      window.dispatchEvent(new Event('scroll'))
      key('ArrowDown')
      window.scrollY = 80
      window.dispatchEvent(new Event('scroll'))
      for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b']) key(k)
      vi.advanceTimersByTime(SETTLE_GRACE_MS + IDLE_MS + 1)
      expect(settle).not.toHaveBeenCalled()

      key('a')
      expect(app.ach.store.get().got).toContain('konami')
      vi.advanceTimersByTime(IDLE_MS + 1)
      expect(settle).toHaveBeenCalledTimes(1)
      expect(settle).toHaveBeenCalledWith({ dir: 0, travel: 0 })
    } finally {
      delete window.scrollY
    }
  })

  // A real user input (wheel, touch, pointer) is the user taking the page back from the Konami
  // hold: the held code's own flag ends there, so the next scroll is user direction and travel.
  describe('a real user input after the Konami hold ends its own flag', () => {
    const inputs = [
      { name: 'wheel', down: () => new WheelEvent('wheel', { deltaY: 100 }), up: null },
      { name: 'touchstart', down: () => new Event('touchstart'), up: () => new Event('touchend') },
      { name: 'pointerdown', down: () => new Event('pointerdown'), up: () => new Event('pointerup') },
    ]

    it.each(inputs)('after ↑↑, a $name then a scroll to y 300 settles with dir +1 and travel 300', ({ down, up }) => {
      vi.useFakeTimers()
      Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 })
      try {
        const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
        const settle = vi.spyOn(app.ctrl, 'settle')
        fireEvent.keyDown(window, { key: 'ArrowUp' })
        fireEvent.keyDown(window, { key: 'ArrowUp' })

        window.dispatchEvent(down())
        window.scrollY = 300
        window.dispatchEvent(new Event('scroll'))
        if (up) window.dispatchEvent(up())
        // Long enough for the Konami hold's own give-up (KONAMI_IDLE_MS) as well as the settle.
        vi.advanceTimersByTime(KONAMI_IDLE_MS + SETTLE_GRACE_MS + IDLE_MS + 1)

        expect(settle).toHaveBeenCalledTimes(1)
        expect(settle).toHaveBeenCalledWith({ dir: 1, travel: 300 })
      } finally {
        delete window.scrollY
      }
    })
  })

  // Scrolls within 150 ms after the Konami code completes are its last native arrow frames: own, so
  // no direction and no travel. A scroll later than that is the user's, and it counts.
  it('17e. scrolls within 150 ms after the Konami code completes are own; a scroll after that is user scroll', () => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 })
    try {
      const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      const settle = vi.spyOn(app.ctrl, 'settle')
      for (const k of KONAMI) fireEvent.keyDown(window, { key: k })
      expect(app.ach.store.get().got).toContain('konami')

      // Right after completion: two own frames, 100 ms apart (both inside the 150 ms window).
      window.scrollY = 40
      window.dispatchEvent(new Event('scroll'))
      vi.advanceTimersByTime(100)
      window.scrollY = 80
      window.dispatchEvent(new Event('scroll'))
      vi.advanceTimersByTime(100)
      // 200 ms after completion: the user scrolls on by 40.
      window.scrollY = 120
      window.dispatchEvent(new Event('scroll'))
      vi.advanceTimersByTime(IDLE_MS + SETTLE_GRACE_MS + 1)

      expect(settle).toHaveBeenCalledTimes(1)
      // The own frames moved the travel origin with them: only the user's 80 -> 120 is travel.
      expect(settle).toHaveBeenCalledWith({ dir: 1, travel: 40 })
    } finally {
      delete window.scrollY
    }
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

  // Round 3 Phase R3-2 (plan-r3 V6, I9): while the controller is parked (the résumé view is shown)
  // the bindings ignore the window scroll, the stage resize and the ticker's frames, and an
  // intersection does not restart the ticker.
  describe('parked gating (I9)', () => {
    // A fake requestAnimationFrame: frames wait in a queue until run(), and cancel removes them.
    function fakeFrames() {
      const queue = new Map()
      let next = 1
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        const id = next++
        queue.set(id, cb)
        return id
      })
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
        queue.delete(id)
      })
      return {
        run() {
          const cbs = [...queue.values()]
          queue.clear()
          for (const cb of cbs) cb(performance.now())
        },
        pending: () => queue.size,
      }
    }

    it('the window scroll does not reach the idle settle while parked; once unparked it does', () => {
      vi.useFakeTimers()
      Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 })
      try {
        const { app } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
        const settle = vi.spyOn(app.ctrl, 'settle')
        app.ctrl.park('desk')
        window.scrollY = 300
        window.dispatchEvent(new Event('scroll'))
        vi.advanceTimersByTime(IDLE_MS + SETTLE_GRACE_MS + 1)
        expect(settle).not.toHaveBeenCalled()

        app.ctrl.unpark('desk')
        window.scrollY = 340
        window.dispatchEvent(new Event('scroll'))
        vi.advanceTimersByTime(IDLE_MS + 1)
        expect(settle).toHaveBeenCalledTimes(1)
      } finally {
        delete window.scrollY
      }
    })

    it('a 0 × 0 resize (a hidden stage) while parked neither flips narrow nor refits the OS; unparked, it does', () => {
      const { app, container, unmount } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      try {
        const stage = container.querySelector('#stage')
        const refit = vi.spyOn(app.os, 'refit')
        app.ctrl.park('desk')
        triggerResize(stage, { width: 0, height: 0 })
        expect(app.ctrl.store.get().narrow).toBe(false)
        expect(refit).not.toHaveBeenCalled()

        app.ctrl.unpark('desk')
        triggerResize(stage, { width: 0, height: 0 })
        expect(app.ctrl.store.get().narrow).toBe(true)
        expect(refit).toHaveBeenCalled()
      } finally {
        unmount()
      }
    })

    it('parking stops the frame loop and sets the stage hidden; unparking restarts it with no intersection', () => {
      const frames = fakeFrames()
      const { app, container } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      const stage = container.querySelector('#stage')
      const update = vi.spyOn(app.ctrl, 'update')
      triggerIntersection(stage, true)
      expect(app.ui.store.get().stageVisible).toBe(true)
      frames.run()
      frames.run()
      expect(update.mock.calls.length).toBeGreaterThanOrEqual(2)

      app.ctrl.park('desk')
      expect(app.ui.store.get().stageVisible).toBe(false)
      const parked = update.mock.calls.length
      frames.run()
      frames.run()
      frames.run()
      expect(update.mock.calls.length).toBe(parked)

      app.ctrl.unpark('desk')
      const unparked = update.mock.calls.length
      frames.run()
      expect(update.mock.calls.length).toBeGreaterThan(unparked)
    })

    it('an intersection while parked does not start the ticker', () => {
      const frames = fakeFrames()
      const { app, container } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) })
      app.ctrl.park('desk')
      triggerIntersection(container.querySelector('#stage'), true)
      expect(frames.pending()).toBe(0)
    })
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

  // R3-1 (V4): no listener in the app is added non-passive for the inputs that scroll the page.
  it('no listener is added with passive: false for wheel, touchstart or touchmove', () => {
    const added = []
    const origAdd = EventTarget.prototype.addEventListener
    const winAdd = window.addEventListener
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      added.push({ target: this, type, opts })
      return origAdd.call(this, type, fn, opts)
    }
    window.addEventListener = function (type, fn, opts) {
      added.push({ target: window, type, opts })
      return winAdd.call(this, type, fn, opts)
    }
    let unmount
    try {
      ;({ unmount } = renderWithApp(<Stage />, { loadScene: vi.fn(pending) }))
      const risky = added.filter(
        (a) => ['wheel', 'touchstart', 'touchmove'].includes(a.type) && a.opts?.passive === false,
      )
      expect(risky.map((a) => `${a.target === window ? 'window' : a.target.id || a.target.tagName} ${a.type}`)).toEqual([])
    } finally {
      EventTarget.prototype.addEventListener = origAdd
      window.addEventListener = winAdd
      unmount?.()
    }
  })
})
