// Round 2 Phase 2 TEST LIST: stage/scrollIdle.test.js. Settle trigger (R6): fires once the page
// has been still for IDLE_MS (160 ms), or at once on scrollend, and never while touch or pointer is held.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createScrollIdle } from './scrollIdle.js'
import { createTimers } from '../core/timers.js'

describe('stage/scrollIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function setup() {
    const onIdle = vi.fn()
    const idle = createScrollIdle({ timers: createTimers(), onIdle })
    return { idle, onIdle }
  }

  it('fires onIdle(+1) 160 ms after the last scroll that moved down', () => {
    const { idle, onIdle } = setup()
    idle.scroll(0)
    idle.scroll(50)
    vi.advanceTimersByTime(159)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onIdle).toHaveBeenCalledTimes(1)
    expect(onIdle).toHaveBeenCalledWith(1)
  })

  it('the direction is the sign of the last non-zero move: 50 then 20 gives −1', () => {
    const { idle, onIdle } = setup()
    idle.scroll(50)
    idle.scroll(20)
    vi.advanceTimersByTime(160)
    expect(onIdle).toHaveBeenCalledWith(-1)
  })

  it('scrollEnd() fires onIdle at once, without waiting for the timer', () => {
    const { idle, onIdle } = setup()
    idle.scroll(0)
    idle.scroll(40)
    idle.scrollEnd()
    expect(onIdle).toHaveBeenCalledTimes(1)
    expect(onIdle).toHaveBeenCalledWith(1)
  })

  it('a touch hold blocks onIdle while held, and release re-arms the timer for 160 ms', () => {
    const { idle, onIdle } = setup()
    idle.hold('touch', true)
    idle.scroll(0)
    idle.scroll(40)
    vi.advanceTimersByTime(500)
    expect(onIdle).not.toHaveBeenCalled()
    idle.hold('touch', false)
    vi.advanceTimersByTime(160)
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('two holds (touch and pointer) need both released before onIdle fires', () => {
    const { idle, onIdle } = setup()
    idle.hold('touch', true)
    idle.hold('pointer', true)
    idle.scroll(0)
    idle.scroll(40)
    idle.hold('touch', false)
    vi.advanceTimersByTime(500)
    expect(onIdle).not.toHaveBeenCalled()
    idle.hold('pointer', false)
    vi.advanceTimersByTime(160)
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('dispose() cancels the pending timer', () => {
    const { idle, onIdle } = setup()
    idle.scroll(0)
    idle.scroll(40)
    idle.dispose()
    vi.advanceTimersByTime(500)
    expect(onIdle).not.toHaveBeenCalled()
  })
})
