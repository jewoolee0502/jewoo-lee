// Round 2 Phase 4 TEST LIST 2 (R14): scene/floppy.test.js. A fake tween runner records calls;
// step() finishes the oldest tween (its done may queue more), flush() finishes them all, like the
// rAF tween loop does. Poses are rig coordinates: the front face of the base is at z 1.4 and a
// floppy is 0.5 wide and 0.52 deep (half sizes 0.25 and 0.26).
import { describe, it, expect, vi } from 'vitest'
import { createFloppySequencer, FLOPPIES, FLOPPY_PACE, SLIDE_X } from './floppy.js'

function fakeTweens() {
  const queue = []
  const calls = []
  const tween = vi.fn((obj, to, dur, done) => {
    const rec = { obj, to, dur, done }
    queue.push(rec)
    calls.push(rec)
  })
  const step = () => {
    const next = queue.shift()
    next?.done?.()
  }
  const flush = () => {
    while (queue.length) step()
  }
  return { tween, calls, step, flush }
}

// The real floppy table (PROJECTS 0, GAMES 1) with a fake mesh each, so the homes are the shipped ones.
const pilot = (n) => ({ ...FLOPPIES[n], m: { name: `m${n}` } })

const SLOT_X = 0.95
const APPROACH = { x: 0.95, y: 0.085, z: 1.75 }
const SEATED = { x: 0.95, y: 0.085, z: 1.19 }

/** The poses a floppy was sent to, in call order. */
const posesOf = (calls, obj) => calls.filter((c) => c.obj === obj).map((c) => c.to.p)

// Base footprint from the scene: x in [-1.5, 1.5], z up to the front face at 1.4.
const floppyHitsBase = (p) => p.x - 0.25 < 1.5 && p.x + 0.25 > -1.5 && p.z - 0.26 < 1.4
const isSlotPose = (p) => p.x === SLOT_X && p.y === 0.085

/**
 * Samples 20 points on every straight segment of a path (start pose first). A segment that runs
 * between two slot poses (APPROACH and SEATED, either way) is the one allowed run through the base;
 * its samples must stay at x 0.95 and y SLOT.y. Every other sample must keep the footprint clear.
 */
function clearanceErrors(path) {
  const errors = []
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]
    const b = path[i + 1]
    const slotRun = isSlotPose(a) && isSlotPose(b)
    for (let s = 0; s < 20; s++) {
      const t = s / 19
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
      if (slotRun) {
        if (Math.abs(p.x - SLOT_X) > 1e-9 || Math.abs(p.y - 0.085) > 1e-9) errors.push(`slot run ${i} leaves the slot`)
      } else if (floppyHitsBase(p)) {
        errors.push(`segment ${i} sample ${s} overlaps the base at ${JSON.stringify(p)}`)
      }
    }
  }
  return errors
}

