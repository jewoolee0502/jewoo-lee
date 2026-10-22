// Round 2 Phase 2 TEST LIST: stage/keys.test.js. Konami (L1039), key handler (L1040–1042), Escape.
// Escape exits whenever the laptop is open (phase inside or dive), not on the interactive flag.
// Round 2 §7 6B TEST LIST item 3 (U12): Escape closes the ◆ menu first and returns focus to ◆ JAY-OS.
// Round 3 Phase R3-2 (plan-r3 V16, I18): in the résumé view, keys press nothing and Esc does nothing;
// Konami still unlocks. The view comes from app.views.get() (absent means the laptop view).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pushKonami, createKeyHandler } from './keys.js'
import { createStore } from '../core/store.js'
import { createTimers } from '../core/timers.js'

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

function feed(buf, keys) {
  let matched = false
  for (const k of keys) {
    ;({ buf, matched } = pushKonami(buf, k))
  }
  return { buf, matched }
}

function makeApp({ osState = 'on', reduce = false, status = 'ready', phase = 'inside', recOpen = false, menuOpen = false, sndOn = false, api = true, view } = {}) {
  return {
    views: view === undefined ? undefined : { get: () => view },
    ach: { unlock: vi.fn() },
    toasts: { toast: vi.fn() },
    snd: { store: createStore({ on: sndOn }), click: vi.fn() },
    motion: { reduce: () => reduce },
    os: { state: osState, disco: vi.fn(), store: createStore({ menuOpen }), setMenu: vi.fn() },
    scene: {
      store: createStore({ status }),
      api: api ? { pressKey: vi.fn(), disco: vi.fn() } : null,
    },
    ctrl: {
      store: createStore({ phase, interactive: phase === 'inside', narrow: false }),
      exit: vi.fn(),
    },
    ui: { store: createStore({ recOpen, stageVisible: true }) },
  }
}

