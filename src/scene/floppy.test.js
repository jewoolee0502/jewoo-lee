// Phase 7 TEST LIST: scene/floppy.test.js. A fake tween runner records calls; flush() runs the
// queued done callbacks (and any tweens they queue) in order, like the rAF tween loop does.
import { describe, it, expect, vi } from 'vitest'
import { createFloppySequencer, FLOPPIES } from './floppy.js'

function fakeTweens() {
  const queue = []
  const calls = []
  const tween = vi.fn((obj, to, dur, done) => {
    const rec = { obj, to, dur, done }
    queue.push(rec)
    calls.push(rec)
  })
  // step(): finish the oldest running tween (its done may queue more). flush(): finish all.
  const step = () => {
    const next = queue.shift()
    next?.done?.()
  }
  const flush = () => {
    while (queue.length) step()
  }
  return { tween, calls, step, flush }
}

const floppy = (label, app, n) => ({
  m: { name: `m${n}` },
  label,
  app,
  home: [2 + n, 0.1, 1, 0],
})

describe('scene/floppy', () => {
  it('inserting floppy 0 with an empty drive gives 2 tweens (in-pose, then drive pose), then onInserted', () => {
    const { tween, calls, step } = fakeTweens()
    const onInserted = vi.fn()
    const seq = createFloppySequencer({ tween, onInserted })
    const f0 = floppy('PROJECTS', 'projects', 0)

    seq.insert(f0)
    expect(calls).toHaveLength(1)
    expect(calls[0].obj).toBe(f0.m)
    expect(calls[0].to.p).toEqual({ x: 2.35, y: 0.09, z: 0.9 })
    expect(calls[0].dur).toBe(0.45)
    expect(onInserted).not.toHaveBeenCalled()

    step()
    expect(calls).toHaveLength(2)
    expect(calls[1].obj).toBe(f0.m)
    expect(calls[1].to.p).toEqual({ x: 1.2, y: 0.09, z: 0.9 })
    expect(calls[1].dur).toBe(0.35)
    expect(onInserted).not.toHaveBeenCalled()

    step()
    expect(onInserted).toHaveBeenCalledTimes(1)
    expect(onInserted).toHaveBeenCalledWith(f0)
  })

  it('inserting 1 while 0 is in the drive tweens 0 to the out-pose (2.3,.09,.9) for .3 s and then home for .45 s', () => {
    const { tween, calls, step, flush } = fakeTweens()
    const seq = createFloppySequencer({ tween, onInserted: vi.fn() })
    const f0 = floppy('PROJECTS', 'projects', 0)
    const f1 = floppy('GAMES', 'bugs', 1)
    seq.insert(f0)
    flush()
    calls.length = 0

    seq.insert(f1)
    const outPose = calls.find((c) => c.obj === f0.m)
    expect(outPose).toBeDefined()
    expect(outPose.to.p).toEqual({ x: 2.3, y: 0.09, z: 0.9 })
    expect(outPose.dur).toBe(0.3)

    step()
    const home = calls.find((c) => c.obj === f0.m && c !== outPose)
    expect(home).toBeDefined()
    expect(home.to.p).toEqual({ x: f0.home[0], y: f0.home[1], z: f0.home[2] })
    expect(home.dur).toBe(0.45)
  })

  it('inserting floppy 0 again while it is in the drive gives no tween, only onInserted (which opens the app)', () => {
    const { tween, calls, flush } = fakeTweens()
    const onInserted = vi.fn()
    const seq = createFloppySequencer({ tween, onInserted })
    const f0 = floppy('PROJECTS', 'projects', 0)
    seq.insert(f0)
    flush()
    expect(onInserted).toHaveBeenCalledTimes(1)
    calls.length = 0
    tween.mockClear()

    seq.insert(f0)
    expect(tween).not.toHaveBeenCalled()
    expect(onInserted).toHaveBeenCalledTimes(2)
    expect(onInserted).toHaveBeenLastCalledWith(f0)
  })

  it('the floppy app mapping is PROJECTS → projects, GAMES → bugs, RESUME → resume (L1162)', () => {
    expect(FLOPPIES.map((f) => [f.label, f.app])).toEqual([
      ['PROJECTS', 'projects'],
      ['GAMES', 'bugs'],
      ['RESUME', 'resume'],
    ])
  })
})