describe('scene/floppy', () => {
  it('inserting floppy 0 into an empty drive: slide out, lift, lane, along to the slot, drop, seat (old 0.2, 0.15, 0.25, 0.3, 0.1, 0.35 s, each × FLOPPY_PACE), then onInserted once', () => {
    const { tween, calls, step } = fakeTweens()
    const onInserted = vi.fn()
    const seq = createFloppySequencer({ tween, onInserted })
    const f0 = pilot(0)

    seq.insert(f0)
    const want = [
      [{ x: SLIDE_X, y: 0.016, z: 0.75 }, 0.2],
      [{ x: SLIDE_X, y: 0.13, z: 0.75 }, 0.15],
      [{ x: SLIDE_X, y: 0.13, z: 1.75 }, 0.25],
      [{ x: 0.95, y: 0.13, z: 1.75 }, 0.3],
      [APPROACH, 0.1],
      [SEATED, 0.35],
    ]
    want.forEach(([p, dur], i) => {
      expect(calls, `pose ${i}`).toHaveLength(i + 1)
      expect(calls[i].obj).toBe(f0.m)
      expect(calls[i].to.p).toEqual(p)
      expect(calls[i].dur).toBeCloseTo(dur * FLOPPY_PACE, 10)
      expect(onInserted).not.toHaveBeenCalled()
      step()
    })
    expect(onInserted).toHaveBeenCalledTimes(1)
    expect(onInserted).toHaveBeenCalledWith(f0)
  })

  it('the floppy squares up to the drive (r.y 0) on its lift, which is vertical at the slide x and home z', () => {
    const { tween, calls, flush } = fakeTweens()
    const seq = createFloppySequencer({ tween, onInserted: vi.fn() })
    const f0 = pilot(0)
    seq.insert(f0)
    flush()
    const [slide, lift, lane] = posesOf(calls, f0.m)
    expect(lift.x).toBe(slide.x)
    expect(lift.z).toBe(f0.home[2])
    expect(calls[1].to.r.y).toBe(0)
    expect(lane.x).toBe(slide.x)
  })

  it('the seated pose leaves 0.05 of the floppy sticking out of the front face at z 1.4', () => {
    const { tween, calls, flush } = fakeTweens()
    const seq = createFloppySequencer({ tween, onInserted: vi.fn() })
    seq.insert(pilot(0))
    flush()
    const seated = calls[calls.length - 1].to.p
    expect(seated.z + 0.26 - 1.4).toBeCloseTo(0.05, 2)
  })

  it('inserting floppy 1 while floppy 0 is in the drive ejects 0 first: approach, up to the lane, along it to the slide x, over its home z, drop (turning back), slide in home', () => {
    const { tween, calls, flush } = fakeTweens()
    const seq = createFloppySequencer({ tween, onInserted: vi.fn() })
    const f0 = pilot(0)
    const f1 = pilot(1)
    seq.insert(f0)
    flush()
    calls.length = 0

    seq.insert(f1)
    const out = calls.filter((c) => c.obj === f0.m)
    expect(out.map((c) => c.to.p)).toEqual([
      APPROACH,
      { x: 0.95, y: 0.13, z: 1.75 },
      { x: SLIDE_X, y: 0.13, z: 1.75 },
      { x: SLIDE_X, y: 0.13, z: 0.75 },
      { x: SLIDE_X, y: 0.016, z: 0.75 },
      { x: 2.15, y: 0.016, z: 0.75 },
    ])
    const oldEjectDurs = [0.25, 0.1, 0.25, 0.2, 0.15, 0.2]
    expect(out).toHaveLength(oldEjectDurs.length)
    out.forEach((c, i) => expect(c.dur, `eject leg ${i}`).toBeCloseTo(oldEjectDurs[i] * FLOPPY_PACE, 10))
    expect(out[4].to.r.y).toBe(0.3)
  })

  it('the ejecting floppy finishes before the new one lifts', () => {
    const { tween, calls, flush } = fakeTweens()
    const seq = createFloppySequencer({ tween, onInserted: vi.fn() })
    const f0 = pilot(0)
    const f1 = pilot(1)
    seq.insert(f0)
    flush()
    calls.length = 0

    seq.insert(f1)
    flush()
    const lastOut = calls.map((c, i) => (c.obj === f0.m ? i : -1)).filter((i) => i >= 0).pop()
    const firstIn = calls.findIndex((c) => c.obj === f1.m)
    expect(firstIn).toBeGreaterThan(lastOut)
  })

  it('inserting floppy 1 after floppy 0 slides it out at its own height and z (0.048, 1.08)', () => {
    const { tween, calls, flush } = fakeTweens()
    const seq = createFloppySequencer({ tween, onInserted: vi.fn() })
    const f0 = pilot(0)
    const f1 = pilot(1)
    seq.insert(f0)
    flush()
    calls.length = 0
    seq.insert(f1)
    flush()
    const slide = posesOf(calls, f1.m)[0]
    expect(slide).toEqual({ x: SLIDE_X, y: 0.048, z: 1.08 })
  })

  it('inserting the floppy already in the drive gives no tween and calls onReopen (not onInserted again)', () => {
    const { tween, calls, flush } = fakeTweens()
    const onInserted = vi.fn()
    const onReopen = vi.fn()
    const seq = createFloppySequencer({ tween, onInserted, onReopen })
    const f0 = pilot(0)
    seq.insert(f0)
    flush()
    expect(onInserted).toHaveBeenCalledTimes(1)
    calls.length = 0
    tween.mockClear()

    seq.insert(f0)
    expect(tween).not.toHaveBeenCalled()
    expect(calls).toHaveLength(0)
    expect(onReopen).toHaveBeenCalledWith(f0)
    expect(onInserted).toHaveBeenCalledTimes(1)
  })

  it('with no onReopen, reinserting the floppy in the drive falls back to onInserted (which opens the app)', () => {
    const { tween, flush } = fakeTweens()
    const onInserted = vi.fn()
    const seq = createFloppySequencer({ tween, onInserted })
    const f0 = pilot(0)
    seq.insert(f0)
    flush()
    seq.insert(f0)
    expect(onInserted).toHaveBeenCalledTimes(2)
    expect(onInserted).toHaveBeenLastCalledWith(f0)
  })

  it('no floppy path clips the base: every segment keeps its footprint clear, except the slot run at x 0.95', () => {
    const { tween, calls, flush } = fakeTweens()
    const seq = createFloppySequencer({ tween, onInserted: vi.fn() })
    const f0 = pilot(0)
    const f1 = pilot(1)

    seq.insert(f1)
    flush()
    const f1Home = { x: f1.home[0], y: f1.home[1], z: f1.home[2] }
    const f1Seated = posesOf(calls, f1.m).at(-1)
    const insertPathF1 = [f1Home, ...posesOf(calls, f1.m)]
    expect(clearanceErrors(insertPathF1)).toEqual([])

    calls.length = 0
    seq.insert(f0)
    flush()
    const insertPathF0 = [{ x: f0.home[0], y: f0.home[1], z: f0.home[2] }, ...posesOf(calls, f0.m)]
    const ejectPathF1 = [f1Seated, ...posesOf(calls, f1.m)]
    expect(clearanceErrors(insertPathF0)).toEqual([])
    expect(clearanceErrors(ejectPathF1)).toEqual([])
    expect(ejectPathF1.slice(1, 3)).toEqual([APPROACH, { x: 0.95, y: 0.13, z: 1.75 }])
  })

  it('the floppy app mapping is PROJECTS → projects, GAMES → bugs, RESUME → resume (L1162)', () => {
    expect(FLOPPIES.map((f) => [f.label, f.app])).toEqual([
      ['PROJECTS', 'projects'],
      ['GAMES', 'bugs'],
      ['RESUME', 'resume'],
    ])
  })
})

