// Pure window geometry for the JAY-OS window manager (L694, L700–701, L743–744).
import { clamp } from '../core/math.js'

/** Size and position of a newly opened window (L700–701). */
export function openRect(def, { w: W, h: H }, cascade) {
  const w = Math.min(def.w ?? 520, W - 20)
  const h = Math.min(def.h ?? 400, H - 50)
  const x = def.x != null ? clamp(def.x, 8, W - w - 8) : clamp(130 + cascade * 30, 8, W - w - 8)
  const y = def.y != null ? def.y : clamp(46 + cascade * 26, 40, H - h - 8)
  return { x, y, w, h }
}

/** Window position while dragging the title bar (L694). `s` is the on-screen scale of the OS. */
export function dragPosition({ l, t, x, y, s }, clientX, clientY, winW, { w: W, h: H }) {
  return {
    left: clamp(l + (clientX - x) / s, -winW + 90, W - 90),
    top: clamp(t + (clientY - y) / s, 34, H - 34),
  }
}

/** Pulls every window back inside a smaller desk (L743–744). Returns the same array if nothing changed. */
export function fitWindows(wins, { w: W, h: H }) {
  let changed = false
  const next = wins.map((win) => {
    const w = Math.min(win.w, W - 20)
    const h = Math.min(win.h, H - 50)
    const x = clamp(win.x, 8, W - w - 8)
    const y = clamp(win.y, 40, H - h - 8)
    if (w === win.w && h === win.h && x === win.x && y === win.y) return win
    changed = true
    return { ...win, x, y, w, h }
  })
  return changed ? next : wins
}
