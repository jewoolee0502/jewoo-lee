// The living wallpaper (L483–602 runtime). It has no loop of its own: the shared stage ticker
// calls tick(now) every frame (D6), and tick decides whether to draw (L596–598):
//   - never while the tab is hidden or the OS is not 'on';
//   - during a camera tween, or with reduced motion, only when something changed (dirty);
//   - otherwise at most every 70 ms (about 14 fps).
// A width change (OS resize) is applied only after it has been stable for 200 ms and never during
// a camera tween (B4). The layout is a pure function of W with stable seeds, so a rebuild reflows
// the city instead of re-rolling it.
import { CITY_H, clampWidth, isMode } from './modes.js'
import { buildLayout, fitRaccoon, createWallState } from './layout.js'
import { drawStatic, drawFrame, hitTest } from './render.js'
import { act } from './secrets.js'

export const IDLE_FRAME_MS = 70
export const REBUILD_DEBOUNCE_MS = 200

export function createWallpaperEngine({
  canvas,
  getOsSize,
  getOsState,
  isTweening = () => false,
  reduce = () => false,
  snd,
  tracker,
  rand = () => Math.random(),
}) {
  const H = CITY_H
  const ctx = canvas.getContext('2d')
  const state = createWallState()
  let W = 0
  let mode = 'night'
  let L = null
  let stat = null
  let needStatic = true
  let dirty = true
  let T = 0
  let lastDraw = 0
  let hot = []
  let pending = null // {w, since}: a new width waiting out the debounce
  let disposed = false

  const hidden = () => typeof document !== 'undefined' && document.hidden
  const targetWidth = () => {
    const s = getOsSize?.() ?? {}
    return clampWidth(s.w, s.h)
  }

  /** Builds the layout at the current W (or the static layer only, for a mode change). */
  function rebuild(layoutToo) {
    if (layoutToo || !L) {
      canvas.width = W
      canvas.height = H
      L = buildLayout(W)
      fitRaccoon(state, L)
    }
    if (!stat) stat = document.createElement('canvas')
    stat.width = W
    stat.height = H
    drawStatic(stat.getContext('2d'), L, mode, W)
    needStatic = false
  }

  /** Watches the OS size; marks a rebuild due once a new width has been stable for 200 ms. */
  function watchSize(now, tweening) {
    const w = targetWidth()
    if (!L) {
      W = w
      pending = null
      return 'layout'
    }
    if (w === W) {
      pending = null
      return null
    }
    if (!pending || pending.w !== w) {
      pending = { w, since: now }
      return null
    }
    if (now - pending.since >= REBUILD_DEBOUNCE_MS && !tweening) {
      W = w
      pending = null
      return 'layout'
    }
    return null
  }

  function paint(dt) {
    ctx.drawImage(stat, 0, 0)
    hot = drawFrame(ctx, state, L, mode, W, dt, T, rand)
    dirty = false
  }

  const at = (e) => {
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height) return null
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }

  const engine = {
    canvas,

    tick(now) {
      if (disposed || hidden() || getOsState() !== 'on') return
      const tweening = Boolean(isTweening())
      const due = watchSize(now, tweening)
      if (due) {
        rebuild(true)
        dirty = true
      }
      if (tweening && !dirty) return
      const red = Boolean(reduce())
      if (red && !dirty) return
      if (now - lastDraw < IDLE_FRAME_MS && !dirty) return
      const dt = lastDraw ? Math.min(0.2, (now - lastDraw) / 1000) : 0
      lastDraw = now
      if (needStatic) rebuild(false)
      T += red ? 0 : dt
      paint(red ? 0 : dt)
    },

    /** L602: unknown keys fall back to night. Redraws now when the OS is showing the desktop. */
    setMode(k) {
      if (disposed) return
      if (!isMode(k)) k = 'night'
      if (k === mode && stat && !needStatic) return
      mode = k
      needStatic = true
      dirty = true
      if (hidden() || getOsState() !== 'on') return
      if (!L) {
        W = targetWidth()
        pending = null
        rebuild(true)
      } else rebuild(false)
      paint(0)
    },

    /** L589–591: a click on a hot spot plays its secret. */
    click(e) {
      if (disposed) return
      const p = at(e)
      const h = p && hitTest(hot, p)
      if (!h) return
      act(state, h, { snd, W })
      tracker?.found?.(h.k)
      dirty = true
    },

    /** L592: pointer cursor over hot spots. */
    move(e) {
      if (disposed) return
      const p = at(e)
      canvas.style.cursor = p && hitTest(hot, p) ? 'pointer' : 'default'
    },

    get mode() {
      return mode
    },
    get W() {
      return W
    },
    get T() {
      return T
    },

    dispose() {
      disposed = true
      stat = null
      L = null
      hot = []
    },
  }
  return engine
}
