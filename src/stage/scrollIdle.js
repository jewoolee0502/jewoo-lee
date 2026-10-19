// Tells the controller when the page has come to rest, so it can settle (plan-r2 R6). Rest is
// `scrollend` where the browser has it, otherwise IDLE_MS without a scroll event; whichever
// comes first wins and the other is ignored until the next scroll. A held touch or pointer
// (a finger on the screen, a scrollbar drag, a wheel or key burst) defers it: releasing the last
// hold re-arms it. `y` seeds the last position, so the first scroll already has a direction.
import { IDLE_MS } from '../core/constants.js'

export function createScrollIdle({ timers, onIdle, idleMs = IDLE_MS, y = null }) {
  const holds = new Set()
  let prevY = y
  let dir = 0
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
    onIdle(dir)
  }

  function arm() {
    stop()
    if (!holds.size) cancel = timers.timeout(fire, idleMs)
  }

  return {
    scroll(y) {
      if (prevY !== null && y !== prevY) dir = Math.sign(y - prevY)
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
