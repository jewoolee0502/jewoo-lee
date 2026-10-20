// Programmatic page scrolls (enter, exit, idle settle) at our own pace (plan-r2 R7). Each frame
// writes one instant scrollTo along easeIO, so the camera (a pure function of scroll, R1) follows.
// Any user input cancels it: the bindings call cancel() on wheel, touch, pointer and keys, and
// onScroll() cancels when the page moved somewhere the glide did not put it (scrollbar drags,
// Safari without scrollend). It runs its own rAF because enter() may start with the stage
// off-screen, where the stage ticker is stopped. Reduced motion: one instant jump.
//
// U7: `jump(top)` is the instant programmatic write (the resize rule), and `owns(y)` tells a scroll
// the glide wrote (or the browser clamping it at the document end) from a user scroll, so
// programmatic moves never steer the settle.
import { clamp, easeIO } from '../core/math.js'
import { OWN_TOL_PX, OWN_MS } from '../core/constants.js'

/** Seconds for a glide over `dist` px with a page of height `H`. */
export const glideDuration = (dist, H) => clamp(0.35 + (0.55 * dist) / H, 0.35, 1.4)

export function createGlide({ getY, scrollTo, raf, caf, now, reduce, pageH = () => globalThis.innerHeight || 1000 }) {
  let id = null
  let active = false
  let lastWritten = 0
  let lastWriteT = -Infinity

  const write = (top) => {
    lastWritten = top
    lastWriteT = now()
    scrollTo({ top, behavior: 'instant' })
  }

  function stop() {
    if (id !== null) caf(id)
    id = null
    active = false
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
      write(top)
      return
    }
    const ms = 1000 * (duration ?? glideDuration(Math.abs(top - from), pageH()))
    const t0 = now()
    active = true
    lastWritten = from
    const step = () => {
      id = null
      const k = ms > 0 ? clamp((now() - t0) / ms, 0, 1) : 1
      if (k >= 1) {
        active = false
        write(top)
        return
      }
      write(Math.round(from + (top - from) * easeIO(k)))
      id = raf(step)
    }
    id = raf(step)
  }

  return {
    to,
    /** Instant programmatic scroll (the resize rule): stops a glide, writes once. */
    jump(top) {
      stop()
      write(top)
    },
    cancel,
    /** Whether a scroll to `y` is the glide's own write (or the browser's clamp of it). */
    owns(y) {
      return Math.abs(y - lastWritten) <= OWN_TOL_PX && now() - lastWriteT <= OWN_MS
    },
    onScroll(y) {
      if (active && Math.abs(y - lastWritten) > 2) cancel()
    },
    get active() {
      return active
    },
  }
}
