// plan-r2 §7 U10: moving a node resets its descendants' scroll offsets, so the OS re-parent
// (osHost.setFlat) saves the window bodies' and the terminal's offsets and puts them back.
export const KEEP_SCROLL = '.wb, .t-out'

/** Writes back the saved offsets that differ; returns the entries whose offsets still differ. */
function restore(saved) {
  const missed = []
  for (const entry of saved) {
    const [el, top, left] = entry
    if (el.scrollTop !== top) el.scrollTop = top
    if (el.scrollLeft !== left) el.scrollLeft = left
    if (el.scrollTop !== top || el.scrollLeft !== left) missed.push(entry)
  }
  return missed
}

/** Runs fn (a DOM move) with the scroll offsets of root's matching descendants kept; returns fn's result.
 *  Only elements with a non-zero offset are recorded, and only values that changed are written back.
 *  A write the browser did not take (the moved node had no layout yet) is tried once more on the next
 *  animation frame, for elements still in the document then. */
export function keepScroll(root, fn, selector = KEEP_SCROLL, { raf = globalThis.requestAnimationFrame } = {}) {
  if (root == null) return fn()
  const saved = []
  for (const el of root.querySelectorAll(selector)) {
    const top = el.scrollTop
    const left = el.scrollLeft
    if (top || left) saved.push([el, top, left])
  }
  const r = fn()
  const missed = restore(saved).filter(([el]) => el.isConnected)
  if (missed.length && typeof raf === 'function') raf(() => restore(missed.filter(([el]) => el.isConnected)))
  return r
}
