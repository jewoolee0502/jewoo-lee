// Round 2 Phase 2 TEST LIST: stage/runway.test.js. Pure scroll-model math (plan-r2 section 2).
// Phase 6A (plan-r2 section 7): U6 settle by direction, U8 plateau minimum, U9 cue, U2 snap points.
// Reference harness: H = 1000 (stage height), trackH = 2900 → R = 1900, diveEnd 1000,
// insideEnd 1120, outEnd 1720. Positions s are track-relative (s = −trackRect.top).
import { describe, it, expect } from 'vitest'
import {
  runwayLayout,
  poseAt,
  nextInteractive,
  settleTarget,
  remapScroll,
  wheelPixels,
  createDetent,
  cueOpacity,
  snapPoints,
} from './runway.js'

const H = 1000
const L = runwayLayout({ trackH: 2900, stageH: H })

describe('stage/runway', () => {
  describe('runwayLayout', () => {
    it('measures R = trackH − stageH and places the segment ends at 1.00 / 1.12 / 1.72 of R/1.9', () => {
      expect(L).toMatchObject({ R: 1900, diveEnd: 1000, insideEnd: 1120, outEnd: 1720 })
    })

    it('floors R at 1 when the track is no taller than the stage', () => {
      expect(runwayLayout({ trackH: 1000, stageH: 1000 }).R).toBe(1)
    })

    // Phase 6A (U8): the plateau is at least PLATEAU_MIN_PX (120), capped at half the out span.
    it('U8: 1280×720 (R 1368) gets a 120 px plateau: insideEnd 840, not 806', () => {
      expect(runwayLayout({ trackH: 2088, stageH: 720 })).toMatchObject({ R: 1368, diveEnd: 720, insideEnd: 840, outEnd: 1238 })
    })

    it('U8: on a tiny screen the minimum is capped at half the out span (trackH 580, stageH 200 → insideEnd 272)', () => {
      expect(runwayLayout({ trackH: 580, stageH: 200 })).toMatchObject({ diveEnd: 200, insideEnd: 272, outEnd: 344 })
    })

    it('U8: for phone and laptop heights the plateau is at least min(120, half the out span), and outEnd is unchanged', () => {
      for (const H of [390, 600, 720, 844, 900, 1000, 1366]) {
        const lay = runwayLayout({ trackH: 2.9 * H, stageH: H })
        const minGap = Math.min(120, Math.floor((lay.outEnd - lay.diveEnd) / 2))
        expect(lay.insideEnd - lay.diveEnd, `H ${H}`).toBeGreaterThanOrEqual(minGap)
        expect(lay.outEnd, `H ${H}`).toBe(Math.round((1.72 * lay.R) / 1.9))
      }
    })
  })

  describe('poseAt', () => {
    it('is closed above the track and at its top', () => {
      expect(poseAt(-50, L)).toMatchObject({ z: 0, seg: 'top' })
      expect(poseAt(0, L).z).toBe(0)
    })

    it('rises linearly through the dive: z 0.5 and u 0.5 at 500', () => {
      expect(poseAt(500, L)).toMatchObject({ z: 0.5, seg: 'dive', u: 0.5 })
    })

    it('is exactly 1 on the inside plateau', () => {
      expect(poseAt(1000, L)).toMatchObject({ z: 1, seg: 'inside' })
      expect(poseAt(1120, L)).toMatchObject({ z: 1, seg: 'inside' })
    })

    it('falls linearly through the out segment: z 0.5 at 1420', () => {
      expect(poseAt(1420, L)).toMatchObject({ z: 0.5, seg: 'out' })
    })

    it('is exactly 0 on the tail, and the stage is still pinned there', () => {
      expect(poseAt(1720, L)).toMatchObject({ z: 0, seg: 'tail' })
      expect(poseAt(1900, L).seg).toBe('tail')
    })

    it('is past the pinned range beyond R', () => {
      expect(poseAt(1901, L).seg).toBe('past')
    })

    it('invariant: z > 0 implies s ≤ R − 0.15·H, so the half-laptop state is impossible (H 1000, 600, 844)', () => {
      const cases = [
        { H: 1000, trackH: 2900 },
        { H: 600, trackH: 1740 },
        { H: 844, trackH: 2448 },
        { H: 720, trackH: 2088 },
      ]
      for (const c of cases) {
        const lay = runwayLayout({ trackH: c.trackH, stageH: c.H })
        const limit = lay.R - 0.15 * c.H
        for (let s = 0; s <= 3000; s++) {
          const { z } = poseAt(s, lay)
          if (z > 0) {
            expect(s, `H ${c.H} s ${s}`).toBeLessThanOrEqual(limit)
            expect(s, `H ${c.H} s ${s} pinned`).toBeLessThan(lay.R)
          }
        }
      }
    })
  })

  describe('nextInteractive (hysteresis, R8)', () => {
    it('turns on at z ≥ 0.999 and off below 0.985', () => {
      expect(nextInteractive(false, 0.998)).toBe(false)
      expect(nextInteractive(false, 0.999)).toBe(true)
      expect(nextInteractive(true, 0.99)).toBe(true)
      expect(nextInteractive(true, 0.984)).toBe(false)
    })
  })

  describe('settleTarget (R6; U6: the last user direction decides, a tiny movement returns)', () => {
    // SETTLE_TINY_PX is 16: a movement of 15 px is tiny, 16 px is not.
    it('dive: a downward rest glides on to diveEnd, however shallow (100 px travel)', () => {
      expect(settleTarget(100, L, 1, 100)).toBe(1000)
      expect(settleTarget(300, L, 1, 300)).toBe(1000)
    })

    it('dive: an upward rest glides back to the top, however deep (900 and 100 px travel)', () => {
      expect(settleTarget(900, L, -1, 100)).toBe(0)
      expect(settleTarget(300, L, -1, 100)).toBe(0)
    })

    it('a tiny movement (under 16 px) returns to the end behind it; 16 px counts as deliberate', () => {
      expect(settleTarget(10, L, 1, 10)).toBe(0)
      expect(settleTarget(990, L, -1, 10)).toBe(1000)
      expect(settleTarget(300, L, 1, 15)).toBe(0)
      expect(settleTarget(300, L, 1, 16)).toBe(1000)
    })

    it('no user direction (dir 0) splits at the middle of the dive: 500 opens, 499 closes', () => {
      expect(settleTarget(500, L, 0, 0)).toBe(1000)
      expect(settleTarget(499, L, 0, 0)).toBe(0)
    })

    it('out: a downward rest glides on to outEnd; a tiny nudge returns to insideEnd', () => {
      expect(settleTarget(1200, L, 1, 80)).toBe(1720)
      expect(settleTarget(1130, L, 1, 10)).toBe(1120)
    })

    it('out: an upward rest glides back to insideEnd, even past the middle; a tiny nudge goes on', () => {
      expect(settleTarget(1700, L, -1, 20)).toBe(1120)
      expect(settleTarget(1710, L, -1, 10)).toBe(1720)
    })

    it('a travel argument left out counts as a deliberate movement', () => {
      expect(settleTarget(300, L, 1)).toBe(1000)
    })

    it('rest points (plateau, top, tail, résumé) and resting exactly on a target give null', () => {
      for (const s of [0, 1000, 1120, 1060, 1720, 1800, 2500]) {
        for (const dir of [1, -1]) {
          expect(settleTarget(s, L, dir), `s ${s} dir ${dir}`).toBeNull()
        }
      }
      expect(settleTarget(999.5, L, 1)).toBeNull()
    })
  })

  describe('remapScroll (resize keeps the segment and fraction)', () => {
    const L0 = runwayLayout({ trackH: 2900, stageH: 1000 })
    const L1 = runwayLayout({ trackH: 1740, stageH: 600 })

    it('L1 is R 1140 with diveEnd 600, insideEnd 720 (U8 minimum), outEnd 1032', () => {
      expect(L1).toMatchObject({ R: 1140, diveEnd: 600, insideEnd: 720, outEnd: 1032 })
    })

    it('maps each segment by its fraction and keeps the offset beyond R', () => {
      expect(remapScroll(1000, L0, L1)).toBe(600)
      expect(remapScroll(500, L0, L1)).toBe(300)
      expect(remapScroll(1060, L0, L1)).toBe(660)
      expect(remapScroll(1420, L0, L1)).toBe(876)
      expect(remapScroll(2000, L0, L1)).toBe(1240)
      expect(remapScroll(0, L0, L1)).toBe(0)
    })
  })

  // Phase 6A (U9): the scroll cue shows only at the top and fades out through the dive.
  describe('cueOpacity (U9)', () => {
    it('is 0.8 at the top', () => {
      expect(cueOpacity({ seg: 'top', z: 0 })).toBe(0.8)
    })

    it('fades through the dive: 0.4 at z 0.075 (half of smoothstep over 0 to 0.15)', () => {
      expect(cueOpacity({ seg: 'dive', z: 0.075 })).toBeCloseTo(0.4, 3)
    })

    it('is 0 in the dive from z 0.15 on', () => {
      expect(cueOpacity({ seg: 'dive', z: 0.15 })).toBe(0)
      expect(cueOpacity({ seg: 'dive', z: 0.5 })).toBe(0)
    })

    it('is 0 on the plateau, through the out segment, in the tail and past it', () => {
      expect(cueOpacity({ seg: 'inside', z: 1 })).toBe(0)
      expect(cueOpacity({ seg: 'out', z: 0.5 })).toBe(0)
      expect(cueOpacity({ seg: 'tail', z: 0 })).toBe(0)
      expect(cueOpacity({ seg: 'past', z: 0 })).toBe(0)
    })
  })

  // Phase 6A (U2): the rail positions. The stop is diveEnd; the points are every 8 px plus the plateau
  // and out ends, without diveEnd, ascending and unique.
  describe('snapPoints (U2)', () => {
    const L720 = runwayLayout({ trackH: 2088, stageH: 720 })

    it('stops at diveEnd and lists 362 points for the H 1000 layout (multiples of 8 from 0 to 2896, minus 1000)', () => {
      const { stop, points } = snapPoints(L)
      expect(stop).toBe(1000)
      expect(points).toHaveLength(362)
    })

    it('the points are strictly ascending, include 0, 8, 1120, 1720 and 2896, and stop before 2900', () => {
      const { points } = snapPoints(L)
      expect(points.every((p, i) => i === 0 || p > points[i - 1])).toBe(true)
      for (const p of [0, 8, 1120, 1720, 2896]) expect(points, `point ${p}`).toContain(p)
      expect(points).not.toContain(1000)
      expect(Math.max(...points)).toBeLessThanOrEqual(2900)
    })

    it('adds the plateau and out ends when they are not multiples of 8 (H 720: 840 and 1238)', () => {
      const { stop, points } = snapPoints(L720)
      expect(stop).toBe(720)
      expect(points).toContain(840)
      expect(points).toContain(1238)
      expect(points).not.toContain(720)
    })
  })

  describe('wheelPixels', () => {
    it('converts lines and pages to pixels', () => {
      expect(wheelPixels(3, 1, 800)).toBe(48)
      expect(wheelPixels(1, 2, 800)).toBe(800)
      expect(wheelPixels(120, 0, 800)).toBe(120)
    })
  })

  describe('createDetent (R5: one burst stops at the plateau start)', () => {
    // Helper: feed events 16 ms apart and apply `s += dy` for every event that is not blocked.
    function run(det, events, { s0, diveEnd = 1000 }) {
      let s = s0
      return events.map(({ t, dy, s: sOverride }) => {
        const cur = sOverride ?? s
        const r = det.onWheel({ t, dy, s: cur, diveEnd })
        if (r.snapTo != null) s = r.snapTo
        else if (!r.block) s = cur + dy
        return { ...r, s }
      })
    }

    it('the first event of a burst is free; the event that would cross the plateau holds at it', () => {
      const det = createDetent({})
      const out = run(det, [
        { t: 0, dy: 120 }, // 800 → 920, free
        { t: 16, dy: 110 }, // 920 + 110 crosses 1000: hold
        { t: 32, dy: 100 },
        { t: 48, dy: 90 },
        { t: 64, dy: 80 },
      ], { s0: 800 })
      expect(out[0]).toMatchObject({ block: false })
      expect(out[0].s).toBe(920)
      expect(out[1]).toEqual({ block: true, snapTo: 1000, s: 1000 })
      for (const r of out.slice(2)) expect(r).toMatchObject({ block: true, snapTo: null })
    })

    it('an event 130 ms after the held burst is a new burst and is free', () => {
      const det = createDetent({})
      run(det, [
        { t: 0, dy: 120 },
        { t: 16, dy: 110 },
        { t: 32, dy: 100 },
      ], { s0: 800 })
      const next = det.onWheel({ t: 32 + 130, dy: 20, s: 1000, diveEnd: 1000 })
      expect(next.block).toBe(false)
    })

    it('inside a held burst, a reversal (dy < 0) is free and releases the hold', () => {
      const det = createDetent({})
      run(det, [
        { t: 0, dy: 120 },
        { t: 16, dy: 110 },
      ], { s0: 800 })
      const r = det.onWheel({ t: 32, dy: -30, s: 1000, diveEnd: 1000 })
      expect(r.block).toBe(false)
    })

    it('inside a held burst, a sharp rise (baseline 93.5 after dy 110 then 10, then dy 160) is free and releases the hold', () => {
      const det = createDetent({})
      run(det, [
        { t: 0, dy: 120 },
        { t: 16, dy: 110 }, // holds; baseline 110
        { t: 32, dy: 10 }, // blocked; baseline max(10, 0.85 · 110) = 93.5
      ], { s0: 800 })
      // 160 > max(8, 1.6 · 93.5 = 149.6), so it releases.
      const r = det.onWheel({ t: 48, dy: 160, s: 1000, diveEnd: 1000 })
      expect(r.block).toBe(false)
    })

    it('a burst that starts at s ≥ 1000 never blocks', () => {
      const det = createDetent({})
      const out = run(det, [
        { t: 0, dy: 100 },
        { t: 16, dy: 100 },
        { t: 32, dy: 100 },
      ], { s0: 1000 })
      for (const r of out) expect(r.block).toBe(false)
    })

    it('a burst that starts at s 990 and whose first event crosses the plateau holds at 1000', () => {
      const det = createDetent({})
      const r = det.onWheel({ t: 0, dy: 40, s: 990, diveEnd: 1000 })
      expect(r).toEqual({ block: true, snapTo: 1000 })
    })

    it('a burst whose start was below 1000 but whose current s is already 1060 (smooth-scroll lag) holds at 1000', () => {
      const det = createDetent({})
      const first = det.onWheel({ t: 0, dy: 50, s: 900, diveEnd: 1000 })
      expect(first.block).toBe(false)
      const r = det.onWheel({ t: 16, dy: 30, s: 1060, diveEnd: 1000 })
      expect(r).toEqual({ block: true, snapTo: 1000 })
    })

    it('smooth-scroll lag margin: s = diveEnd + 119 mid-burst still holds at diveEnd', () => {
      const det = createDetent({})
      expect(det.onWheel({ t: 0, dy: 50, s: 900, diveEnd: 1000 }).block).toBe(false)
      expect(det.onWheel({ t: 16, dy: 30, s: 1119, diveEnd: 1000 })).toEqual({ block: true, snapTo: 1000 })
    })

    it('smooth-scroll lag margin: s = diveEnd + 120 mid-burst is a jump (touch or scrollbar): free, no snap', () => {
      const det = createDetent({})
      expect(det.onWheel({ t: 0, dy: 50, s: 900, diveEnd: 1000 }).block).toBe(false)
      expect(det.onWheel({ t: 16, dy: 30, s: 1120, diveEnd: 1000 })).toEqual({ block: false, snapTo: null })
    })

    it('a burst whose step lands EXACTLY on diveEnd (s + dy === diveEnd) counts as crossing: it holds, and a same-direction event within gapMs is blocked', () => {
      const det = createDetent({})
      const first = det.onWheel({ t: 0, dy: 200, s: 800, diveEnd: 1000 })
      expect(first).toEqual({ block: true, snapTo: 1000 })
      expect(det.holding(16)).toBe(true)
      const next = det.onWheel({ t: 16, dy: 50, s: 1000, diveEnd: 1000 })
      expect(next).toMatchObject({ block: true, snapTo: null })
      expect(det.holding(32)).toBe(true)
    })

    it('tiny negative jitter (dy −1 or −2) during a held burst does not release the hold', () => {
      for (const dy of [-1, -2]) {
        const det = createDetent({})
        run(det, [
          { t: 0, dy: 120 },
          { t: 16, dy: 110 },
        ], { s0: 800 })
        const r = det.onWheel({ t: 32, dy, s: 1000, diveEnd: 1000 })
        expect(r.block, `dy ${dy}`).toBe(true)
        expect(det.holding(32), `dy ${dy}`).toBe(true)
      }
    })

    it('a clear upward scroll (dy −40) during a held burst still releases the hold', () => {
      const det = createDetent({})
      run(det, [
        { t: 0, dy: 120 },
        { t: 16, dy: 110 },
      ], { s0: 800 })
      const r = det.onWheel({ t: 32, dy: -40, s: 1000, diveEnd: 1000 })
      expect(r.block).toBe(false)
    })
  })

  describe('createDetent (held baseline, decay and mid-burst edge)', () => {
    // Shared setup: diveEnd 500. Event 1 (t 0, dy 480, s 0) is free; event 2 (t 20, dy 40, s 480)
    // crosses 500, so it holds and snaps to 500. The hold's baseline is then lastAbs = 40.
    const D = 500
    function holdAt500(det) {
      expect(det.onWheel({ t: 0, dy: 480, s: 0, diveEnd: D })).toEqual({ block: false, snapTo: null })
      expect(det.onWheel({ t: 20, dy: 40, s: 480, diveEnd: D })).toEqual({ block: true, snapTo: 500 })
    }

    it('a dy 1 event during the hold does not lower the baseline, so the dy 9 events after it stay blocked', () => {
      const det = createDetent({})
      holdAt500(det)
      // Intended rule while held: B = max(abs, 0.85 · B); release when abs > max(8, 1.6 · B).
      // At t 40 the check uses B = 40 (1 > 64, no) and sets B = max(1, 34) = 34.
      // At t 60 the check uses B = 34: 9 > max(8, 54.4) is false, so the event is blocked.
      // B becomes max(9, 28.9) = 28.9, and at t 80: 9 > max(8, 46.2) is false, blocked.
      expect(det.onWheel({ t: 40, dy: 1, s: 500, diveEnd: D })).toEqual({ block: true, snapTo: null })
      expect(det.onWheel({ t: 60, dy: 9, s: 500, diveEnd: D })).toEqual({ block: true, snapTo: null })
      expect(det.onWheel({ t: 80, dy: 9, s: 500, diveEnd: D })).toEqual({ block: true, snapTo: null })
    })

    it('a dy 0 event during the hold does not lower the baseline either: the dy 9 events after it stay blocked', () => {
      const det = createDetent({})
      holdAt500(det)
      // At t 40 the check uses B = 40 (0 > 64, no) and sets B = max(0, 34) = 34.
      // At t 60 and t 80 the checks use B = 34 then 28.9: 9 > 54.4 and 9 > 46.2 are both false.
      expect(det.onWheel({ t: 40, dy: 0, s: 500, diveEnd: D })).toEqual({ block: true, snapTo: null })
      expect(det.onWheel({ t: 60, dy: 9, s: 500, diveEnd: D })).toEqual({ block: true, snapTo: null })
      expect(det.onWheel({ t: 80, dy: 9, s: 500, diveEnd: D })).toEqual({ block: true, snapTo: null })
    })

    it('a genuinely stronger gesture (dy 90) after dy 30 and dy 25 during the hold still releases', () => {
      const det = createDetent({})
      holdAt500(det)
      expect(det.onWheel({ t: 40, dy: 30, s: 500, diveEnd: D })).toEqual({ block: true, snapTo: null })
      expect(det.onWheel({ t: 60, dy: 25, s: 500, diveEnd: D })).toEqual({ block: true, snapTo: null })
      // Checks: 30 > max(8, 64) no, so B = max(30, 34) = 34; 25 > max(8, 54.4) no, so B = max(25, 28.9) = 28.9.
      // dy 90 > max(8, 1.6 · 28.9 = 46.2) is true, so the hold is released and the event is free.
      expect(det.onWheel({ t: 80, dy: 90, s: 500, diveEnd: D })).toEqual({ block: false, snapTo: null })
    })

    it('after a long decaying momentum tail the baseline has fallen, so a moderate dy 30 releases', () => {
      const det = createDetent({})
      holdAt500(det) // B = 40
      // While held, B = max(abs, 0.85 · B) per event. Thirty dy 4 events (every 16 ms) give
      // B = 34, 28.9, 24.6, 20.9, 17.7, 15.1, 12.8, 10.9, 9.3, 7.9, 6.7, 5.7, 4.8, 4.1, then the
      // floor 4 from the 15th event on. Release needs 4 > max(8, 1.6 · B), which never holds,
      // so all thirty are blocked. A baseline that never decays would stay at 40 and block dy 30.
      let t = 40
      for (let i = 0; i < 30; i++, t += 16) {
        expect(det.onWheel({ t, dy: 4, s: 500, diveEnd: D }), `tail event ${i + 1}`).toEqual({
          block: true,
          snapTo: null,
        })
      }
      // The last check uses B = 4 (after the dy 4 events): 30 > max(8, 6.4) = 8 is true, so it releases.
      expect(det.onWheel({ t, dy: 30, s: 500, diveEnd: D })).toEqual({ block: false, snapTo: null })
    })

    it('an event whose s is already at or past diveEnd mid-burst (page moved by touch or scrollbar) is not blocked and does not snap', () => {
      const det = createDetent({})
      // First event: start = 100, and 100 + 50 = 150 is below 500, so it is free.
      expect(det.onWheel({ t: 0, dy: 50, s: 100, diveEnd: 500 })).toEqual({ block: false, snapTo: null })
      // Same burst (40 ms < 120 ms gap), start 100 < 500, but s is already 700 ≥ 500.
      // The page is already past the plateau, so there is nothing to stop: no hold, no snap.
      expect(det.onWheel({ t: 40, dy: 50, s: 700, diveEnd: 500 })).toEqual({ block: false, snapTo: null })
    })
  })

  describe('createDetent (release falls through to the crossing check)', () => {
    // Constants: DETENT_GAP_MS 120, DETENT_RELEASE_UP_PX 3, DETENT_BASELINE_DECAY 0.85, DETENT_LAG_PX 120.
    // diveEnd 1000 throughout. Hold setup: (t 0, dy +50, s 960) → 960 < 1000 and 960 + 50 = 1010 ≥ 1000,
    // so it crosses and holds at 1000 with baseline 50. (t 16, dy +40, s 1000) is inside the gap, not a
    // reversal, and 40 > max(8, 1.6 · 50 = 80) is false, so it is blocked; baseline = max(40, 0.85 · 50 = 42.5) = 42.5.

    it('a release by a gap (t 216, 200 ms after t 16) falls through: dy +150 at s 900 crosses 1000 and holds at 1000', () => {
      const det = createDetent({})
      expect(det.onWheel({ t: 0, dy: 50, s: 960, diveEnd: 1000 })).toEqual({ block: true, snapTo: 1000 })
      expect(det.onWheel({ t: 16, dy: 40, s: 1000, diveEnd: 1000 })).toEqual({ block: true, snapTo: null })
      // The page moves to 900 by touch or scrollbar (no event fed). Gap 216 − 16 = 200 ≥ 120, so this is a new burst.
      // Fresh-burst check from start 900: 900 < 1000, 900 < 1000 + 120, and 900 + 150 = 1050 ≥ 1000: it holds at 1000.
      expect(det.onWheel({ t: 216, dy: 150, s: 900, diveEnd: 1000 })).toEqual({ block: true, snapTo: 1000 })
    })

    it('an upward release (dy −4 ≤ −3) then re-descent in the same burst is caught again: +20 from 996 crosses 1000 and holds', () => {
      const det = createDetent({})
      expect(det.onWheel({ t: 0, dy: 50, s: 960, diveEnd: 1000 })).toEqual({ block: true, snapTo: 1000 })
      expect(det.onWheel({ t: 16, dy: 40, s: 1000, diveEnd: 1000 })).toEqual({ block: true, snapTo: null })
      // −4 ≤ −3 is a clear reversal: released, not blocked. The page moves 1000 − 4 = 996.
      expect(det.onWheel({ t: 32, dy: -4, s: 1000, diveEnd: 1000 })).toEqual({ block: false, snapTo: null })
      // Same burst (48 − 32 = 16 < 120). Re-descent: 996 < 1000, and 996 + 20 = 1016 ≥ 1000, so it crosses and holds at 1000.
      expect(det.onWheel({ t: 48, dy: 20, s: 996, diveEnd: 1000 })).toEqual({ block: true, snapTo: 1000 })
    })

    it('an upward release with no re-descent stays free: dy −40 releases, then dy −30 from 960 is free', () => {
      const det = createDetent({})
      expect(det.onWheel({ t: 0, dy: 50, s: 960, diveEnd: 1000 })).toEqual({ block: true, snapTo: 1000 })
      // −40 ≤ −3 releases the hold. The page moves 1000 − 40 = 960.
      expect(det.onWheel({ t: 32, dy: -40, s: 1000, diveEnd: 1000 })).toEqual({ block: false, snapTo: null })
      // Upward step (dy < 0) can never cross 1000 going down: 960 − 30 = 930. Free, no hold.
      expect(det.onWheel({ t: 48, dy: -30, s: 960, diveEnd: 1000 })).toEqual({ block: false, snapTo: null })
    })

    it('guard: a burst starting at s 1000 after a gap with dy +60 is free (start is not below the plateau)', () => {
      const det = createDetent({})
      expect(det.onWheel({ t: 0, dy: 10, s: 800, diveEnd: 1000 })).toEqual({ block: false, snapTo: null })
      // 200 − 0 = 200 ≥ 120, so a new burst starts at 1000. Start 1000 is not < 1000, so no crossing check fires.
      expect(det.onWheel({ t: 200, dy: 60, s: 1000, diveEnd: 1000 })).toEqual({ block: false, snapTo: null })
    })

    it('guard: a strong second flick 200 ms after the tail is free (a new burst, not a re-hold)', () => {
      const det = createDetent({})
      expect(det.onWheel({ t: 0, dy: 50, s: 960, diveEnd: 1000 })).toEqual({ block: true, snapTo: 1000 })
      expect(det.onWheel({ t: 16, dy: 40, s: 1000, diveEnd: 1000 })).toEqual({ block: true, snapTo: null })
      // Tail: 32 − 16 = 16 < 120 so it stays in the burst. dy 30 > max(8, 1.6 · 42.5 = 68) is false: blocked.
      expect(det.onWheel({ t: 32, dy: 30, s: 1000, diveEnd: 1000 })).toEqual({ block: true, snapTo: null })
      // Flick at 232: 232 − 32 = 200 ≥ 120, a new burst. Start 1000 is not < 1000, so it is free.
      expect(det.onWheel({ t: 232, dy: 150, s: 1000, diveEnd: 1000 })).toEqual({ block: false, snapTo: null })
    })
  })
})
