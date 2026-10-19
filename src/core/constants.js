// Shared layout and input constants.
export const OS_W = 900
export const OS_H = 675
export const NARROW_PX = 760
/** A stage shorter than this (phone landscape) also gets the compact OS. */
export const SHORT_PX = 480
export const CAM_NARROW_ASPECT = 1.05
/** The HUD fades out over this z range, before the growing screen reaches it. */
export const HUD_FADE = [0.6, 0.8]

// Scroll runway (plan-r2 R2), in stage heights: dive, inside plateau, out, tail. The track is
// 100vh of stage plus the runway, so TRACK_VH = 100·(1 + sum) and tokens.css --track-h must match.
export const RUNWAY = { dive: 1, inside: 0.12, out: 0.6, tail: 0.18 }
export const TRACK_VH = 290
/** R8: `interactive` turns on at z ≥ INSIDE_ON and off below INSIDE_OFF. */
export const INSIDE_ON = 0.999
export const INSIDE_OFF = 0.985
/** R6: the page counts as at rest after this long without a scroll event (no `scrollend`). */
export const IDLE_MS = 160
/** R6: a wheel event on the stage defers the settle this long, so the pauses between notches of
 *  a slow mouse wheel (each one ends in its own `scrollend`) never count as the page at rest. */
export const SETTLE_GRACE_MS = 300
/** R5: wheel events closer together than this belong to one burst. */
export const DETENT_GAP_MS = 120
/** R5: a held burst is released only by an upward wheel step at least this large (px); smaller is jitter. */
export const DETENT_RELEASE_UP_PX = 3
/** R5: per-event decay of a held burst's strength baseline, so a long momentum tail lowers the bar
 *  a new, stronger gesture must clear. */
export const DETENT_BASELINE_DECAY = 0.85
/** R5: how far smooth scrolling may run past diveEnd before the next wheel event (px); a larger
 *  jump came from touch or the scrollbar. */
export const DETENT_LAG_PX = 120
/** R6: how far into a segment (in the direction of travel) a resting position must be to go on. */
export const SETTLE_BIAS = 0.3
/** Resize: a pinned-range change above this fraction keeps the segment and fraction. */
export const REMAP_THRESHOLD = 0.15
