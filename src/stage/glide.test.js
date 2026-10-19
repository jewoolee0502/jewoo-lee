// Round 2 Phase 2 TEST LIST: stage/glide.test.js. Own rAF-driven glide for programmatic scrolls (R7).
// Fake rAF queue and fake clock: frame(ms) advances the clock and runs every queued callback.
// Phase 6A (plan-r2 section 7, U3 and U7): the glide holds the CSS snap around its writes, jump() is an
// instant programmatic write, and every write records what it wrote so owns(y) can tell it from a user scroll.
import { describe, it, expect, vi } from 'vitest'
import { createGlide, glideDuration } from './glide.js'

function harness({ y = 0, reduce = false } = {}) {
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
  const hold = vi.fn()
  const glide = createGlide({
    getY: () => env.y,
    scrollTo,
    raf,
    caf,
    now: () => env.t,
    reduce: () => env.reduce,
    hold,
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
  return { env, scrollTo, raf, caf, hold, glide, frame, runToEnd, queue }
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

  // Phase 6A (U3): programmatic writes suspend the CSS snap (html.snap-hold) around themselves.
  describe('snap hold (U3)', () => {
    it('to(1000): hold(true) before the first write, hold(false) after the last, and nothing else', () => {
      const h = harness({ y: 0 })
      h.glide.to(1000)
      h.runToEnd()
      expect(h.hold.mock.calls).toEqual([[true], [false]])
      expect(h.hold.mock.invocationCallOrder[0]).toBeLessThan(h.scrollTo.mock.invocationCallOrder[0])
      expect(h.hold.mock.invocationCallOrder[1]).toBeGreaterThan(h.scrollTo.mock.invocationCallOrder.at(-1))
    })

    it('cancel() mid-glide releases the hold once; cancel() when idle does not touch it', () => {
      const h = harness({ y: 0 })
      h.glide.to(1000, { duration: 1 })
      h.frame()
      h.hold.mockClear()
      h.glide.cancel()
      expect(h.hold.mock.calls).toEqual([[false]])
      h.hold.mockClear()
      h.glide.cancel()
      expect(h.hold).not.toHaveBeenCalled()
    })

    it('reduced motion: hold(true), one instant scrollTo 1000, then hold(false)', () => {
      const h = harness({ y: 0, reduce: true })
      h.glide.to(1000)
      expect(h.hold.mock.calls).toEqual([[true], [false]])
      expect(h.hold.mock.invocationCallOrder[0]).toBeLessThan(h.scrollTo.mock.invocationCallOrder[0])
      expect(h.hold.mock.invocationCallOrder[1]).toBeGreaterThan(h.scrollTo.mock.invocationCallOrder[0])
    })
  })

  // Phase 6A (U3): jump(top) is the instant programmatic write used by the resize remap and the detent.
  describe('jump (U3)', () => {
    it('jump(640) during a glide stops it, then writes 640 once with the hold around that write', () => {
      const h = harness({ y: 0 })
      h.glide.to(1000, { duration: 1 })
      h.frame()
      const n = h.scrollTo.mock.calls.length
      h.hold.mockClear()
      h.glide.jump(640)
      h.frame()
      h.frame()
      expect(h.glide.active).toBe(false)
      expect(h.scrollTo.mock.calls.slice(n)).toEqual([[{ top: 640, behavior: 'instant' }]])
      expect(h.hold.mock.calls.slice(-2)).toEqual([[true], [false]])
      expect(h.hold.mock.invocationCallOrder.at(-2)).toBeLessThan(h.scrollTo.mock.invocationCallOrder[n])
    })
  })

  // Phase 6A (U7): owns(y) is true for a value within SNAP_OWN_TOL_PX (5) of the last write, for
  // OWN_MS (300) after it. An external cancel() ends the window at once.
  describe('owns (U7)', () => {
    it('after a jump to 640, owns(644) is true (4 px) and owns(646) is false (6 px)', () => {
      const h = harness({ y: 0 })
      h.glide.jump(640)
      expect(h.glide.owns(644)).toBe(true)
      expect(h.glide.owns(646)).toBe(false)
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