describe('stage/keys', () => {
  it('1. pushKonami over the 10 keys matches only on the last one, and the buffer is empty after the match', () => {
    let buf = []
    for (let i = 0; i < KONAMI.length - 1; i++) {
      const r = pushKonami(buf, KONAMI[i])
      expect(r.matched).toBe(false)
      buf = r.buf
    }
    const last = pushKonami(buf, KONAMI[KONAMI.length - 1])
    expect(last.matched).toBe(true)
    expect(last.buf).toEqual([])
  })

  it('2. leading noise keys still match, because the buffer keeps only the last 10', () => {
    const r = feed([], ['x', 'Shift', 'q', ...KONAMI])
    expect(r.matched).toBe(true)
    expect(r.buf).toEqual([])
  })

  it('3. the uppercase B and A are accepted as b and a', () => {
    const r = feed([], [...KONAMI.slice(0, 8), 'B', 'A'])
    expect(r.matched).toBe(true)
  })

  it('4. on a match: unlock konami and the cheat toast; os on calls os.disco, standby calls scene.api.disco(6), standby with reduce calls neither', () => {
    const on = makeApp({ osState: 'on' })
    const hOn = createKeyHandler({ app: on })
    KONAMI.forEach((key) => hOn({ key }))
    expect(on.ach.unlock).toHaveBeenCalledWith('konami')
    expect(on.toasts.toast).toHaveBeenCalledWith('Cheat code', 'Disco mode enabled. You’re welcome.', 'info')
    expect(on.os.disco).toHaveBeenCalledTimes(1)
    expect(on.scene.api.disco).not.toHaveBeenCalled()

    const standby = makeApp({ osState: 'standby' })
    const hStandby = createKeyHandler({ app: standby })
    KONAMI.forEach((key) => hStandby({ key }))
    expect(standby.ach.unlock).toHaveBeenCalledWith('konami')
    expect(standby.scene.api.disco).toHaveBeenCalledWith(6)
    expect(standby.os.disco).not.toHaveBeenCalled()

    const reduced = makeApp({ osState: 'standby', reduce: true })
    const hReduced = createKeyHandler({ app: reduced })
    KONAMI.forEach((key) => hReduced({ key }))
    expect(reduced.ach.unlock).toHaveBeenCalledWith('konami')
    expect(reduced.scene.api.disco).not.toHaveBeenCalled()
    expect(reduced.os.disco).not.toHaveBeenCalled()
  })

  it('5. Escape: with recOpen it closes the recruiter view and does not exit', () => {
    const app = makeApp({ recOpen: true, phase: 'inside', status: 'ready' })
    createKeyHandler({ app })({ key: 'Escape' })
    expect(app.ui.store.get().recOpen).toBe(false)
    expect(app.ctrl.exit).not.toHaveBeenCalled()
  })

  it('5b. Escape exits from phase inside (ready) and from phase dive (ready), once each', () => {
    const inside = makeApp({ phase: 'inside', status: 'ready' })
    createKeyHandler({ app: inside })({ key: 'Escape' })
    expect(inside.ctrl.exit).toHaveBeenCalledTimes(1)

    const dive = makeApp({ phase: 'dive', status: 'ready' })
    createKeyHandler({ app: dive })({ key: 'Escape' })
    expect(dive.ctrl.exit).toHaveBeenCalledTimes(1)
  })

  it('5c. Escape does nothing at phase desk, and does nothing while the scene is loading', () => {
    const desk = makeApp({ phase: 'desk', status: 'ready' })
    createKeyHandler({ app: desk })({ key: 'Escape' })
    expect(desk.ctrl.exit).not.toHaveBeenCalled()

    const loading = makeApp({ phase: 'inside', status: 'loading' })
    createKeyHandler({ app: loading })({ key: 'Escape' })
    expect(loading.ctrl.exit).not.toHaveBeenCalled()
  })

  it('3a. Escape with the ◆ menu open closes the menu once and does not exit the laptop', () => {
    const app = makeApp({ menuOpen: true, phase: 'inside', status: 'ready' })
    createKeyHandler({ app })({ key: 'Escape' })
    expect(app.os.setMenu).toHaveBeenCalledTimes(1)
    expect(app.os.setMenu).toHaveBeenCalledWith(false)
    expect(app.ctrl.exit).not.toHaveBeenCalled()
  })

  it('3b. Escape with focus inside #menu-pop returns focus to #mb-logo', () => {
    const logo = document.createElement('button')
    logo.id = 'mb-logo'
    const pop = document.createElement('div')
    pop.id = 'menu-pop'
    const item = document.createElement('button')
    pop.appendChild(item)
    document.body.append(logo, pop)
    item.focus()
    try {
      const app = makeApp({ menuOpen: true, phase: 'inside', status: 'ready' })
      createKeyHandler({ app })({ key: 'Escape' })
      expect(document.activeElement).toBe(logo)
    } finally {
      document.body.innerHTML = ''
    }
  })

  it('3c. with the recruiter view and the ◆ menu both open, Escape closes only the recruiter view', () => {
    const app = makeApp({ recOpen: true, menuOpen: true, phase: 'inside', status: 'ready' })
    createKeyHandler({ app })({ key: 'Escape' })
    expect(app.ui.store.get().recOpen).toBe(false)
    expect(app.os.setMenu).not.toHaveBeenCalled()
    expect(app.ctrl.exit).not.toHaveBeenCalled()
  })

  it('3d. with the ◆ menu closed, Escape inside the laptop still exits once (unchanged)', () => {
    const app = makeApp({ menuOpen: false, phase: 'inside', status: 'ready' })
    createKeyHandler({ app })({ key: 'Escape' })
    expect(app.os.setMenu).not.toHaveBeenCalled()
    expect(app.ctrl.exit).toHaveBeenCalledTimes(1)
  })

  it('6. every key calls scene.api.pressKey(key); with sound on, a single character clicks and Shift does not', () => {
    const app = makeApp({ sndOn: true })
    const h = createKeyHandler({ app })
    h({ key: 'a' })
    expect(app.scene.api.pressKey).toHaveBeenLastCalledWith('a')
    expect(app.snd.click).toHaveBeenCalledTimes(1)
    h({ key: 'Shift' })
    expect(app.scene.api.pressKey).toHaveBeenLastCalledWith('Shift')
    expect(app.snd.click).toHaveBeenCalledTimes(1)
  })
})

