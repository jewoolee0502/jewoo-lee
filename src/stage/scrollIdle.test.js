// Round 2 Phase 2 TEST LIST: stage/scrollIdle.test.js. Settle trigger (R6): fires once the page
// has been still for IDLE_MS (160 ms), or at once on scrollend, and never while touch or pointer is held.
// Phase 6A (plan-r2 section 7, U6 and U7): onIdle receives { dir, travel }. dir is the user's last
// direction (a run of at least DIR_MIN_PX 8 px, so snap jitter is ignored); travel is the distance since the
// last rest. Programmatic (own) scrolls move the travel origin but never the direction.
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

  function setup(opts = {}) {
    const onIdle = vi.fn()
    const idle = createScrollIdle({ timers: createTimers(), onIdle, ...opts })
    return { idle, onIdle }
  }

  it('fires onIdle({dir: 1, travel: 50}) 160 ms after the last scroll that moved down', () => {
    const { idle, onIdle } = setup()
    idle.scroll(0)
    idle.scroll(50)
    vi.advanceTimersByTime(159)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onIdle).toHaveBeenCalledTimes(1)
    expect(onIdle).toHaveBeenCalledWith({ dir: 1, travel: 50 })
  })

  it('the direction is the last run of at least 8 px: 0, 50, 20 is a reversal, so dir −1 and travel 20', () => {
    const { idle, onIdle } = setup()
    idle.scroll(0)
    idle.scroll(50)
    idle.scroll(20)
    vi.advanceTimersByTime(160)
    expect(onIdle).toHaveBeenCalledWith({ dir: -1, travel: 20 })
  })

  it('a single move under 8 px sets no direction (dir 0)', () => {
    const { idle, onIdle } = setup()
    idle.scroll(0)
    idle.scroll(4)
    vi.advanceTimersByTime(160)
    expect(onIdle).toHaveBeenCalledWith({ dir: 0, travel: 4 })
  })

  it('scrollEnd() fires onIdle at once, without waiting for the timer', () => {
    const { idle, onIdle } = setup()
    idle.scroll(0)
    idle.scroll(40)
    idle.scrollEnd()
    expect(onIdle).toHaveBeenCalledTimes(1)
    expect(onIdle).toHaveBeenCalledWith({ dir: 1, travel: 40 })
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
    expect(onIdle).toHaveBeenCalledWith({ dir: 1, travel: 40 })
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

  // Phase 6A (U7): snap corrections are not reversals.
  it('snap jitter does not flip the direction: 0, 300, 296 gives dir 1 and travel 296', () => {
    const { idle, onIdle } = setup()
    idle.scroll(0)
    idle.scroll(300)
    idle.scroll(296)
    vi.advanceTimersByTime(160)
    expect(onIdle).toHaveBeenCalledWith({ dir: 1, travel: 296 })
  })

  it('a real reversal does flip it: 0, 300, 280 gives dir −1 and travel 280', () => {
    const { idle, onIdle } = setup()
    idle.scroll(0)
    idle.scroll(300)
    idle.scroll(280)
    vi.advanceTimersByTime(160)
    expect(onIdle).toHaveBeenCalledWith({ dir: -1, travel: 280 })
  })

  it('own moves (glide frames) move the origin but not the direction: from 0, own 500 then user 520 gives dir 1 and travel 20', () => {
    const { idle, onIdle } = setup({ y: 0 })
    idle.scroll(500, true)
    vi.advanceTimersByTime(0)
    idle.scroll(520)
    vi.advanceTimersByTime(160)
    expect(onIdle).toHaveBeenCalledWith({ dir: 1, travel: 20 })
  })

  it('a lone own move reports dir 0 and travel 0 (it is not the user going anywhere)', () => {
    const { idle, onIdle } = setup({ y: 0 })
    idle.scroll(500, true)
    vi.advanceTimersByTime(160)
    expect(onIdle).toHaveBeenCalledWith({ dir: 0, travel: 0 })
  })

  // F8: the remap's own instant scroll is read as neither a direction nor travel.
  it('F8: user 0 → 450 settles dir 1 and travel 450; then an own scroll to 270 settles dir 1 and travel 0', () => {
    const { idle, onIdle } = setup()
    idle.scroll(0)
    idle.scroll(450)
    vi.advanceTimersByTime(160)
    expect(onIdle).toHaveBeenLastCalledWith({ dir: 1, travel: 450 })
    idle.scroll(270, true)
    vi.advanceTimersByTime(160)
    expect(onIdle).toHaveBeenLastCalledWith({ dir: 1, travel: 0 })
  })

  it('the direction persists across rests: after dir 1, a lone own scroll still reports dir 1', () => {
    const { idle, onIdle } = setup()
    idle.scroll(0)
    idle.scroll(100)
    vi.advanceTimersByTime(160)
    idle.scroll(60, true)
    vi.advanceTimersByTime(160)
    expect(onIdle.mock.calls.at(-1)[0].dir).toBe(1)
  })
})
