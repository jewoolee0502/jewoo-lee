// Programmatic page scrolls (enter, exit, idle settle) at our own pace (plan-r2 R7). Each frame
// writes one instant scrollTo along easeIO, so the camera (a pure function of scroll, R1) follows.
// Any user input cancels it: the bindings call cancel() on wheel, touch, pointer and keys, and
// onScroll() cancels when the page moved somewhere the glide did not put it (scrollbar drags,
// Safari without scrollend). It runs its own rAF because enter() may start with the stage
// off-screen, where the stage ticker is stopped. Reduced motion: one instant jump.
//
// plan-r2 §7 U3, U7: every write runs inside `hold(true)` … `hold(false)` (the page's CSS snap is
// suspended, or the browser would snap each frame), `jump(top)` is the instant programmatic write
// (resize remap, detent), and `owns(y)` tells a scroll the glide wrote (or the browser's ≤ 4 px
// re-snap right after it) from a user scroll, so programmatic moves never steer the settle.
import { clamp, easeIO } from '../core/math.js'
import { SNAP_OWN_TOL_PX, OWN_MS } from '../core/constants.js'

/** Seconds for a glide over `dist` px with a page of height `H`. */
export const glideDuration = (dist, H) => clamp(0.35 + (0.55 * dist) / H, 0.35, 1.4)

export function createGlide({
  getY,
  scrollTo,
  raf,
  caf,
  now,
  reduce,
  hold = () => {},
  pageH = () => globalThis.innerHeight || 1000,
}) {
  let id = null
  let active = false
  let lastWritten = 0
  let lastWriteT = -Infinity

  const write = (top) => {
    lastWritten = top
    lastWriteT = now()
    scrollTo({ top, behavior: 'instant' })
  }

  /** One instant write with the snap held around it. */
  const writeOnce = (top) => {
    hold(true)
    write(top)
    hold(false)
  }

  function stop() {
    if (id !== null) caf(id)
    id = null
    if (active) {
      active = false
      hold(false)
    }
  }

  /** User input: stops a glide, and nothing the glide wrote counts as its own any more. */
  function cancel() {
    stop()
    lastWriteT = -Infinity
  }

  function to(top, { duration } = {}) {
    stop()
    const from = getY()
    if (reduce?.() || Math.abs(top - from) < 1) {
      writeOnce(top)
      return
    }
    const ms = 1000 * (duration ?? glideDuration(Math.abs(top - from), pageH()))
    const t0 = now()
    active = true
    lastWritten = from
    hold(true)
    const step = () => {
      id = null
      const k = ms > 0 ? clamp((now() - t0) / ms, 0, 1) : 1
      if (k >= 1) {
        active = false
        write(top)
        hold(false)
        return
      }
      write(Math.round(from + (top - from) * easeIO(k)))
      id = raf(step)
    }
    id = raf(step)
  }

  return {
    to,
    /** Instant programmatic scroll (resize remap, detent snap): stops a glide, writes once. */
    jump(top) {
      stop()
      writeOnce(top)
    },
    cancel,
    /** Whether a scroll to `y` is the glide's own write (or the snap's correction right after it). */
    owns(y) {
      return Math.abs(y - lastWritten) <= SNAP_OWN_TOL_PX && now() - lastWriteT <= OWN_MS
    },
    onScroll(y) {
      if (active && Math.abs(y - lastWritten) > 2) cancel()
    },
    get active() {
      return active
    },
  }
}
