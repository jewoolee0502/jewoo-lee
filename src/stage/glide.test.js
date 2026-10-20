// Round 3 Phase R3-1 TEST LIST: stage/glide.test.js. Own rAF-driven glide for programmatic scrolls (R7).
// Fake rAF queue and fake clock: frame(ms) advances the clock and runs every queued callback.
// Round 3 (plan-r3 V4): the CSS snap hold is gone, so the glide has no hold option. jump() is an instant
// programmatic write, and every write records what it wrote so owns(y) can tell it from a user scroll.
import { describe, it, expect, vi } from 'vitest'
import { createGlide, glideDuration } from './glide.js'
import { OWN_TOL_PX } from '../core/constants.js'

function harness({ y = 0, reduce = false, options = {} } = {}) {
  const env = { y, reduce, t: 0 }
  const queue = new Map()
  let nextId = 1
  const scrollTo = vi.fn((o) => {
    env.y = o.top
  })
  const raf = vi.fn((cb) => {
    const id = nextId++
    queue.set(id, cb)
    return id
  })
  const caf = vi.fn((id) => {
    queue.delete(id)
  })
  const glide = createGlide({
    getY: () => env.y,
    scrollTo,
    raf,
    caf,
    now: () => env.t,
    reduce: () => env.reduce,
    ...options,
  })
  const frame = (ms = 16) => {
    env.t += ms
    const cbs = [...queue.values()]
    queue.clear()
    for (const cb of cbs) cb(env.t)
  }
  const runToEnd = (max = 500) => {
    for (let i = 0; i < max && glide.active; i++) frame()
  }
  return { env, scrollTo, raf, caf, glide, frame, runToEnd, queue }
}

