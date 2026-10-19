// Round 2 Phase 2 TEST LIST: stage/glide.test.js. Own rAF-driven glide for programmatic scrolls (R7).
// Fake rAF queue and fake clock: frame(ms) advances the clock and runs every queued callback.
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
  const glide = createGlide({
    getY: () => env.y,
    scrollTo,
    raf,
    caf,
    now: () => env.t,
    reduce: () => env.reduce,
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
})
