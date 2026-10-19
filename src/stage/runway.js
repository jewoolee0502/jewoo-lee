// The scroll model (plan-r2 section 2), pure and DOM-free. Positions `s` are track-relative
// (s = −trackRect.top); the layout comes from the measured pinned range R = trackH − stageH
// (R3), so the segments follow the real track whatever vh/dvh do on mobile.
//
//   0 ── dive ── diveEnd ─ inside ─ insideEnd ── out ── outEnd ─ tail ─ R ─ past (résumé)
//   z:  0 ──────► 1          1           1 ──────────► 0         0        0
//
// z > 0 only before outEnd, and the stage stays pinned until R, so the half-laptop state
// (screen open while the stage scrolls away) cannot happen (R2). The plateau is at least
// PLATEAU_MIN_PX, taken from the out segment, so outEnd (and the invariant) never moves (U8).
//
// Snapping (plan-r2 §7 U1–U2): the page snaps mandatorily to a rail of points every SNAP_GRID_PX
// plus the settle targets, with one always-stop at diveEnd, so a momentum flick rests at the open
// laptop and any other rest moves at most half a rail step. A rest part-way through the dive or
// the out segment glides on in the last user direction; a tiny movement returns (U6).
import {
  RUNWAY,
  INSIDE_ON,
  INSIDE_OFF,
  DETENT_GAP_MS,
  DETENT_RELEASE_UP_PX,
  DETENT_BASELINE_DECAY,
  DETENT_LAG_PX,
  PLATEAU_MIN_PX,
  SNAP_GRID_PX,
  SETTLE_TINY_PX,
} from '../core/constants.js'
import { clamp, ss } from '../core/math.js'

const SUM = RUNWAY.dive + RUNWAY.inside + RUNWAY.out + RUNWAY.tail

export function runwayLayout({ trackH, stageH }) {
  const R = Math.max(1, trackH - stageH)
  const unit = R / SUM
  const diveEnd = Math.round(RUNWAY.dive * unit)
  const outEnd = Math.round((RUNWAY.dive + RUNWAY.inside + RUNWAY.out) * unit)
  const insideEnd = Math.max(
    Math.round((RUNWAY.dive + RUNWAY.inside) * unit),
    diveEnd + Math.min(PLATEAU_MIN_PX, Math.floor((outEnd - diveEnd) / 2)),
  )
  return { R, diveEnd, insideEnd, outEnd, stageH }
}

const frac = (s, a, b) => (b > a ? clamp((s - a) / (b - a), 0, 1) : 0)

/** The camera pose at `s`: z, the segment, and the fraction `u` through dive or out. */
export function poseAt(s, L) {
  if (s <= 0) return { z: 0, seg: 'top', u: 0 }
  if (s < L.diveEnd) {
    const u = frac(s, 0, L.diveEnd)
    return { z: u, seg: 'dive', u }
  }
  if (s <= L.insideEnd) return { z: 1, seg: 'inside', u: 0 }
  if (s < L.outEnd) {
    const u = frac(s, L.insideEnd, L.outEnd)
    return { z: 1 - u, seg: 'out', u }
  }
  if (s <= L.R) return { z: 0, seg: 'tail', u: 0 }
  return { z: 0, seg: 'past', u: 0 }
}

/** R8 hysteresis, so sub-pixel jitter never swaps the OS between flat and 3D. */
export const nextInteractive = (prev, z) => (prev ? z >= INSIDE_OFF : z >= INSIDE_ON)

/**
 * R6, U6: where a page at rest at `s` should glide to (track-relative), or null to stay put. In the
 * dive or the out segment it goes on in the last user direction `dir`; a movement of less than
 * SETTLE_TINY_PX since the last rest (`travel`) returns to the end behind it. No direction yet
 * (dir 0) goes to the nearer end.
 */