// Round 2 Phase 4 decisions (floppy). The pile: each resting floppy is a 0.5 × 0.52 footprint, 0.03
// thick (centre y = home y). A moving floppy's footprint may not overlap a resting one's while its
// own bottom is below that floppy's top. The lane height is LANE_Y 0.13 (written out here).
const LANE = 0.13
const HALF_T = 0.015
const restPose = (f) => ({ x: f.home[0], y: f.home[1], z: f.home[2] })
// A resting floppy carries its home yaw: its footprint is the 0.5 × 0.52 rectangle rotated by r.y.
const restingPose = (f) => ({ ...restPose(f), ry: f.home[3] })
const others = (i) => FLOPPIES.filter((_, j) => j !== i).map(restingPose)

/**
 * True when point p (world x, z) lies in resting floppy o's footprint: the 0.5 × 0.52 rectangle
 * (half sizes 0.25 and 0.26) rotated by o.ry about the vertical axis. The world offset is turned
 * back into the floppy's own frame with the inverse of the mesh's rotation.y.
 */
function inRotatedFootprint(p, o) {
  const dx = p.x - o.x
  const dz = p.z - o.z
  const c = Math.cos(o.ry)
  const s = Math.sin(o.ry)
  const lx = dx * c - dz * s
  const lz = dx * s + dz * c
  return Math.abs(lx) < 0.25 && Math.abs(lz) < 0.26
}

/** Errors for every sample of `path` (moving floppy centres) that sits in a resting floppy's rotated footprint below its top. */
function pileErrors(path, resting) {
  const errors = []
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]
    const b = path[i + 1]
    for (let s = 0; s < 20; s++) {
      const t = s / 19
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
      for (const o of resting) {
        const footprintHit = inRotatedFootprint(p, o)
        // Both sides: the moving floppy's bottom below the resting top AND its top above the resting
        // bottom (a floppy resting under another, 0.032 below, does not overlap it).
        const belowTop = p.y - HALF_T < o.y + HALF_T && p.y + HALF_T > o.y - HALF_T
        if (footprintHit && belowTop) errors.push(`segment ${i} sample ${s} at ${JSON.stringify(p)} passes through resting ${JSON.stringify(o)}`)
      }
    }
  }
  return errors
}

