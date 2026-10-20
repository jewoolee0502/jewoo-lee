// The laptop view's scroll model (plan-r3 section 2.1), pure and DOM-free. Positions `s` are
// track-relative (s = −trackRect.top); the layout comes from the measured pinned range
// R = trackH − stageH (R3), so it follows the real track whatever vh/dvh do on mobile.
//
//   0 (track top)                    diveEnd = R − P                R = document end
//   |------------- dive --------------|=== open plateau (P px) ===|
//   z:  0 ───────────────────────────► 1             1             1
//
// V2: the document ends at R, a short plateau P = min(PLATEAU_PX, floor(R/3)) past the dive, so
// the browser's own scroll clamp stops every flick, fast notch, Space, PageDown and End at the open
// laptop: nothing snaps or intercepts the wheel. The plateau absorbs small viewport changes (the
// mobile toolbar) and small upward nudges without closing the laptop. The stage is pinned for every
// reachable `s`, so there is never a half-open laptop with the page beneath it.
//
// V3: the programmatic "open" target is R, not diveEnd (enter, the forward settle, "open stays
// open"), so the plateau keeps its full absorbing power. A rest part-way through the dive glides
// on in the last user direction; a tiny movement returns (U6). V5: `relayout` is the resize rule.
import { INSIDE_ON, INSIDE_OFF, PLATEAU_PX, SETTLE_TINY_PX, REMAP_THRESHOLD } from '../core/constants.js'
import { clamp, ss } from '../core/math.js'

export function runwayLayout({ trackH, stageH }) {
  const R = Math.max(1, trackH - stageH)
  const P = Math.min(PLATEAU_PX, Math.floor(R / 3))
  const diveEnd = Math.max(1, R - P)
  return { R, diveEnd, stageH }
}

/** The camera pose at `s`: z, the segment, and the fraction `u` through the dive. */
export function poseAt(s, L) {
  if (s <= 0) return { z: 0, seg: 'top', u: 0 }
  if (s < L.diveEnd) {
    const u = clamp(s / L.diveEnd, 0, 1)
    return { z: u, seg: 'dive', u }
  }
  return { z: 1, seg: 'inside', u: 0 }
}

/** R8 hysteresis, so sub-pixel jitter never swaps the OS between flat and 3D. */
export const nextInteractive = (prev, z) => (prev ? z >= INSIDE_OFF : z >= INSIDE_ON)

/**
 * R6, U6: where a page at rest at `s` should glide to (track-relative), or null to stay put. Only a
 * rest in the dive settles: it goes on in the last user direction `dir`, to the desk (0) or the
 * open laptop (R); a movement of less than SETTLE_TINY_PX since the last rest (`travel`) returns to
 * the end behind it. No direction yet (dir 0) goes to the nearer end.
 */
export function settleTarget(s, L, dir, travel = Infinity) {
  const { seg, u } = poseAt(s, L)
  if (seg !== 'dive') return null
  const back = 0
  const fwd = L.R
  const tiny = Math.abs(travel) < SETTLE_TINY_PX
  const target = dir > 0 ? (tiny ? back : fwd) : dir < 0 ? (tiny ? fwd : back) : u >= 0.5 ? fwd : back
  return Math.abs(target - s) < 1 ? null : target
}

/** U9: the scroll cue shows at the top and fades out early in the dive; nowhere else. */
export function cueOpacity({ seg, z }) {
  if (seg === 'top') return 0.8
  if (seg === 'dive') return 0.8 * (1 - ss(0, 0.15, z))
  return 0
}

/**
 * V5: the resize rule. Where `s` (laid out by L0) should move to in L1, or null to stay. An open
 * laptop (`wasOpen`) that the new layout would leave short of its dive end jumps to the new R; the
 * desk and the plateau stay where they are. A mid-dive position keeps its dive fraction when R
 * changed by more than REMAP_THRESHOLD, and also after a small change (the mobile toolbar) that
 * would leave it on the new plateau, which would open the laptop without a settle; any other small
 * change is left alone. A kept fraction always stays inside the new dive, so the settle finishes it.
 */
export function relayout(s, L0, L1, wasOpen) {
  if (wasOpen) return s < L1.diveEnd ? L1.R : null
  if (s <= 0 || s >= L0.diveEnd) return null
  if (s < L1.diveEnd && Math.abs(L1.R - L0.R) / L0.R <= REMAP_THRESHOLD) return null
  return Math.max(0, Math.min(Math.round((s / L0.diveEnd) * L1.diveEnd), L1.diveEnd - 1))
}
