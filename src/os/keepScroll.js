// plan-r2 §7 U10: moving a node resets its descendants' scroll offsets, so the OS re-parent
// (osHost.setFlat) saves the window bodies' and the terminal's offsets and puts them back.
// plan-r3 V6: hiding them (display:none, the résumé view) drops them too, so createApp saves them
// at park, while still shown, and restores them at unpark, once shown again.
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

/** The non-zero scroll offsets of root's matching descendants, for restoreScroll. */
export function saveScroll(root, selector = KEEP_SCROLL) {
  const saved = []
  if (root == null) return saved
  for (const el of root.querySelectorAll(selector)) {
    const top = el.scrollTop
    const left = el.scrollLeft
    if (top || left) saved.push([el, top, left])
  }
  return saved
}

/** Writes saved offsets back (only those that changed). A write the browser did not take (the node
 *  had no layout yet) is tried once more on the next animation frame, for elements still in the
 *  document then. */
export function restoreScroll(saved, { raf = globalThis.requestAnimationFrame } = {}) {
  if (!saved?.length) return
  const missed = restore(saved).filter(([el]) => el.isConnected)
  if (missed.length && typeof raf === 'function') raf(() => restore(missed.filter(([el]) => el.isConnected)))
}

/** Runs fn (a DOM move) with the scroll offsets of root's matching descendants kept; returns fn's result.
 *  Only elements with a non-zero offset are recorded, and only values that changed are written back. */
export function keepScroll(root, fn, selector = KEEP_SCROLL, { raf = globalThis.requestAnimationFrame } = {}) {
  if (root == null) return fn()
  const saved = saveScroll(root, selector)
  const r = fn()
  restoreScroll(saved, { raf })
  return r
}
