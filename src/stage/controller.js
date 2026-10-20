// Scroll / camera controller (plan-r2 section 2, R1–R8; plan-r3 V2–V5).
//
// The camera pose is a pure function of the page scroll (R1): every frame measures the track,
// builds the runway layout from the measured pinned range (R3) and reads z off it, so wheel,
// trackpad momentum, touch, keys, the scrollbar and hash jumps all drive the dive the same way.
// Nothing here animates z, and nothing intercepts scrolling: the laptop document ends at the open
// laptop (V2), so the browser's own scroll clamp is the stop. Programmatic moves (enter, exit, the
// idle settle) are page scrolls through `glide` (R7), and all of them aim at one of two ends: the
// desk (track top) or the open laptop (the document end R, V3). `glideTo` records which end a
// glide is heading for (`glideEnd`), so a layout change mid-glide re-aims it at the same end in the
// new layout instead of leaving it mid-dive (V5).
//
// The store holds only the discrete fields React and the bindings read; z, seg and layout are
// plain properties written every frame. On a layout change the resize rule (`relayout`, V5) runs
// before `ctrl.layout` takes the new layout: an open laptop stays open, the desk stays the desk, and
// a mid-dive position keeps its fraction only across a large change. The settle follows the last
// user direction (`settle({ dir, travel })`, U6), and the cue shows only at the top and in the dive.
import { createStore } from '../core/store.js'
import { ss } from '../core/math.js'
import { HUD_FADE } from '../core/constants.js'
import { runwayLayout, poseAt, nextInteractive, settleTarget, relayout, cueOpacity } from './runway.js'

const sameLayout = (a, b) => a.R === b.R && a.diveEnd === b.diveEnd

export function createController({
  getTrackRect,
  getStageHeight,
  scrollY,
  glide,
  reduce,
  sceneStatus,
  os,
  ui,
  scrollToResume,
}) {
  const store = createStore({ phase: 'desk', interactive: false, narrow: false })
  const isReduced = () => Boolean(reduce?.())
  let runwayFlat = false
  let fallbackBooted = false
  let fallbackLive = false
  // The end ('open' | 'desk') of the glide this controller last started; meaningful only while
  // that glide is active.
  let glideEnd = null

  /** Measures the track: its layout, the track-relative scroll `s` and the track's document top. */
  function measure() {
    const r = getTrackRect()
    const L = runwayLayout({ trackH: r.height, stageH: getStageHeight() })
    return { L, s: -r.top, trackTopDoc: scrollY() + r.top }
  }

  /** V3: glides to one of the two ends: the open laptop (R) or the desk (the track top). */
  function glideTo(m, where) {
    glideEnd = where
    glide.to(m.trackTopDoc + (where === 'open' ? m.L.R : 0))
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
      if (!glide.active) glideEnd = null
      // V5: a layout change (rotation, window resize, the mobile toolbar). A glide this controller
      // started is re-aimed at its end; otherwise the resize rule may move the page once. That jump
      // is an own scroll, so the idle still settles a mid-dive page by the user's last direction and
      // travel (U6, U7). The fallback has no runway to keep, and an unmeasured track (R 1) is not a
      // layout.
      if (status !== 'unavailable' && prev && prev.R > 1 && m.L.R > 1 && !sameLayout(prev, m.L)) {
        if (glide.active && glideEnd) glideTo(m, glideEnd)
        else {
          const t = relayout(s, prev, m.L, store.get().interactive)
          if (t !== null) {
            glide.jump(m.trackTopDoc + t)
            s = t
          }
        }
      }
      ctrl.layout = m.L

      if (status === 'unavailable') {
        // R10: no scene, no runway. The flat OS is live from the first frame.
        if (!fallbackBooted) {
          fallbackBooted = true
          if (os.state === 'standby') os.boot()
        }
        if (!fallbackLive) ctrl.applyFlat()
        ui.setCue(0)
        ui.setHud?.(1)
        return
      }
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
     *  fallback (no scene) is flat and live (L1280), compact only on narrow screens like inside,
     *  and its runway collapses at once, without waiting for a frame. */
    applyFlat() {
      const { interactive, narrow } = store.get()
      const unavailable = sceneStatus() === 'unavailable'
      if (unavailable && !runwayFlat) {
        runwayFlat = true
        ui.setRunway?.(true)
      }
      os.setFlat(interactive || unavailable, narrow)
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

    /** V3: glide to the open laptop (the document end R) from wherever the page is (the laptop, a
     *  hotspot, ★, "Open the laptop"). The fallback (no scene) is already in, and a loading scene
     *  has no laptop yet. Until the two views (plan-r3 R3-2) the résumé still follows the track, so a
     *  page scrolled past R is not on the laptop: from there the fallback glides back up to the
     *  track top, and an "interactive" laptop that has scrolled away glides back to R. */
    enter() {
      const status = sceneStatus()
      if (status === 'unavailable') {
        const m = measure()
        if (m.s > 0) glide.to(m.trackTopDoc)
        return
      }
      if (status !== 'ready') return
      const m = measure()
      if (store.get().interactive && m.s <= m.L.R + 1) return
      glideTo(m, 'open')
    },

    /** Esc, ⏏ Close laptop, Shut Down…: glide back to the closed laptop. */
    exit() {
      if (sceneStatus() !== 'ready' || store.get().phase === 'desk') return
      glideTo(measure(), 'desk')
    },

    /** D11: the résumé is still below the track (until the two views); the browser's own smooth
     *  scroll takes the reader there. */
    goToResume() {
      glide.cancel()
      scrollToResume?.(isReduced() ? 'auto' : 'smooth')
    },

    /** R6, U6: called once the page is at rest with the last user direction and the travel since
     *  the last rest; finishes a half-open dive that way, to the desk or the open laptop. */
    settle({ dir = 0, travel } = {}) {
      if (sceneStatus() !== 'ready' || glide.active) return
      const m = measure()
      const t = settleTarget(m.s, m.L, dir, travel)
      if (t !== null) glideTo(m, t === 0 ? 'desk' : 'open')
    },
  }

  return ctrl
}
