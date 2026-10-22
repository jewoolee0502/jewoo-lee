// Scroll / camera controller (plan-r2 section 2, R1–R8; plan-r3 V2–V7).
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
//
// While the résumé view is shown the laptop is parked (V6): `park()` records where to come back to
// (`returnTo`, V7: a glide's end, else the nearer end by z, the desk without a scene) and freezes
// everything, so update, settle and enter do nothing and the timers that still fire (terminal exit,
// shutdown) only move `returnTo` to the desk. `unpark()` re-measures the shown track and jumps there;
// `unpark('here')` (a Back during the switch's fade-in, so the laptop was never hidden) puts the page
// back exactly where it was parked instead.
//
// A deep link's scene loads only on the first unpark (V17), so unpark('open') can land while the
// scene is still loading, when every position shows z 0. It lands at the desk instead and leaves an
// open pending: the first update with the scene ready runs enter(), so the lid opens with the normal
// glide. A user scroll off the desk, a park or an exit drops it. That same loading → ready update
// settles a page the visitor left mid-dive while loading (no idle settle runs without a scene).
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
  sceneStatus,
  os,
  ui,
}) {
  const store = createStore({ phase: 'desk', interactive: false, narrow: false, parked: false })
  let runwayFlat = false
  let fallbackBooted = false
  let fallbackLive = false
  // The end ('open' | 'desk') of the glide this controller last started; meaningful only while
  // that glide is active.
  let glideEnd = null
  // V7: where unpark() lands by default ('open' | 'desk'), recorded by park().
  let returnTo = 'desk'
  // The track-relative scroll park() measured (null when it measured nothing), for unpark('here').
  let parkedS = null
  // unpark('open') while the scene loads: open once it is ready (V17).
  let pendingOpen = false
  // The scene status the last unparked update saw, to catch the loading → ready transition.
  let lastStatus = null
  // The track-relative scroll the last unparked update ended at, so the resize rule can tell a page
  // at rest from one the visitor is scrolling (V5).
  let lastS = null

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

    /** V7: where the next unpark() lands by default. */
    get returnTo() {
      return returnTo
    },

    update() {
      // I9: a parked laptop is display:none; measuring it would read a 0 × 0 track.
      if (store.get().parked) return
      const m = measure()
      let { s } = m
      const prev = ctrl.layout
      const status = sceneStatus()
      const nowReady = lastStatus === 'loading' && status === 'ready'
      lastStatus = status
      if (!glide.active) glideEnd = null
      // V5: a layout change (rotation, window resize, the mobile toolbar). A glide this controller
      // started is re-aimed at its end; otherwise the resize rule may move the page once. That jump
      // is an own scroll, so the idle still settles a mid-dive page by the user's last direction and
      // travel (U6, U7). Following a moved document end needs a page at rest (`s` unchanged since
      // the last frame), so a visitor scrolling through a resize is never pulled. The fallback has
      // no runway to keep, and an unmeasured track (R 1) is not a layout.
      if (status !== 'unavailable' && prev && prev.R > 1 && m.L.R > 1 && !sameLayout(prev, m.L)) {
        if (glide.active && glideEnd) glideTo(m, glideEnd)
        else {
          const still = lastS !== null && Math.abs(s - lastS) < 1
          const t = relayout(s, prev, m.L, store.get().interactive, still)
          if (t !== null) {
            glide.jump(m.trackTopDoc + t)
            s = t
          }
        }
      }
      ctrl.layout = m.L
      lastS = s
      // A scroll off the desk is the visitor moving on: no open later. Checked before the status
      // branches, so it also holds on the frame the scene turns ready.
      if (pendingOpen && Math.abs(s) >= 1) pendingOpen = false

      if (status === 'unavailable') {
        // No scene will come: nothing left to open.
        pendingOpen = false
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

      // The scene just became ready: open it if an unpark asked for that while it loaded, else
      // finish a dive left half-open while loading (the nearer end; no-op at the desk or open).
      if (nowReady) {
        if (pendingOpen) {
          pendingOpen = false
          ctrl.enter()
        } else ctrl.settle({ dir: 0 })
      }
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
     *  hotspot, ★, "Open the laptop" in the laptop view). The fallback (no scene) is already in, a
     *  loading scene has no laptop yet, and a parked laptop is not on screen. */
    enter() {
      if (store.get().parked || sceneStatus() !== 'ready' || store.get().interactive) return
      glideTo(measure(), 'open')
    },

    /** Esc, ⏏ Close laptop, Shut Down…: glide back to the closed laptop. Parked (a terminal `exit`
     *  or a shutdown landing while the résumé is shown), it only makes the return land closed. */
    exit() {
      pendingOpen = false
      if (store.get().parked) {
        returnTo = 'desk'
        return
      }
      if (sceneStatus() !== 'ready' || store.get().phase === 'desk') return
      glideTo(measure(), 'desk')
    },

    /** V6, V7: freezes the laptop before it is hidden and records where to return: `where` if given,
     *  else the end of a glide in flight, else the nearer end (z ≥ .5 is open); the desk with no
     *  scene. Returns that place. */
    park(where) {
      if (store.get().parked) return returnTo
      parkedS = null
      pendingOpen = false
      if (where) returnTo = where
      else if (sceneStatus() === 'unavailable') returnTo = 'desk'
      else if (glide.active && glideEnd) returnTo = glideEnd
      else {
        const m = measure()
        parkedS = m.s
        returnTo = poseAt(m.s, m.L).z >= 0.5 ? 'open' : 'desk'
      }
      glide.cancel()
      glideEnd = null
      store.set({ parked: true })
      return returnTo
    },

    /** V6, I10: after the laptop is shown again, re-measures it (the window may have changed while
     *  hidden) and jumps to `where` (the open end R or the desk), with no glide. The fallback always
     *  lands at the desk, its only place. `'here'` is the scroll park() measured, when it measured
     *  one (else `returnTo`): a rest there mid-dive (its idle settle was skipped while parked) then
     *  settles by glide, so the laptop is never left half-open. Returns the end used: for 'here',
     *  the end that settle glides to, else 'open' on the plateau (z 1) and 'desk' otherwise.
     *  'open' while the scene is still loading lands at the desk (returns 'desk') and glides open
     *  once the scene is ready, unless the visitor moves first (V17). */
    unpark(where = returnTo) {
      if (!store.get().parked) return null
      store.set({ parked: false })
      const m = measure()
      ctrl.layout = m.L
      let w = sceneStatus() === 'unavailable' ? 'desk' : where
      if (w === 'here' && parkedS === null) w = returnTo
      if (w === 'open' && sceneStatus() === 'loading') {
        w = 'desk'
        pendingOpen = true
      }
      const s = w === 'here' ? Math.min(Math.max(parkedS, 0), m.L.R) : w === 'open' ? m.L.R : 0
      parkedS = null
      glide.jump(m.trackTopDoc + s)
      ctrl.update()
      if (w !== 'here') return w
      ctrl.settle()
      return glideEnd ?? (poseAt(s, m.L).z >= 1 ? 'open' : 'desk')
    },

    /** R6, U6: called once the page is at rest with the last user direction and the travel since
     *  the last rest; finishes a half-open dive that way, to the desk or the open laptop. */
    settle({ dir = 0, travel } = {}) {
      if (store.get().parked || sceneStatus() !== 'ready' || glide.active) return
      const m = measure()
      const t = settleTarget(m.s, m.L, dir, travel)
      if (t !== null) glideTo(m, t === 0 ? 'desk' : 'open')
    },
  }

  return ctrl
}
