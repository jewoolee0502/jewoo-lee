// Round 2 Phase 2 TEST LIST: stage/keys.test.js. Konami (L1039), key handler (L1040–1042), Escape.
// Escape exits whenever the laptop is open (phase inside or dive), not on the interactive flag.
// Round 2 §7 6B TEST LIST item 3 (U12): Escape closes the ◆ menu first and returns focus to ◆ JAY-OS.
import { describe, it, expect, vi } from 'vitest'
import { pushKonami, createKeyHandler } from './keys.js'
import { createStore } from '../core/store.js'

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

function feed(buf, keys) {
  let matched = false
  for (const k of keys) {
    ;({ buf, matched } = pushKonami(buf, k))
  }
  return { buf, matched }
}

function makeApp({ osState = 'on', reduce = false, status = 'ready', phase = 'inside', recOpen = false, menuOpen = false, sndOn = false, api = true } = {}) {
  return {
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
