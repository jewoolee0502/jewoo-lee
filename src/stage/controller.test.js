// Phase 3 TEST LIST: stage/controller.test.js. Port of L1011–1031 plus fixes B8, B9, B10.
// Harness: innerHeight H=1000, track height 2200 (max = 1200), rect.top = -scrollY.
// `at(y)` sets scrollY and runs one update with dt 0 (position only, no tween time).
// `step(sec)` runs update(.05) for sec / .05 frames.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createController } from './controller.js'
import { createTimers } from '../core/timers.js'
import { ss } from '../core/math.js'

const H = 1000
const TRACK_H = 2200

function setup() {
  const env = { scrollY: 0, status: 'ready', reduce: false, trackTop: null }
  const os = { state: 'standby', boot: vi.fn(), setFlat: vi.fn(), setLive: vi.fn() }
  const ui = { setCue: vi.fn(), setZoomed: vi.fn(), setTrap: vi.fn() }
  const scrollTo = vi.fn()
  const scrollToResume = vi.fn()
  const ctrl = createController({
    getTrackRect: () => ({ top: env.trackTop ?? -env.scrollY, height: TRACK_H, bottom: 0, left: 0, right: 0, width: 0 }),
    innerHeight: () => H,
    scrollY: () => env.scrollY,
    scrollTo,
    reduce: () => env.reduce,
    sceneStatus: () => env.status,
    os,
    ui,
    scrollToResume,
    timers: createTimers(),
  })
  const at = (y) => {
    env.scrollY = y
    ctrl.update(0)
  }
  const step = (sec) => {
    const n = Math.round(sec / 0.05)
    for (let i = 0; i < n; i++) ctrl.update(0.05)
  }
  const mode = () => ctrl.store.get().mode
  return { env, os, ui, scrollTo, scrollToResume, ctrl, at, step, mode }
}