export function settleTarget(s, L, dir, travel = Infinity) {
  const { seg, u } = poseAt(s, L)
  let back
  let fwd
  if (seg === 'dive') [back, fwd] = [0, L.diveEnd]
  else if (seg === 'out') [back, fwd] = [L.insideEnd, L.outEnd]
  else return null
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
 * U2: the snap rail for layout `L`. `stop` (diveEnd) is the always-stop; `points` are every `grid`
 * px over the whole track plus the plateau and out ends (exact settle targets), ascending and unique.
 */
export function snapPoints(L, grid = SNAP_GRID_PX) {
  const end = L.R + L.stageH
  const set = new Set([L.insideEnd, L.outEnd])
  for (let p = 0; p <= end; p += grid) set.add(p)
  set.delete(L.diveEnd)
  return { stop: L.diveEnd, points: [...set].filter((p) => p >= 0 && p <= end).sort((a, b) => a - b) }
}

/** Resize: the same segment and fraction in the new layout; past the track keeps its offset. */
export function remapScroll(s, L0, L1) {
  const { seg } = poseAt(s, L0)
  const map = (a0, b0, a1, b1) => a1 + frac(s, a0, b0) * (b1 - a1)
  switch (seg) {
    case 'dive':
      return map(0, L0.diveEnd, 0, L1.diveEnd)
    case 'inside':
      return map(L0.diveEnd, L0.insideEnd, L1.diveEnd, L1.insideEnd)
    case 'out':
      return map(L0.insideEnd, L0.outEnd, L1.insideEnd, L1.outEnd)
    case 'tail':
      return map(L0.outEnd, L0.R, L1.outEnd, L1.R)
    case 'past':
      return s - L0.R + L1.R
    default:
      return s
  }
}

/** WheelEvent delta in pixels (deltaMode 0 pixels, 1 lines, 2 pages). */
export function wheelPixels(deltaY, deltaMode, pageH) {
  if (deltaMode === 1) return deltaY * 16
  if (deltaMode === 2) return deltaY * pageH
  return deltaY
}

/**
 * R5: the one wheel interception. A burst (events < gapMs apart) that started above the plateau
 * and would cross into it is stopped at diveEnd: that event snaps there, and the rest of the burst
 * (its momentum) is blocked. Landing exactly on diveEnd counts as crossing, and so does an event
 * whose `s` is already a little past it (< DETENT_LAG_PX, smooth scrolling ran ahead); a larger jump
 * past diveEnd (the page moved by touch or scrollbar) does not. A gap, a clear reversal
 * (dy <= −DETENT_RELEASE_UP_PX) or a clearly new, stronger gesture (|dy| > max(8, 1.6 · baseline))
 * releases it; tiny upward jitter (−DETENT_RELEASE_UP_PX < dy < 0) is blocked like the rest of the
 * hold. A releasing event starts a fresh burst (from s + dy when it goes up, else from s) and then
 * takes the same crossing check, so one that itself crosses diveEnd from below is held and snapped
 * again. While held, the baseline decays per event
 * (baseline = max(|dy|, DETENT_BASELINE_DECAY · baseline)), so small jitter never lowers it at once
 * but a long momentum tail does; outside a hold it is just the last |dy|.
 */
export function createDetent({ gapMs = DETENT_GAP_MS } = {}) {
  let last = -Infinity
  let baseline = 0
  let start = 0
  let held = false

  return {
    onWheel({ t, dy, s, diveEnd }) {
      const abs = Math.abs(dy)
      const newBurst = t - last >= gapMs
      let res = { block: false, snapTo: null }
      if (held && !(newBurst || dy <= -DETENT_RELEASE_UP_PX || abs > Math.max(8, 1.6 * baseline))) {
        res = { block: true, snapTo: null }
        baseline = Math.max(abs, baseline * DETENT_BASELINE_DECAY)
      } else {
        if (held) {
          // Released: a fresh burst starts here (an upward step's from where it lands), and this
          // event goes through the same crossing check as any other.
          held = false
          start = dy < 0 ? s + dy : s
        } else if (newBurst) start = s
        if (dy > 0 && start < diveEnd && s < diveEnd + DETENT_LAG_PX && s + dy >= diveEnd) {
          held = true
          res = { block: true, snapTo: diveEnd }
        }
        baseline = abs
      }
      last = t
      return res
    },
    /** Whether a stopped burst may still be running at `t` (a later event within gapMs). */
    holding(t) {
      return held && t - last < gapMs
    },
  }
}