describe('stage/glide', () => {
  it('glideDuration is 0.35 + 0.55·dist/H seconds, clamped to [0.35, 1.4]', () => {
    expect(glideDuration(1000, 1000)).toBeCloseTo(0.9, 9)
    expect(glideDuration(0, 1000)).toBe(0.35)
    expect(glideDuration(5000, 1000)).toBe(1.4)
  })

  it('to(1000) from 0 writes only instant scrolls, non-decreasing, ending exactly on 1000, then stops', () => {
    const h = harness({ y: 0 })
    h.glide.to(1000)
    expect(h.glide.active).toBe(true)
    h.runToEnd()
    expect(h.scrollTo.mock.calls.length).toBeGreaterThan(1)
    for (const [o] of h.scrollTo.mock.calls) expect(o.behavior).toBe('instant')
    const tops = h.scrollTo.mock.calls.map(([o]) => o.top)
    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThanOrEqual(tops[i - 1])
    expect(tops.at(-1)).toBe(1000)
    expect(h.glide.active).toBe(false)
    expect(h.queue.size).toBe(0)
  })

  it('cancel() mid-way stops further writes and cancels the pending frame', () => {
    const h = harness({ y: 0 })
    h.glide.to(1000, { duration: 1 })
    h.frame()
    h.frame()
    const before = h.scrollTo.mock.calls.length
    h.glide.cancel()
    expect(h.glide.active).toBe(false)
    expect(h.caf).toHaveBeenCalled()
    h.frame()
    h.frame()
    expect(h.scrollTo.mock.calls.length).toBe(before)
    expect(h.queue.size).toBe(0)
  })

  it('onScroll within 2 px of the last written value keeps the glide running', () => {
    const h = harness({ y: 0 })
    h.glide.to(1000, { duration: 1 })
    h.frame()
    const last = h.scrollTo.mock.calls.at(-1)[0].top
    h.glide.onScroll(last + 1)
    expect(h.glide.active).toBe(true)
    h.frame()
    expect(h.scrollTo.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('onScroll more than 2 px away from the last written value cancels it (scrollbar drag, Safari)', () => {
    const h = harness({ y: 0 })
    h.glide.to(1000, { duration: 1 })
    h.frame()
    const last = h.scrollTo.mock.calls.at(-1)[0].top
    h.glide.onScroll(last + 3)
    expect(h.glide.active).toBe(false)
  })

  it('reduced motion: one instant scrollTo to the target, and no animation frame', () => {
    const h = harness({ y: 0, reduce: true })
    h.glide.to(1000)
    expect(h.scrollTo).toHaveBeenCalledTimes(1)
    expect(h.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'instant' })
    expect(h.raf).not.toHaveBeenCalled()
    expect(h.glide.active).toBe(false)
  })

  it('a second to(0) while active replaces the first, and the final value is 0', () => {
    const h = harness({ y: 0 })
    h.glide.to(1000, { duration: 1 })
    h.frame()
    h.glide.to(0, { duration: 0.5 })
    h.runToEnd()
    expect(h.scrollTo.mock.calls.at(-1)[0].top).toBe(0)
    expect(h.glide.active).toBe(false)
  })

  // R3-1 (V4): nothing the glide does suspends anything any more. On every write path (frames, the
  // last frame, a cancel mid-glide, jump, a reduced-motion to), a stale `hold` option is never called,
  // <html> keeps its classes and attributes (no snap-hold), and the only effect is instant scrollTo writes.
  it('has no snap hold: a stale hold option is never called, <html> never changes, and every write is an instant scrollTo', () => {
    const html = document.documentElement
    const attrs = () => [...html.attributes].map((a) => `${a.name}=${a.value}`).sort()
    const before = attrs()
    const hold = vi.fn()
    const h = harness({ y: 0, options: { hold } })
    h.glide.to(1000)
    h.frame()
    expect(attrs()).toEqual(before)
    h.runToEnd()
    h.glide.to(0, { duration: 1 })
    h.frame()
    h.glide.cancel()
    h.glide.jump(640)
    h.env.reduce = true
    h.glide.to(300)
    expect(hold).not.toHaveBeenCalled()
    expect(attrs()).toEqual(before)
    expect(h.scrollTo.mock.calls.length).toBeGreaterThan(3)
    for (const [arg] of h.scrollTo.mock.calls) expect(Object.keys(arg).sort()).toEqual(['behavior', 'top'])
    for (const [arg] of h.scrollTo.mock.calls) expect(arg.behavior).toBe('instant')
    expect(h.scrollTo.mock.calls.at(-1)[0].top).toBe(300)
  })

  // jump(top) is the instant programmatic write used by the resize remap.
  describe('jump', () => {
    it('jump(640) during a glide stops it, then writes 640 once', () => {
      const h = harness({ y: 0 })
      h.glide.to(1000, { duration: 1 })
      h.frame()
      const n = h.scrollTo.mock.calls.length
      h.glide.jump(640)
      h.frame()
      h.frame()
      expect(h.glide.active).toBe(false)
      expect(h.scrollTo.mock.calls.slice(n)).toEqual([[{ top: 640, behavior: 'instant' }]])
    })
  })

  // owns(y) is true for a value within OWN_TOL_PX (5) of the last write, for OWN_MS (300) after it.
  // An external cancel() ends the window at once.
  describe('owns (U7)', () => {
    it('after a jump to 640, owns is true just inside OWN_TOL_PX and false just outside it', () => {
      const h = harness({ y: 0 })
      h.glide.jump(640)
      expect(h.glide.owns(640 + OWN_TOL_PX - 1)).toBe(true)
      expect(h.glide.owns(640 + OWN_TOL_PX + 1)).toBe(false)
    })

    it('a frame write is owned for 300 ms, then not', () => {
      const h = harness({ y: 0 })
      h.glide.to(1000, { duration: 1 })
      h.frame()
      const last = h.scrollTo.mock.calls.at(-1)[0].top
      const t0 = h.env.t
      expect(h.glide.owns(last + 3)).toBe(true)
      h.env.t = t0 + 299
      expect(h.glide.owns(last + 3)).toBe(true)
      h.env.t = t0 + 301
      expect(h.glide.owns(last + 3)).toBe(false)
    })

    it('an external cancel() ends the window at once', () => {
      const h = harness({ y: 0 })
      h.glide.jump(640)
      expect(h.glide.owns(642)).toBe(true)
      h.glide.cancel()
      expect(h.glide.owns(642)).toBe(false)
    })

    it('before any write, nothing is owned', () => {
      const h = harness({ y: 0 })
      expect(h.glide.owns(0)).toBe(false)
    })
  })
})