describe('stage/controller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('1. at scrollY 0: p is 0, mode is desk, and the cue is .8', () => {
    const { ctrl, ui, at, mode } = setup()
    at(0)
    expect(ctrl.p).toBe(0)
    expect(mode()).toBe('desk')
    expect(ui.setCue).toHaveBeenLastCalledWith(0.8)
  })

  it('2. B8: a restored mid-track position does not auto-enter until the page passes back through the top', () => {
    const { ctrl, os, at, mode } = setup()
    at(360) // p .3 on the first update: armed starts null, so armed = (p < .01) = false
    expect(ctrl.armed).toBe(false)
    expect(mode()).toBe('desk')
    at(36)
    expect(mode()).toBe('desk')
    expect(os.boot).not.toHaveBeenCalled()
    at(0) // p < .01 re-arms
    expect(ctrl.armed).toBe(true)
    at(36)
    expect(mode()).toBe('inside')
    expect(os.boot).toHaveBeenCalledTimes(1)
  })

  it('3. p .02 does not enter; p .03 enters with boot once and a 1.9 s tween', () => {
    const { ctrl, os, at, mode } = setup()
    at(0)
    at(24) // p .02, not > .02
    expect(mode()).toBe('desk')
    at(36) // p .03
    expect(mode()).toBe('inside')
    expect(os.boot).toHaveBeenCalledTimes(1)
    expect(ctrl.tw.dur).toBe(1.9)
  })

  it('4. the eased tween reaches z .5 at .95 s, then z 1 with the tween cleared and inside interactive', () => {
    const { ctrl, ui, os, at, step, mode } = setup()
    at(0)
    at(36)
    step(0.95)
    expect(ctrl.z).toBeCloseTo(0.5, 1)
    expect(Math.abs(ctrl.z - 0.5)).toBeLessThanOrEqual(0.01)
    // 1.9 s total. Stepped in .05 s frames, 38 frames can land just short of t = 1
    // because of float rounding, so one extra frame is taken to reach the clamped end.
    step(1.0)
    expect(ctrl.z).toBe(1)
    expect(ctrl.tw).toBeNull()
    expect(ctrl.store.get().interactive).toBe(true)
    expect(ui.setZoomed).toHaveBeenLastCalledWith(true)
    expect(os.setLive).toHaveBeenLastCalledWith(true)
    expect(ui.setTrap).toHaveBeenLastCalledWith(true)
    expect(os.setFlat).toHaveBeenLastCalledWith(false, false)
    expect(mode()).toBe('inside')
  })

  it('5. with narrow set first, the last setFlat call is (true, true) once interactive', () => {
    const { ctrl, os, at, step } = setup()
    ctrl.setNarrow(true)
    expect(os.setFlat).toHaveBeenLastCalledWith(false, true)
    at(0)
    at(36)
    step(2)
    expect(ctrl.z).toBe(1)
    expect(os.setFlat).toHaveBeenLastCalledWith(true, true)
  })

  it('6. exit from z 1 goes to desk with a 1.5 s tween and smooth-scrolls to the track top', () => {
    const { ctrl, ui, os, scrollTo, at, step, mode } = setup()
    at(0)
    at(36)
    step(2)
    ctrl.exit()
    expect(mode()).toBe('desk')
    expect(ctrl.tw.dur).toBe(1.5)
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    step(1.55)
    expect(ctrl.z).toBe(0)
    expect(ctrl.store.get().interactive).toBe(false)
    expect(ui.setZoomed).toHaveBeenLastCalledWith(false)
    expect(os.setLive).toHaveBeenLastCalledWith(false)
  })

  it('7. duration formulas: exit from .4 gives .6, exit from .3 gives .5, enter from .6 gives .76', () => {
    const a = setup()
    a.at(0)
    a.ctrl.z = 0.6
    a.ctrl.enter()
    expect(a.ctrl.tw.dur).toBeCloseTo(0.76, 9)

    const b = setup()
    b.at(0)
    b.at(36)
    b.ctrl.z = 0.4
    b.ctrl.exit()
    expect(b.ctrl.tw.dur).toBeCloseTo(0.6, 9)

    const c = setup()
    c.at(0)
    c.at(36)
    c.ctrl.z = 0.3
    c.ctrl.exit()
    expect(c.ctrl.tw.dur).toBeCloseTo(0.5, 9)
  })

  it('8. reduced motion: enter tween .01 and scrollTo behavior auto, both for enter and exit', () => {
    const { env, ctrl, scrollTo, at } = setup()
    env.reduce = true
    at(0)
    env.trackTop = 200
    env.scrollY = 50
    ctrl.enter()
    expect(ctrl.tw.dur).toBe(0.01)
    expect(scrollTo).toHaveBeenCalledWith({ top: 252, behavior: 'auto' })
    env.trackTop = null
    at(36)
    ctrl.exit()
    expect(ctrl.tw.dur).toBe(0.01)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' })
  })

  it('9. armed: p .67 disarms; then p .005 re-arms and p .03 enters', () => {
    const { ctrl, at, mode } = setup()
    at(0)
    at(800)
    expect(ctrl.armed).toBe(false)
    at(36)
    expect(mode()).toBe('desk')
    at(6)
    expect(ctrl.armed).toBe(true)
    at(36)
    expect(mode()).toBe('inside')
  })

  it('10. enter() twice: the second call keeps the same tween object', () => {
    const { ctrl, at } = setup()
    at(0)
    ctrl.enter()
    const tw = ctrl.tw
    ctrl.enter()
    expect(ctrl.tw).toBe(tw)
  })

  it('11. exit during the enter tween at z about .3 starts from .3 and goes to 0', () => {
    const { ctrl, at, step, mode } = setup()
    at(0)
    at(36)
    while (ctrl.z < 0.3) step(0.05)
    // One .05 s frame moves z by up to ~.06 around here, so the first z >= .3 lands in [.3, .4).
    const z = ctrl.z
    expect(z).toBeGreaterThanOrEqual(0.3)
    expect(z).toBeLessThan(0.4)
    ctrl.exit()
    expect(mode()).toBe('desk')
    expect(ctrl.tw.from).toBe(z)
    expect(ctrl.tw.to).toBe(0)
  })

  it('12. enter() with the page above the track (rect.top 200, scrollY 50) scrolls to 252', () => {
    const { env, ctrl, scrollTo, at } = setup()
    at(0)
    env.scrollY = 50
    env.trackTop = 200
    ctrl.enter()
    expect(scrollTo).toHaveBeenCalledWith({ top: 252, behavior: 'smooth' })
  })

  it('13. status loading: no enter and cue .8; once status is ready the next update enters', () => {
    const { env, ui, os, at, mode } = setup()
    env.status = 'loading'
    at(0)
    at(36)
    expect(mode()).toBe('desk')
    expect(ui.setCue).toHaveBeenLastCalledWith(0.8)
    expect(os.boot).not.toHaveBeenCalled()
    env.status = 'ready'
    at(36)
    expect(mode()).toBe('inside')
  })

  it('14. status unavailable: cue is 1 - ss(.01,.2,p), boot at p > .1 when standby, enter is a no-op, applyFlat forces (true, true)', () => {
    const { env, ui, os, ctrl, at, mode } = setup()
    env.status = 'unavailable'
    at(120) // p .1
    expect(ui.setCue).toHaveBeenLastCalledWith(1 - ss(0.01, 0.2, 0.1))
    expect(os.boot).not.toHaveBeenCalled()
    at(132) // p .11
    expect(os.boot).toHaveBeenCalledTimes(1)
    ctrl.enter()
    expect(mode()).toBe('desk')
    expect(ctrl.tw).toBeNull()
    expect(os.boot).toHaveBeenCalledTimes(1)
    ctrl.applyFlat()
    expect(os.setFlat).toHaveBeenLastCalledWith(true, true)
  })

  it('15. goToResume while inside at z 1: desk, no scrollTo, then scrollToResume after 1.5 s + 100 ms, and no re-enter until p > .6', () => {
    const { env, ctrl, os, scrollTo, scrollToResume, at, step, mode } = setup()
    at(0)
    at(36)
    step(2)
    expect(ctrl.z).toBe(1)
    ctrl.goToResume()
    expect(mode()).toBe('desk')
    expect(scrollTo).not.toHaveBeenCalled()
    expect(scrollToResume).not.toHaveBeenCalled()
    step(1.55)
    vi.advanceTimersByTime(100)
    expect(scrollToResume).toHaveBeenCalledWith('smooth')
    at(0)
    at(12)
    at(36)
    at(400)
    expect(mode()).toBe('desk')
    expect(os.boot).toHaveBeenCalledTimes(1)
    at(800) // p .67 clears suppress
    at(0)
    at(36)
    expect(mode()).toBe('inside')
    expect(env.scrollY).toBe(36)
  })

  it('16. goToResume in desk mode calls scrollToResume at once, with auto under reduced motion', () => {
    const a = setup()
    a.at(0)
    a.ctrl.goToResume()
    expect(a.scrollToResume).toHaveBeenCalledTimes(1)
    expect(a.scrollToResume).toHaveBeenCalledWith('smooth')

    const b = setup()
    b.env.reduce = true
    b.at(0)
    b.ctrl.goToResume()
    expect(b.scrollToResume).toHaveBeenLastCalledWith('auto')
  })

  it('17. no-WebGL fallback: applyFlat gives the OS the live class so window bodies scroll', () => {
    const { env, os, ctrl } = setup()
    env.status = 'unavailable'
    ctrl.applyFlat()
    expect(os.setLive).toHaveBeenLastCalledWith(true)
  })

  it('18. no-WebGL fallback: update() while p is past the top also gives the OS the live class', () => {
    const { env, os, at } = setup()
    env.status = 'unavailable'
    at(0)
    at(120)
    expect(os.setLive).toHaveBeenLastCalledWith(true)
  })
})

