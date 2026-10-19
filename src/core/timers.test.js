import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTimers } from './timers.js'

// Fake rAF/cAF built on the (faked) setTimeout, so vi.advanceTimersByTime drives them.
function makeTimers() {
  const raf = vi.fn((cb) => setTimeout(() => cb(0), 16))
  const caf = vi.fn((id) => clearTimeout(id))
  return { timers: createTimers({ raf, caf }), raf, caf }
}

describe('createTimers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('a timeout fires after its delay', () => {
    const { timers } = makeTimers()
    const fn = vi.fn()

    timers.timeout(fn, 100)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('clearAll cancels pending timeouts, intervals and rafs', () => {
    const { timers } = makeTimers()
    const timeoutFn = vi.fn()
    const intervalFn = vi.fn()
    const rafFn = vi.fn()

    timers.timeout(timeoutFn, 100)
    timers.interval(intervalFn, 50)
    timers.raf(rafFn)

    timers.clearAll()
    vi.advanceTimersByTime(1000)

    expect(timeoutFn).not.toHaveBeenCalled()
    expect(intervalFn).not.toHaveBeenCalled()
    expect(rafFn).not.toHaveBeenCalled()
  })

  it('a child group is cleared by its parent clearAll', () => {
    const { timers } = makeTimers()
    const child = timers.child()
    const fn = vi.fn()

    child.timeout(fn, 100)
    timers.clearAll()
    vi.advanceTimersByTime(1000)

    expect(fn).not.toHaveBeenCalled()
  })
})
