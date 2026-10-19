// Phase 3 TEST LIST: stage/keys.test.js. Konami (L1039), key handler (L1040–1042), Escape.
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

function makeApp({ osState = 'on', reduce = false, status = 'ready', interactive = true, recOpen = false, sndOn = false, api = true } = {}) {
  return {
    ach: { unlock: vi.fn() },
    toasts: { toast: vi.fn() },
    snd: { store: createStore({ on: sndOn }), click: vi.fn() },
    motion: { reduce: () => reduce },
    os: { state: osState, disco: vi.fn() },
    scene: {
      store: createStore({ status }),
      api: api ? { pressKey: vi.fn(), disco: vi.fn() } : null,
    },
    ctrl: {
      store: createStore({ mode: 'inside', interactive, narrow: false }),
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

  it('5. Escape: with recOpen it closes the recruiter view and does not exit; interactive and ready exits; not interactive does nothing', () => {
    const recOpen = makeApp({ recOpen: true })
    createKeyHandler({ app: recOpen })({ key: 'Escape' })
    expect(recOpen.ui.store.get().recOpen).toBe(false)
    expect(recOpen.ctrl.exit).not.toHaveBeenCalled()

    const interactive = makeApp({ recOpen: false, interactive: true, status: 'ready' })
    createKeyHandler({ app: interactive })({ key: 'Escape' })
    expect(interactive.ctrl.exit).toHaveBeenCalledTimes(1)

    const idle = makeApp({ recOpen: false, interactive: false, status: 'ready' })
    createKeyHandler({ app: idle })({ key: 'Escape' })
    expect(idle.ctrl.exit).not.toHaveBeenCalled()
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