// Bug K: focus moving to the résumé while inside the laptop leaves the laptop without scrolling.
describe('stage/controller leave()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('K1. leave() from z 1 tweens z to 0 over max(.5, 1.5 * z) s and sets mode desk', () => {
    const { ctrl, at, step, mode } = setup()
    at(0)
    at(36)
    step(2)
    expect(ctrl.z).toBe(1)
    ctrl.leave()
    expect(mode()).toBe('desk')
    expect(ctrl.tw).toMatchObject({ from: 1, to: 0, dur: 1.5 })
    step(1.55)
    expect(ctrl.z).toBe(0)
    expect(ctrl.tw).toBeNull()
  })

  it('K2. leave() never scrolls, even when the page is below the top of the track', () => {
    const { scrollTo, scrollToResume, at, step, ctrl } = setup()
    at(0)
    at(36)
    step(2)
    at(600) // p .3, well past the .005 threshold that exit() scrolls at
    ctrl.leave()
    step(2)
    expect(scrollTo).not.toHaveBeenCalled()
    expect(scrollToResume).not.toHaveBeenCalled()
  })

  it('K3. after leave(), update() at the same p does not re-enter the laptop', () => {
    const { os, at, step, ctrl, mode } = setup()
    at(0)
    at(36)
    step(2)
    ctrl.leave()
    step(2)
    at(36)
    expect(ctrl.suppress).toBe(true)
    expect(ctrl.armed).toBe(false)
    expect(mode()).toBe('desk')
    expect(os.boot).toHaveBeenCalledTimes(1)
  })

  it('K4. after leave(), returning to the top does not re-enter until the page passes p .6 again', () => {
    const { os, at, step, ctrl, mode } = setup()
    at(0)
    at(36)
    step(2)
    ctrl.leave()
    step(2)
    at(0)
    at(36)
    expect(mode()).toBe('desk')
    at(800) // p .67 clears suppress
    at(0)
    at(36)
    expect(mode()).toBe('inside')
    expect(os.boot).toHaveBeenCalledTimes(2)
  })
})
