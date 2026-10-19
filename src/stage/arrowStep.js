// plan-r2 §7 U4: under the 8 px snap rail a native arrow key moves one rail point (8 px), so while
// the page snaps a plain ArrowUp/ArrowDown steps ARROW_STEP_PX in JS instead. Everything else stays
// native: other keys, a held modifier, snapping off, or a scroller still able to move that way: the
// one around the key's target (a focused control, `scrollerFor`) or the window body the pointer last
// pressed (`.wb` / `.t-out`, where Chrome sends the arrows).
import { ARROW_STEP_PX } from '../core/constants.js'

const DIRS = { ArrowDown: 1, ArrowUp: -1 }

const canScroll = ({ scrollTop, clientHeight, scrollHeight }, d) =>
  d > 0 ? scrollTop + clientHeight < scrollHeight - 1 : scrollTop > 0

/** The nearest element from `target` up (below body) that scrolls (overflow auto/scroll) and can
 *  still move in the arrow's direction, or null. The browser sends the arrow there. */
export function scrollerFor(target, key, view = globalThis) {
  const d = DIRS[key]
  if (!d || !target?.closest) return null
  const doc = target.ownerDocument
  for (let el = target; el && el !== doc.body && el !== doc.documentElement; el = el.parentElement) {
    const oy = view.getComputedStyle(el).overflowY
    if ((oy === 'auto' || oy === 'scroll') && canScroll(el, d)) return el
  }
  return null
}

/** The page step in px for a keydown (0: leave the key to the browser). */
export function arrowStep({ key, mods, snapping, scroller }) {
  const d = DIRS[key]
  if (!snapping || !d || mods?.alt || mods?.ctrl || mods?.meta || mods?.shift) return 0
  if (scroller && canScroll(scroller, d)) return 0
  return d * ARROW_STEP_PX
}
