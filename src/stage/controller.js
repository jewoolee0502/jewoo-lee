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
//
// plan-r2 §7 (U1–U9): once the scene is ready the page snaps mandatorily to a rail synced through
// `ui.setSnap(L)` once per layout (before any remap, so the browser never re-snaps to the old rail),
// with an always-stop at diveEnd that stops momentum flicks at the open laptop; the scene being
// unavailable or the stage unmounting (`releaseSnap`) turns it off. The resize remap and the detent
// snap are instant `glide.jump`s, which hold the snap around their write; a detent snap keeps it off
// until the next rest, so the browser cannot snap the stopped burst back short of diveEnd. The
// settle follows the last user direction (`settle({ dir, travel })`), the plateau is at least
// PLATEAU_MIN_PX, and the cue shows only at the top and in the dive.
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
  cueOpacity,
} from './runway.js'

const sameLayout = (a, b) =>
  a.R === b.R && a.diveEnd === b.diveEnd && a.insideEnd === b.insideEnd && a.outEnd === b.outEnd && a.stageH === b.stageH

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
  // The layout the snap rail was last synced to (null: not synced), and whether it was cleared
  // for the fallback.
  let snapL = null
  let snapCleared = false
  // Whether a detent snap keeps the page's CSS snap suspended until the next rest (see onWheel).
  let detentHold = false

  /** U1: the fallback (no scene) never snaps; cleared once, as soon as the scene is unavailable. */
  function clearSnap() {
    if (snapCleared) return
    snapCleared = true
    snapL = null
    ui.setSnap?.(null)
  }

  function releaseDetentHold() {
    if (!detentHold) return
    detentHold = false
    ui.holdSnap?.(false)
  }

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
      if (status === 'ready' && m.L.R > 1 && !(snapL && sameLayout(snapL, m.L))) {
        snapL = m.L
        ui.setSnap?.(m.L)
      }
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
        glide.jump(m.trackTopDoc + s)
      }
      ctrl.layout = m.L

      if (status === 'unavailable') {
        // R10: no scene, no runway. The flat compact OS is live from the first frame, and the
        // collapsed page never snaps (U1).
        clearSnap()
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
        ui.setCue(cueOpacity({ seg: poseAt(s, m.L).seg, z: 0 }))
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
      ui.setCue(cueOpacity(pose))
      ui.setHud?.(1 - ss(HUD_FADE[0], HUD_FADE[1], pose.z))
    },

    /** Inside is always flat (R4): compact on narrow screens, scaled to fill otherwise. The
     *  fallback (no scene) is flat, compact and live (L1280), and its runway collapses at once,
     *  without waiting for a frame. */
    applyFlat() {
      const { interactive, narrow } = store.get()
      const unavailable = sceneStatus() === 'unavailable'
      if (unavailable) clearSnap()
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

    /** R6, U6: called once the page is at rest with the last user direction and the travel since
     *  the last rest; finishes a half-open dive or a half-closed exit that way. */
    settle({ dir = 0, travel } = {}) {
      releaseDetentHold()
      if (sceneStatus() !== 'ready' || glide.active) return
      const m = measure()
      const t = settleTarget(m.s, m.L, dir, travel)
      if (t !== null) glide.to(m.trackTopDoc + t)
    },

    /** U1: the stage is going away: stop snapping and sync the rail afresh next time. */
    releaseSnap() {
      snapL = null
      detentHold = false
      ui.setSnap?.(null)
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
      if (r.snapTo != null) {
        // The browser ends the wheel's scroll sequence at the first blocked event and snaps from
        // where that sequence meant to end, which is short of the stop. Keep the CSS snap off until
        // the page is at rest (settle), when it re-snaps from diveEnd onto diveEnd itself.
        // Already on diveEnd (< 1 px): the jump moves nothing, so there is nothing to snap back.
        if (!detentHold && Math.abs(r.snapTo - m.s) >= 1) {
          detentHold = true
          ui.holdSnap?.(true)
        }
        glide.jump(m.trackTopDoc + r.snapTo)
      }
      return r.block
    },
  }

  return ctrl
}
