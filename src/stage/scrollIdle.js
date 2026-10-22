// Tells the controller when the page has come to rest, so it can settle (plan-r2 R6). Rest is
// `scrollend` where the browser has it, otherwise IDLE_MS without a scroll event; whichever
// comes first wins and the other is ignored until the next scroll. A held touch or pointer
// (a finger on the screen, a scrollbar drag, a wheel or key burst) defers it: releasing the last
// hold re-arms it. `y` seeds the last position, so the first scroll already has a direction.
//
// plan-r2 §7 U6, U7: onIdle gets `{ dir, travel }`. `dir` is the user's last direction: the sign of
// the last same-sign run of at least DIR_MIN_PX, so a few px of browser correction or a twitch at
// the end of a gesture never flips it; it persists across rests (0 until the user first scrolls).
// `travel` is how far the page moved since the last rest. Own scrolls (`scroll(y, true)`: glide
// frames and jumps) move the travel origin with them and never the direction.
import { IDLE_MS, DIR_MIN_PX } from '../core/constants.js'

export function createScrollIdle({ timers, onIdle, idleMs = IDLE_MS, y = null }) {
  const holds = new Set()
  let prevY = y
  let origin = y
  let dir = 0
  let runSign = 0
  let runLen = 0
  let pending = false
  let cancel = null

  const stop = () => {
    cancel?.()
    cancel = null
  }

  function fire() {
    stop()
    if (!pending || holds.size) return
    pending = false
    const travel = prevY - origin
    origin = prevY
    runLen = 0
    onIdle({ dir, travel })
  }

  function arm() {
    stop()
    if (!holds.size) cancel = timers.timeout(fire, idleMs)
  }

  return {
    scroll(y, own = false) {
      if (prevY === null) origin = y
      else if (own) origin += y - prevY
      else if (y !== prevY) {
        const d = y - prevY
        if (Math.sign(d) === runSign) runLen += Math.abs(d)
        else {
          runSign = Math.sign(d)
          runLen = Math.abs(d)
        }
        if (runLen >= DIR_MIN_PX) dir = runSign
      }
      prevY = y
      pending = true
      arm()
    },
    scrollEnd() {
      fire()
    },
    hold(kind, on) {
      if (on) {
        holds.add(kind)
        stop()
      } else if (holds.delete(kind) && !holds.size && pending) {
        arm()
      }
    },
    dispose() {
      stop()
      holds.clear()
      pending = false
    },
  }
}
