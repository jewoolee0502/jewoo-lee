// Scroll / camera controller (plan-r2 section 2, R1–R8).
//
// The camera pose is a pure function of the page scroll (R1): every frame measures the track,
// builds the runway layout from the measured pinned range (R3) and reads z off it, so wheel,
// trackpad momentum, touch, keys, the scrollbar and hash jumps all drive the dive the same way.
// Nothing here animates z. Programmatic moves (enter, exit, the idle settle) are page scrolls
// through `glide` (R7); the only wheel interception is the plateau detent (R5).
//
// The store holds only the discrete fields React and the bindings read; z, seg and layout are
// plain properties written every frame. `detent` says whether the plateau detent can act (the page
// is in the dive, or a stopped burst is still being held), so the bindings attach the non-passive
// #stage wheel listener only then.
import { createStore } from '../core/store.js'
import { ss } from '../core/math.js'
import { REMAP_THRESHOLD, HUD_FADE } from '../core/constants.js'
import {
  runwayLayout,
  poseAt,
  nextInteractive,
  settleTarget,
  remapScroll,
  wheelPixels,
  createDetent,
} from './runway.js'

export function createController({
  getTrackRect,
  getStageHeight,
  scrollY,
  scrollTo,
  glide,
  reduce,
  sceneStatus,
  os,
  ui,
  scrollToResume,
  now = () => globalThis.performance?.now() ?? Date.now(),
}) {
  // `detent` starts true: the page starts at the top, in the dive; the first frame measures it.
  const store = createStore({ phase: 'desk', interactive: false, narrow: false, detent: true })
  const isReduced = () => Boolean(reduce?.())
  const detent = createDetent()
  let runwayFlat = false
  let fallbackBooted = false
  let fallbackLive = false

  function setDetent(v) {
    if (v !== store.get().detent) store.set({ detent: v })
  }

  /** Measures the track: its layout, the track-relative scroll `s` and the track's document top. */
  function measure() {
    const r = getTrackRect()
    const L = runwayLayout({ trackH: r.height, stageH: getStageHeight() })
    return { L, s: -r.top, trackTopDoc: scrollY() + r.top }
  }

  function setInteractive(v) {
    if (v === store.get().interactive) return
    store.set({ interactive: v })
    ui.setZoomed(v)
    os.setLive(v)
    ctrl.applyFlat()
  }

  const ctrl = {
    store,
    z: 0,
    seg: 'top',
    layout: null,

    update() {
      const m = measure()
      let { s } = m
      const prev = ctrl.layout
      const status = sceneStatus()
      // A big resize (rotation, window snap) keeps the reader in the same segment and fraction.
      // Small ones (the mobile toolbar) are left alone: the invariant holds at any R. The
      // fallback has no runway to keep, and an unmeasured track (R 1) is not a layout.
      if (
        status !== 'unavailable' &&
        prev &&
        prev.R > 1 &&
        m.L.R > 1 &&
        Math.abs(m.L.R - prev.R) / prev.R > REMAP_THRESHOLD
      ) {
        s = remapScroll(s, prev, m.L)
        glide.cancel()
        scrollTo({ top: m.trackTopDoc + s, behavior: 'instant' })
      }
      ctrl.layout = m.L

      if (status === 'unavailable') {
        // R10: no scene, no runway. The flat compact OS is live from the first frame.
        if (!fallbackBooted) {
          fallbackBooted = true
          if (os.state === 'standby') os.boot()
        }
        if (!fallbackLive) ctrl.applyFlat()
        setDetent(false)
        ui.setCue(0)
        ui.setHud?.(1)
        return
      }
      setDetent(s < m.L.diveEnd || detent.holding(now()))
      if (status === 'loading') {
        ctrl.z = 0
        ctrl.seg = 'top'
        if (store.get().phase !== 'desk') store.set({ phase: 'desk' })
        ui.setCue(0.8)
        ui.setHud?.(1)
        return
      }

      const pose = poseAt(s, m.L)
      ctrl.z = pose.z
      ctrl.seg = pose.seg
      setInteractive(nextInteractive(store.get().interactive, pose.z))
      const interactive = store.get().interactive
      const phase = interactive ? 'inside' : pose.z > 0 ? 'dive' : 'desk'
      if (phase !== store.get().phase) store.set({ phase })
      ui.setCue(0.8 * (1 - ss(0, 0.15, pose.z)))
      ui.setHud?.(1 - ss(HUD_FADE[0], HUD_FADE[1], pose.z))
    },

    /** Inside is always flat (R4): compact on narrow screens, scaled to fill otherwise. The
     *  fallback (no scene) is flat, compact and live (L1280), and its runway collapses at once,
     *  without waiting for a frame. */
    applyFlat() {
      const { interactive, narrow } = store.get()
      const unavailable = sceneStatus() === 'unavailable'
      if (unavailable && !runwayFlat) {
        runwayFlat = true
        ui.setRunway?.(true)
      }
      os.setFlat(interactive || unavailable, unavailable ? true : narrow)
      if (unavailable) os.setLive(true)
      else if (fallbackLive) os.setLive(interactive)
      fallbackLive = unavailable
    },

    setNarrow(n) {
      n = Boolean(n)
      if (n === store.get().narrow) return
      store.set({ narrow: n })
      ctrl.applyFlat()
    },

    /** Glide to the plateau start from wherever the page is (the laptop, a hotspot, ★, #top). */
    enter() {
      const status = sceneStatus()
      if (status === 'unavailable') {
        scrollTo({ top: measure().trackTopDoc, behavior: isReduced() ? 'auto' : 'smooth' })
        return
      }
      if (status !== 'ready' || store.get().interactive) return
      const m = measure()
      glide.to(m.trackTopDoc + m.L.diveEnd)
    },

    /** Esc, ⏏ Close laptop, Shut Down…: glide back to the closed laptop. */
    exit() {
      if (sceneStatus() !== 'ready' || store.get().phase === 'desk') return
      glide.to(measure().trackTopDoc)
    },

    /** D11: the résumé is a long way down; the browser's own smooth scroll takes it there. */
    goToResume() {
      glide.cancel()
      scrollToResume(isReduced() ? 'auto' : 'smooth')
    },

    /** R6: called once the page is at rest; finishes a half-open dive or a half-closed exit. */
    settle(dir) {
      if (sceneStatus() !== 'ready' || glide.active) return
      const m = measure()
      const t = settleTarget(m.s, m.L, dir)
      if (t !== null) glide.to(m.trackTopDoc + t)
    },

    /** R5: the plateau detent. Returns true when the wheel event should be prevented. */
    onWheel({ deltaY, deltaMode, timeStamp }) {
      if (sceneStatus() !== 'ready' || !ctrl.layout) return false
      const m = measure()
      const r = detent.onWheel({
        t: timeStamp,
        dy: wheelPixels(deltaY, deltaMode, m.L.stageH),
        s: m.s,
        diveEnd: m.L.diveEnd,
      })
      if (r.snapTo != null) scrollTo({ top: m.trackTopDoc + r.snapTo, behavior: 'instant' })
      return r.block
    },
  }

  return ctrl
}
