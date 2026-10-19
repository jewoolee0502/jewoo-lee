// Scroll / camera controller: a port of Ctrl (L1011–1031) with fixes B8 (armed starts null),
// B9 (goToResume suppresses auto-enter until p > .6), B10 (touch trap only while interactive)
// and B12 (no `ease`, no zoomIn/zoomOut aliases).
//
// A little scroll (or a click on the laptop) starts one eased timeline: the lid opens, then the
// camera dives. Scrolling never scrubs the camera directly, so wheel notches can't make it lurch
// or stop half-way. The store holds only the discrete fields React reads; p, z and tw are plain
// properties written every frame.
import { createStore } from '../core/store.js'
import { clamp, ss, easeIO } from '../core/math.js'

export function createController({
  getTrackRect,
  innerHeight,
  scrollY,
  scrollTo,
  reduce,
  sceneStatus,
  os,
  ui,
  scrollToResume,
  timers,
}) {
  const store = createStore({ mode: 'desk', interactive: false, narrow: false })
  const isReduced = () => Boolean(reduce?.())
  const behavior = () => (isReduced() ? 'auto' : 'smooth')
  let fallbackLive = false

  const ctrl = {
    store,
    p: 0,
    z: 0,
    tw: null,
    armed: null,
    suppress: false,

    update(dt) {
      const r = getTrackRect()
      const max = Math.max(1, r.height - innerHeight())
      ctrl.p = clamp(-r.top / max, 0, 1)
      const status = sceneStatus()
      if (status === 'unavailable') {
        if (!fallbackLive) ctrl.applyFlat()
        ui.setCue(1 - ss(0.01, 0.2, ctrl.p))
        if (ctrl.p > 0.1 && os.state === 'standby') os.boot()
        return
      }
      if (ctrl.armed === null) ctrl.armed = ctrl.p < 0.01
      else if (ctrl.p < 0.01 && !ctrl.suppress) ctrl.armed = true
      else if (ctrl.p > 0.6) {
        ctrl.armed = false
        ctrl.suppress = false
      }
      if (status === 'loading') {
        ui.setCue(0.8)
        return
      }
      const { mode } = store.get()
      if (mode === 'desk' && ctrl.armed && !ctrl.tw && ctrl.p > 0.02 && !ctrl.suppress) ctrl.enter()
      if (ctrl.tw) {
        const t = ctrl.tw
        t.t = Math.min(1, t.t + dt / t.dur)
        ctrl.z = t.from + (t.to - t.from) * easeIO(t.t)
        if (t.t >= 1) {
          ctrl.tw = null
          t.done?.()
        }
      }
      ui.setCue(0.8 * (1 - ss(0, 0.15, ctrl.z)))
      const inter = store.get().mode === 'inside' && !ctrl.tw
      if (inter !== store.get().interactive) {
        store.set({ interactive: inter })
        ui.setZoomed(inter)
        os.setLive(inter)
        ui.setTrap(inter)
        ctrl.applyFlat()
      }
    },

    /** The fallback (no scene) is always flat and compact (L1280). It is also always live, so
     *  window bodies scroll (the prototype left them overflow:hidden). The touch trap (B10) stays
     *  off: `interactive` never turns on without a scene, so visitors can still scroll the page. */
    applyFlat() {
      const { interactive, narrow } = store.get()
      const unavailable = sceneStatus() === 'unavailable'
      os.setFlat((interactive && narrow) || unavailable, unavailable ? true : narrow)
      if (unavailable) os.setLive(true)
      else if (fallbackLive) os.setLive(interactive)
      fallbackLive = unavailable
    },

    setNarrow(n) {
      store.set({ narrow: Boolean(n) })
      ctrl.applyFlat()
    },

    enter() {
      if (sceneStatus() !== 'ready' || store.get().mode === 'inside') return
      store.set({ mode: 'inside' })
      ctrl.armed = false
      os.boot()
      ctrl.tw = { from: ctrl.z, to: 1, t: 0, dur: isReduced() ? 0.01 : Math.max(0.5, 1.9 * (1 - ctrl.z)) }
      const top = getTrackRect().top
      if (top > 1) scrollTo({ top: scrollY() + top + 2, behavior: behavior() })
    },

    exit() {
      if (sceneStatus() !== 'ready' || store.get().mode === 'desk') return
      startExit()
      if (ctrl.p > 0.005) scrollTo({ top: getTrackRect().top + scrollY(), behavior: behavior() })
    },

    /** Bug K: focus moved out of the stage (Tab onto the résumé) while inside the laptop. Tween
     *  out like exit(), but never scroll and never move focus; suppress auto-enter like
     *  goToResume() (cleared once the page passes p .6) so it does not re-enter at once. */
    leave() {
      if (sceneStatus() !== 'ready' || store.get().mode !== 'inside') return
      ctrl.suppress = true
      ctrl.armed = false
      startExit()
    },

    /** D11: leave the laptop (if inside) and go to the résumé without re-triggering auto-enter. */
    goToResume() {
      ctrl.suppress = true
      ctrl.armed = false
      const b = behavior()
      if (store.get().mode === 'inside' && sceneStatus() === 'ready') {
        startExit()
        ctrl.tw.done = () => timers.timeout(() => scrollToResume(b), 100)
      } else {
        scrollToResume(b)
      }
    },
  }

  function startExit() {
    store.set({ mode: 'desk' })
    ctrl.tw = { from: ctrl.z, to: 0, t: 0, dur: isReduced() ? 0.01 : Math.max(0.5, 1.5 * ctrl.z) }
  }

  return ctrl
}
