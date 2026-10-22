// Round 3 Phase R3-1 TEST LIST: stage/runway.test.js. Pure scroll-model math (plan-r3 section 2.1).
// The laptop document is the dive plus a 120 px open plateau, and ends there (V2): R = trackH − stageH,
// diveEnd = R − min(PLATEAU_PX, floor(R/3)). No out, tail or past segments; no snapping, no detent.
// Reference harness: H = 1000 (stage height), trackH = 2120 → R = 1120, diveEnd 1000.
// Positions s are track-relative (s = −trackRect.top).
import { describe, it, expect } from 'vitest'
import { runwayLayout, poseAt, nextInteractive, settleTarget, relayout, cueOpacity } from './runway.js'

const H = 1000
const L = runwayLayout({ trackH: 2120, stageH: H })

describe('stage/runway', () => {
  describe('runwayLayout', () => {
    it('measures R = trackH − stageH and ends the dive at R − 120 (H 1000: R 1120, diveEnd 1000)', () => {
      expect(L).toMatchObject({ R: 1120, diveEnd: 1000, stageH: 1000 })
    })

    it('H 720 with trackH 1560: R 840, diveEnd 720', () => {
      expect(runwayLayout({ trackH: 1560, stageH: 720 })).toMatchObject({ R: 840, diveEnd: 720 })
    })

    it('H 844 with trackH 1808: R 964, diveEnd 844', () => {
      expect(runwayLayout({ trackH: 1808, stageH: 844 })).toMatchObject({ R: 964, diveEnd: 844 })
    })

    it('a small track caps the plateau at a third of R (trackH 300, stageH 200: R 100, diveEnd 67)', () => {
      expect(runwayLayout({ trackH: 300, stageH: 200 })).toMatchObject({ R: 100, diveEnd: 67 })
    })

    it('floors R at 1 when the track is no taller than the stage (trackH 900, stageH 1000: R 1, diveEnd 1)', () => {
      expect(runwayLayout({ trackH: 900, stageH: 1000 })).toMatchObject({ R: 1, diveEnd: 1 })
    })

    it('for phone and laptop heights the track is 2H + 120: the dive is exactly H and the plateau exactly 120 px', () => {
      for (const H of [390, 600, 720, 844, 900, 1000, 1366]) {
        const lay = runwayLayout({ trackH: 2 * H + 120, stageH: H })
        expect(lay.R - lay.diveEnd, `H ${H}`).toBe(120)
        expect(lay.diveEnd, `H ${H}`).toBe(H)
      }
    })
  })

  describe('poseAt', () => {
    it('is closed at the track top', () => {
      expect(poseAt(0, L)).toMatchObject({ z: 0, seg: 'top' })
      expect(poseAt(-50, L).z).toBe(0)
    })

    it('rises linearly through the dive: z 0.5 and u 0.5 at 500', () => {
      expect(poseAt(500, L)).toMatchObject({ z: 0.5, seg: 'dive', u: 0.5 })
    })

    it('is inside (z 1) from diveEnd on, through the plateau to R', () => {
      expect(poseAt(999, L).seg).toBe('dive')
      expect(poseAt(1000, L)).toMatchObject({ z: 1, seg: 'inside' })
      expect(poseAt(1060, L)).toMatchObject({ z: 1, seg: 'inside' })
      expect(poseAt(1120, L)).toMatchObject({ z: 1, seg: 'inside' })
    })

    it('has no past segment: 1500 is still inside, z 1', () => {
      expect(poseAt(1500, L)).toMatchObject({ z: 1, seg: 'inside' })
    })

    it('invariant: every s from 0 to R in steps of 10 is top, dive or inside, and z is 1 from diveEnd on', () => {
      for (let s = 0; s <= L.R; s += 10) {
        const { seg, z } = poseAt(s, L)
        expect(['top', 'dive', 'inside'], `s ${s}`).toContain(seg)
        if (s >= L.diveEnd) expect(z, `s ${s}`).toBe(1)
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
    // SETTLE_TINY_PX is 16: a movement of 15 px is tiny, 16 px is not. The dive settles to 0 or R.
    it('dive: a downward rest glides on to the open laptop (R), however shallow (100 and 300 px travel)', () => {
      expect(settleTarget(100, L, 1, 100)).toBe(1120)
      expect(settleTarget(300, L, 1, 300)).toBe(1120)
    })

    it('dive: an upward rest glides back to the desk, however deep (900 and 300 px travel)', () => {
      expect(settleTarget(900, L, -1, 100)).toBe(0)
      expect(settleTarget(300, L, -1, 100)).toBe(0)
    })

    it('a tiny movement (under 16 px) returns to the end behind it; 16 px counts as deliberate', () => {
      expect(settleTarget(10, L, 1, 10)).toBe(0)
      expect(settleTarget(990, L, -1, 10)).toBe(1120)
      expect(settleTarget(300, L, 1, 15)).toBe(0)
      expect(settleTarget(300, L, 1, 16)).toBe(1120)
    })

    it('no user direction (dir 0) splits at the middle of the dive: 500 opens, 499 closes', () => {
      expect(settleTarget(500, L, 0, 0)).toBe(1120)
      expect(settleTarget(499, L, 0, 0)).toBe(0)
    })

    it('a travel argument left out counts as a deliberate movement', () => {
      expect(settleTarget(300, L, 1)).toBe(1120)
    })

    it('a rest just short of the dive end (999.5, downward) still glides to R', () => {
      expect(settleTarget(999.5, L, 1, 100)).toBe(1120)
    })

    it('rest points (top, plateau, beyond R) and resting exactly on a target give null', () => {
      for (const s of [0, 1000, 1060, 1120]) {
        for (const dir of [1, -1]) {
          expect(settleTarget(s, L, dir, 100), `s ${s} dir ${dir}`).toBeNull()
        }
      }
    })
  })

  // V5 (plan-r3): a layout change keeps the open laptop open, keeps the desk, and keeps a mid-dive fraction
  // only when the layout moved by more than REMAP_THRESHOLD (15 %). L0 = 2120/1000, L1 = 1320/600,
  // L2 = 2220/1050, L3 = 2720/1300.
  describe('relayout (V5: resize rule)', () => {
    const L0 = runwayLayout({ trackH: 2120, stageH: 1000 })
    const L1 = runwayLayout({ trackH: 1320, stageH: 600 })
    const L2 = runwayLayout({ trackH: 2220, stageH: 1050 })
    const L3 = runwayLayout({ trackH: 2720, stageH: 1300 })

    it('open, mid-plateau of the new layout (1060 ≥ 1050, not at the end): nothing moves', () => {
      expect(relayout(1060, L0, L2, true)).toBeNull()
    })

    it('open, dive end of the new layout not yet reached (1000 < 1050): jumps to the new R (1170)', () => {
      expect(relayout(1000, L0, L2, true)).toBe(1170)
    })

    it('open, growth larger than the plateau (1120 < 1300): jumps to the new R (1420)', () => {
      expect(relayout(1120, L0, L3, true)).toBe(1420)
    })

    // Gap C: an open laptop resting at the document end (s ≥ L0.R − 1) stays at the end after a layout
    // that grows R by less than the plateau; it must follow the new end, or one notch up closes it.
    it('open at the old end, desktop 900 → 960 (s 1020 = old R): jumps to the new R (1080)', () => {
      const d0 = runwayLayout({ trackH: 2 * 900 + 120, stageH: 900 })
      const d1 = runwayLayout({ trackH: 2 * 960 + 120, stageH: 960 })
      expect(d0).toMatchObject({ R: 1020, diveEnd: 900 })
      expect(d1).toMatchObject({ R: 1080, diveEnd: 960 })
      expect(relayout(1020, d0, d1, true)).toBe(1080)
    })

    it('open at the old end, phone toolbar 844 → 924 (s 964 = old R): jumps to the new R (1044)', () => {
      const shown = runwayLayout({ trackH: 2 * 844 + 120, stageH: 844 })
      const hidden = runwayLayout({ trackH: 2 * 924 + 120, stageH: 924 })
      expect(shown).toMatchObject({ R: 964, diveEnd: 844 })
      expect(hidden).toMatchObject({ R: 1044, diveEnd: 924 })
      expect(relayout(964, shown, hidden, true)).toBe(1044)
    })

    it('open at the old end, phone toolbar 924 → 844 (s 1044 = old R): jumps to the new R (964)', () => {
      const hidden = runwayLayout({ trackH: 2 * 924 + 120, stageH: 924 })
      const shown = runwayLayout({ trackH: 2 * 844 + 120, stageH: 844 })
      expect(relayout(1044, hidden, shown, true)).toBe(964)
    })

    it('open at the old end but the page moved this frame (still = false): nothing moves', () => {
      const d0 = runwayLayout({ trackH: 2 * 900 + 120, stageH: 900 })
      const d1 = runwayLayout({ trackH: 2 * 960 + 120, stageH: 960 })
      expect(relayout(1020, d0, d1, true, false)).toBeNull()
    })

    it('open short of the new dive end while the page moved (still = false): nothing moves, the settle finishes it', () => {
      expect(relayout(1000, L0, L2, true, false)).toBeNull()
    })

    // Gap (wasOpen, moving page): a visitor who scrolls up in the frame of a layout change is not
    // pulled back open; the idle settle takes the page from wherever it rests.
    describe('open and moving (still = false) in a shrink 960 → 900', () => {
      const d0 = runwayLayout({ trackH: 2 * 960 + 120, stageH: 960 })
      const d1 = runwayLayout({ trackH: 2 * 900 + 120, stageH: 900 })

      it('the layouts are R 1080 / diveEnd 960 and R 1020 / diveEnd 900', () => {
        expect(d0).toMatchObject({ R: 1080, diveEnd: 960 })
        expect(d1).toMatchObject({ R: 1020, diveEnd: 900 })
      })

      it('s 0 (the visitor scrolled to the desk in the same frame): nothing moves, not the new R (1020)', () => {
        expect(relayout(0, d0, d1, true, false)).toBeNull()
      })

      it('s 500 (the visitor scrolled up mid-dive in the same frame): nothing moves', () => {
        expect(relayout(500, d0, d1, true, false)).toBeNull()
      })
    })

    it('open at rest short of the new dive end (still = true, new diveEnd 1050 past s 1000): jumps to the new R (1170), as before', () => {
      expect(relayout(1000, L0, L2, true, true)).toBe(1170)
    })

    it('open mid-plateau, not at the end (s 1060 = L0.R − 60, still ≥ the new dive end 1050): nothing moves', () => {
      const L1050 = runwayLayout({ trackH: 2220, stageH: 1050 })
      expect(relayout(L0.R - 60, L0, L1050, true)).toBeNull()
    })

    it('open, and already past the new dive end (720 ≥ 600): nothing moves', () => {
      expect(relayout(720, L0, L1, true)).toBeNull()
    })

    it('the desk stays the desk (0): nothing moves', () => {
      expect(relayout(0, L0, L1, false)).toBeNull()
    })

    it('mid-dive with a layout change over 15 % (|720 − 1120| / 1120): keeps the dive fraction (500 → 300)', () => {
      expect(relayout(500, L0, L1, false)).toBe(300)
    })

    it('mid-dive with a layout change under 15 % (|1170 − 1120| / 1120): nothing moves', () => {
      expect(relayout(500, L0, L2, false)).toBeNull()
    })

    it('on the plateau and not open (1060, not interactive): nothing moves', () => {
      expect(relayout(1060, L0, L1, false)).toBeNull()
    })

    // A small change that would put a mid-dive position at or past the new dive end would turn the
    // laptop open (z → 1) without a settle; the dive fraction is kept instead, whatever the threshold.
    it('mid-dive, a small change that moves the dive end to or under s keeps the fraction (mobile toolbar: 900 → 813)', () => {
      const shown = runwayLayout({ trackH: 2 * 844 + 120, stageH: 754 })
      const hidden = runwayLayout({ trackH: 2 * 844 + 120, stageH: 844 })
      expect(shown).toMatchObject({ R: 1054, diveEnd: 934 })
      expect(hidden).toMatchObject({ R: 964, diveEnd: 844 })
      expect(relayout(900, shown, hidden, false)).toBe(813)
      expect(poseAt(813, hidden).z).toBeCloseTo(poseAt(900, shown).z, 2)
    })

    it('mid-dive, desktop 1000 → 960 at 980 (past the new dive end 960): keeps the fraction (941)', () => {
      const L960 = runwayLayout({ trackH: 2 * 960 + 120, stageH: 960 })
      expect(relayout(980, L0, L960, false)).toBe(941)
    })

    it('a kept fraction always stays inside the new dive (never rounds onto its end)', () => {
      const t = relayout(999, L0, L1, false)
      expect(t).toBeLessThan(L1.diveEnd)
      expect(poseAt(t, L1).seg).toBe('dive')
    })
  })

  // R3-1 (plan-r3 V2): the scroll cue shows only at the top and fades out through the dive.
  describe('cueOpacity', () => {
    it('is 0.8 at the top', () => {
      expect(cueOpacity({ seg: 'top', z: 0 })).toBe(0.8)
    })

    it('fades through the dive: 0.4 at z 0.075 (half of smoothstep over 0 to 0.15)', () => {
      expect(cueOpacity({ seg: 'dive', z: 0.075 })).toBeCloseTo(0.4, 3)
    })

    it('is 0 in the dive at z 0.5', () => {
      expect(cueOpacity({ seg: 'dive', z: 0.5 })).toBe(0)
    })

    it('is 0 on the open plateau', () => {
      expect(cueOpacity({ seg: 'inside', z: 1 })).toBe(0)
    })
  })
})