// Konami holds the idle settle (stage/scrollIdle) while the code is being typed, so arrow keys
// do not open the laptop by settling the page halfway. API under test:
//   createKeyHandler({ app, hold, timers })
// `hold(true)` is called when two or more keys from the start of the code are in progress,
// `hold(false)` when the code completes, a key does not continue it, or 1.5 s pass with no key.
// `hold` is the scroll idle's `hold('konami', on)`; `timers` is createTimers()-shaped.
// The existing calls without `hold` keep working (the callback is optional).
describe('stage/keys: the Konami code holds the idle settle while it is typed', () => {
  const KONAMI_IDLE_MS = 1500

  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function setupHold(opts) {
    const app = makeApp(opts)
    const hold = vi.fn()
    const handler = createKeyHandler({ app, hold, timers: createTimers() })
    const press = (...keys) => keys.forEach((key) => handler({ key }))
    /** The last hold call decides: true while the code is held. */
    const held = () => hold.mock.calls.at(-1)?.[0] === true
    return { app, hold, press, held }
  }

  it('a single key does not hold the settle (one arrow is not the start of the code)', () => {
    const { press, hold } = setupHold()
    press('ArrowUp')
    expect(hold).not.toHaveBeenCalledWith(true)
  })

  it('two keys from the start of the code hold the settle', () => {
    const { press, held } = setupHold()
    press('ArrowUp', 'ArrowUp')
    expect(held()).toBe(true)
  })

  it('stays held through the middle of the code, then releases on completion, when disco and the achievement still fire', () => {
    const { app, press, held, hold } = setupHold({ osState: 'on' })
    press(...KONAMI.slice(0, 5))
    expect(held()).toBe(true)
    press(...KONAMI.slice(5, 9))
    expect(held()).toBe(true)
    expect(app.ach.unlock).not.toHaveBeenCalled()

    press('a')
    expect(held()).toBe(false)
    expect(hold).toHaveBeenLastCalledWith(false)
    expect(app.ach.unlock).toHaveBeenCalledWith('konami')
    expect(app.os.disco).toHaveBeenCalledTimes(1)
  })

  it('a key that does not continue the code releases the hold at once', () => {
    const { press, held } = setupHold()
    press('ArrowUp', 'ArrowUp', 'ArrowDown')
    expect(held()).toBe(true)
    press('x')
    expect(held()).toBe(false)
  })

  it('a wrong key on the third press (up, up, up) breaks the run and releases the hold', () => {
    const { press, held } = setupHold()
    press('ArrowUp', 'ArrowUp', 'ArrowUp')
    expect(held()).toBe(false)
  })

  it('1.5 s with no key releases the hold, and 1.49 s does not', () => {
    const { press, held } = setupHold()
    press('ArrowUp', 'ArrowUp')
    vi.advanceTimersByTime(KONAMI_IDLE_MS - 1)
    expect(held()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(held()).toBe(false)
  })

  it('every key restarts the 1.5 s wait', () => {
    const { press, held } = setupHold()
    press('ArrowUp', 'ArrowUp')
    vi.advanceTimersByTime(1000)
    press('ArrowDown')
    vi.advanceTimersByTime(1000)
    expect(held()).toBe(true)
    vi.advanceTimersByTime(500)
    expect(held()).toBe(false)
  })
})

// Round 3 Phase R3-2 (plan-r3 V16, I18): the résumé view takes the keys for scrolling, not the 3D
// laptop. Esc changes nothing there, keys do not press 3D keys or play clicks, and Konami unlocks.
describe('stage/keys: the résumé view (V16, I18)', () => {
  it('Escape in the résumé view does not exit the laptop, even at phase inside, and closes nothing', () => {
    const app = makeApp({ view: 'resume', phase: 'inside', status: 'ready', recOpen: true, menuOpen: true })
    createKeyHandler({ app })({ key: 'Escape' })
    expect(app.ctrl.exit).not.toHaveBeenCalled()
    expect(app.ui.store.get().recOpen).toBe(true)
    expect(app.os.setMenu).not.toHaveBeenCalled()
  })

  it('Escape in the résumé view with the Recruiter view closed changes no store', () => {
    const app = makeApp({ view: 'resume', phase: 'inside', status: 'ready', recOpen: false })
    const before = app.ui.store.get()
    createKeyHandler({ app })({ key: 'Escape' })
    expect(app.ui.store.get()).toBe(before)
    expect(app.ctrl.exit).not.toHaveBeenCalled()
  })

  it('a key in the résumé view is not pressed on the 3D keyboard, and a single character makes no key click with sound on', () => {
    const app = makeApp({ view: 'resume', sndOn: true })
    createKeyHandler({ app })({ key: 'a' })
    expect(app.scene.api.pressKey).not.toHaveBeenCalled()
    expect(app.snd.click).not.toHaveBeenCalled()
  })

  it('the Konami code still unlocks in the résumé view, with its toast and disco', () => {
    const app = makeApp({ view: 'resume', osState: 'on' })
    const h = createKeyHandler({ app })
    KONAMI.forEach((key) => h({ key }))
    expect(app.ach.unlock).toHaveBeenCalledWith('konami')
    expect(app.toasts.toast).toHaveBeenCalledWith('Cheat code', 'Disco mode enabled. You’re welcome.', 'info')
    expect(app.os.disco).toHaveBeenCalledTimes(1)
    expect(app.scene.api.pressKey).not.toHaveBeenCalled()
  })

  it('in the laptop view the keys still press, click and exit (tests 5b, 3a and 6 with views.get() laptop)', () => {
    const exits = makeApp({ view: 'laptop', phase: 'inside', status: 'ready' })
    createKeyHandler({ app: exits })({ key: 'Escape' })
    expect(exits.ctrl.exit).toHaveBeenCalledTimes(1)

    const menu = makeApp({ view: 'laptop', menuOpen: true, phase: 'inside', status: 'ready' })
    createKeyHandler({ app: menu })({ key: 'Escape' })
    expect(menu.os.setMenu).toHaveBeenCalledWith(false)
    expect(menu.ctrl.exit).not.toHaveBeenCalled()

    const typed = makeApp({ view: 'laptop', sndOn: true })
    createKeyHandler({ app: typed })({ key: 'a' })
    expect(typed.scene.api.pressKey).toHaveBeenLastCalledWith('a')
    expect(typed.snd.click).toHaveBeenCalledTimes(1)
  })
})
