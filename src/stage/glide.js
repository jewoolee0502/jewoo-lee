// Programmatic page scrolls (enter, exit, idle settle) at our own pace (plan-r2 R7). Each frame
// writes one instant scrollTo along easeIO, so the camera (a pure function of scroll, R1) follows.
// Any user input cancels it: the bindings call cancel() on wheel, touch, pointer and keys, and
// onScroll() cancels when the page moved somewhere the glide did not put it (scrollbar drags,
// Safari without scrollend). It runs its own rAF because enter() may start with the stage
// off-screen, where the stage ticker is stopped. Reduced motion: one instant jump.
import { clamp, easeIO } from '../core/math.js'

/** Seconds for a glide over `dist` px with a page of height `H`. */
export const glideDuration = (dist, H) => clamp(0.35 + (0.55 * dist) / H, 0.35, 1.4)

export function createGlide({
  getY,
  scrollTo,
  raf,
  caf,
  now,
  reduce,
  pageH = () => globalThis.innerHeight || 1000,
}) {
  let id = null
  let active = false
  let lastWritten = 0

  const write = (top) => {
    lastWritten = top
    scrollTo({ top, behavior: 'instant' })
  }

  function cancel() {
    if (id !== null) caf(id)
    id = null
    active = false
  }

  function to(top, { duration } = {}) {
    cancel()
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
    cancel,
    onScroll(y) {
      if (active && Math.abs(y - lastWritten) > 2) cancel()
    },
    get active() {
      return active
    },
  }
}