describe('scene/floppy pile clearance and queued clicks (round 2 phase 4 decisions)', () => {
  it.each([0, 1, 2])('inserting floppy %i from home never passes through another resting floppy', (i) => {
    const { tween, calls, flush } = fakeTweens()
    const seq = createFloppySequencer({ tween, onInserted: vi.fn() })
    const f = pilot(i)
    seq.insert(f)
    flush()
    const path = [restPose(FLOPPIES[i]), ...posesOf(calls, f.m)]
    expect(pileErrors(path, others(i))).toEqual([])
  })

  it.each([0, 1, 2])('insert of floppy %i first slides out sideways (+x) at its own height, then lifts to the lane', (i) => {
    const { tween, calls, flush } = fakeTweens()
    const seq = createFloppySequencer({ tween, onInserted: vi.fn() })
    const f = pilot(i)
    seq.insert(f)
    flush()
    const [slide, lift] = posesOf(calls, f.m)
    const home = restPose(FLOPPIES[i])
    expect(slide.y, 'slide at home height').toBe(home.y)
    expect(slide.z, 'slide keeps home z').toBe(home.z)
    expect(slide.x, 'slide goes +x').toBeGreaterThan(home.x)
    expect(lift).toEqual({ x: slide.x, y: LANE, z: home.z })
  })

  it.each([0, 1, 2])('ejecting floppy %i back home never passes through the resting pile (lane, drop, slide in)', (i) => {
    const { tween, calls, flush } = fakeTweens()
    const seq = createFloppySequencer({ tween, onInserted: vi.fn() })
    const out = pilot(i)
    const next = pilot((i + 1) % 3)
    seq.insert(out)
    flush()
    calls.length = 0
    seq.insert(next)
    flush()
    const ejectPath = [{ ...SEATED }, ...posesOf(calls, out.m)]
    expect(pileErrors(ejectPath, others(i))).toEqual([])
    expect(ejectPath.at(-1)).toEqual(restPose(FLOPPIES[i]))
  })

  it('a click during a running sequence is queued and runs after the current one finishes (not dropped)', () => {
    const { tween, calls, step, flush } = fakeTweens()
    const onInserted = vi.fn()
    const seq = createFloppySequencer({ tween, onInserted })
    const f0 = pilot(0)
    const f1 = pilot(1)
    seq.insert(f0)
    step()
    seq.insert(f1)
    expect(calls.every((c) => c.obj === f0.m), 'nothing for f1 until f0 is done').toBe(true)
    flush()
    expect(onInserted.mock.calls.map((c) => c[0])).toEqual([f0, f1])
    expect(seq.inDrive).toBe(f1)
    const lastF0 = calls.map((c, i) => (c.obj === f0.m ? i : -1)).filter((i) => i >= 0).pop()
    const firstF1 = calls.findIndex((c) => c.obj === f1.m)
    expect(firstF1).toBeGreaterThan(lastF0)
    expect(seq.busy).toBe(false)
  })

  it('of several clicks queued during a sequence only the last one runs (last one wins)', () => {
    const { tween, calls, step, flush } = fakeTweens()
    const onInserted = vi.fn()
    const seq = createFloppySequencer({ tween, onInserted })
    const f0 = pilot(0)
    const f1 = pilot(1)
    const f2 = pilot(2)
    seq.insert(f0)
    step()
    seq.insert(f1)
    seq.insert(f2)
    flush()
    expect(calls.some((c) => c.obj === f1.m), 'superseded floppy gets no tween').toBe(false)
    expect(onInserted.mock.calls.map((c) => c[0])).toEqual([f0, f2])
    expect(seq.inDrive).toBe(f2)
  })
})

