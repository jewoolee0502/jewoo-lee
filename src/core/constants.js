// Shared layout and input constants.
/** The OS logical size: the 20:13 MacBook Air panel (2560 × 1664), plan-r4 M24. */
export const OS_W = 1040
export const OS_H = 676
export const NARROW_PX = 760
/** A stage shorter than this (phone landscape) also gets the compact OS. */
export const SHORT_PX = 480
export const CAM_NARROW_ASPECT = 1.05
/** The HUD fades out over this z range, before the growing screen reaches it. */
export const HUD_FADE = [0.6, 0.8]

// The laptop view's scroll track (plan-r3 V2): the stage plus a one-stage dive (TRACK_VH, in vh),
// then a short open plateau (PLATEAU_PX), where the document ends. tokens.css --track-h must be
// calc(TRACK_VH vh + PLATEAU_PX px).
export const TRACK_VH = 200
export const PLATEAU_PX = 120
/** R8: `interactive` turns on at z ≥ INSIDE_ON and off below INSIDE_OFF. */
export const INSIDE_ON = 0.999
export const INSIDE_OFF = 0.985
/** R6: the page counts as at rest after this long without a scroll event (no `scrollend`). */
export const IDLE_MS = 160
/** R6: a wheel event defers the settle this long, so the pauses between notches of a slow mouse
 *  wheel (each one ends in its own `scrollend`) never count as the page at rest. */
export const SETTLE_GRACE_MS = 300
/** U7: a scroll within this many px of the glide's last write is its own; covers the browser
 *  clamping the final write at the document end. */
export const OWN_TOL_PX = 5
/** U7: …and only within this long after that write (ms). */
export const OWN_MS = 300
/** U6: a rest that moved less than this since the last one is tiny and returns (px). */
export const SETTLE_TINY_PX = 16
/** U7: the user direction changes only after a same-sign run of at least this many px. */
export const DIR_MIN_PX = 8
/** V5: a mid-dive resize keeps its dive fraction only when R changed by more than this fraction. */
export const REMAP_THRESHOLD = 0.15
/** plan-r3 V9: a button switch between the two views fades the veil in this long, swaps, and
 *  fades it out as long again (views.css transitions over the same .15 s). */
export const VIEW_FADE_MS = 150