describe('scene/floppy rotated pile footprint', () => {
  it('the footprint test uses the rotated 0.5 × 0.52 rectangle: a point inside the box but outside the yawed footprint is clear', () => {
    // Resting floppy at the origin, yawed 0.6 rad. World (0.2, 0.2) is inside the unrotated box,
    // but in the floppy's own frame it sits at lz ≈ 0.278, past the 0.26 half depth.
    const resting = [{ x: 0, y: 0.08, z: 0, ry: 0.6 }]
    // pileErrors samples segments, so the path needs two poses (a zero-length segment).
    const outside = [
      { x: 0.2, y: 0.08, z: 0.2 },
      { x: 0.2, y: 0.08, z: 0.2 },
    ]
    expect(pileErrors(outside, resting)).toEqual([])
  })

  it('a point inside the yawed footprint is flagged', () => {
    const resting = [{ x: 0, y: 0.08, z: 0, ry: 0.6 }]
    // World (0.1, 0): in the floppy's frame lx ≈ 0.083, lz ≈ 0.056, inside both half sizes.
    const inside = [
      { x: 0.1, y: 0.08, z: 0 },
      { x: 0.1, y: 0.08, z: 0 },
    ]
    expect(pileErrors(inside, resting).length).toBeGreaterThan(0)
  })

  it('the home yaws are used: each resting floppy is rotated by its own r.y (0.3, -0.2, 0.6)', () => {
    expect(FLOPPIES.map((f) => f.home[3])).toEqual([0.3, -0.2, 0.6])
    for (let i = 0; i < FLOPPIES.length; i++) {
      for (const o of others(i)) expect(typeof o.ry).toBe('number')
    }
    expect(others(0).map((o) => o.ry)).toEqual([-0.2, 0.6])
  })

  it.each([0, 1, 2])('floppy %i sits clear of the others at their rotated home footprints', (i) => {
    const moving = { ...restPose(FLOPPIES[i]), y: FLOPPIES[i].home[1] }
    for (const o of others(i)) {
      // Home poses are 0.2 or more apart along z or x, so no rotated footprint covers another centre.
      expect(inRotatedFootprint(moving, o), JSON.stringify(o)).toBe(false)
    }
  })

  it.each([
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 1],
  ])('swap %i → %i: the eject and the insert both keep the rotated pile clear', (a, b) => {
    const { tween, calls, flush } = fakeTweens()
    const seq = createFloppySequencer({ tween, onInserted: vi.fn() })
    const fa = pilot(a)
    const fb = pilot(b)
    seq.insert(fa)
    flush()
    calls.length = 0
    seq.insert(fb)
    flush()
    const ejectPath = [{ ...SEATED }, ...posesOf(calls, fa.m)]
    const insertPath = [restPose(FLOPPIES[b]), ...posesOf(calls, fb.m)]
    expect(pileErrors(ejectPath, others(a))).toEqual([])
    expect(pileErrors(insertPath, others(b))).toEqual([])
    expect(ejectPath.at(-1)).toEqual(restPose(FLOPPIES[a]))
  })
})

describe('scene/floppy timing with FLOPPY_PACE', () => {
  // Sums the recorded durations of every tween queued from the click up to the moment onInserted fires.
  function clickToInserted({ preload }) {
    const { tween, calls, flush } = fakeTweens()
    let total = null
    const onInserted = vi.fn(() => {
      total = calls.reduce((t, c) => t + c.dur, 0)
    })
    const seq = createFloppySequencer({ tween, onInserted })
    if (preload) {
      seq.insert(pilot(0))
      flush()
      calls.length = 0
      onInserted.mockClear()
      total = null
    }
    seq.insert(pilot(preload ? 1 : 0))
    flush()
    expect(onInserted).toHaveBeenCalledTimes(1)
    return total
  }

  it('FLOPPY_PACE is 0.65', () => {
    expect(FLOPPY_PACE).toBe(0.65)
  })

  it('click to onInserted with another floppy in the drive (eject then load) is at most 1.7 s', () => {
    const total = clickToInserted({ preload: true })
    expect(total).toBeLessThanOrEqual(1.7)
    // Old legs: eject 1.15 s + load 1.35 s = 2.5 s, scaled by FLOPPY_PACE.
    expect(total).toBeCloseTo((1.15 + 1.35) * FLOPPY_PACE, 10)
  })

  it('click to onInserted with an empty drive (load only) is at most 0.9 s', () => {
    const total = clickToInserted({ preload: false })
    expect(total).toBeLessThanOrEqual(0.9)
    expect(total).toBeCloseTo(1.35 * FLOPPY_PACE, 10)
  })
})
