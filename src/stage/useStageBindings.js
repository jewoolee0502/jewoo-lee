// Attaches the stage's listeners, observers and the frame loop; every one is removed on cleanup (B5).
// Scrolling is native (plan-r2 R1): every listener is passive and only feeds the glide's cancel and
// the idle settle, so wheel, touch and key scrolling all stay on the compositor. Nothing snaps and
// nothing intercepts the wheel or the keys: the laptop document ends at the open laptop (plan-r3
// V2), so the browser's own scroll clamp is the stop. Scrolls the glide wrote are reported to the
// idle as its own, so they never count as user direction (U7).
// While the controller is parked (the résumé view, plan-r3 V6, I9) the stage is display:none: the
// ticker stops (WebGL and the wallpaper rest), and the window scroll (the résumé's own), the idle
// settle and the stage's 0 × 0 resize are ignored. Unparking restarts the ticker at once, and the
// shown stage reports its real size to the resize observer before the next paint.
import { useEffect, useLayoutEffect } from 'react'
import { NARROW_PX, SHORT_PX, SETTLE_GRACE_MS } from '../core/constants.js'
import { createTicker } from './ticker.js'
import { createKeyHandler } from './keys.js'
import { createScrollIdle } from './scrollIdle.js'
import { bindHostClasses } from '../os/hostClasses.js'
import { pinScroll } from './pinScroll.js'

/** How long after the Konami code completes the page's scrolls are still its own arrows'. */
const KONAMI_TAIL_MS = 150
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta'])
const SCROLL_KEYS = new Set([' ', 'Spacebar', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'])

/** Whether a keydown is the page scrolling: not typed into a field, not a focused button's Space. */
function scrollsPage(e) {
  if (e.defaultPrevented || !SCROLL_KEYS.has(e.key)) return false
  const t = e.target
  if (!(t instanceof Element)) return true
  if (t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return false
  if ((e.key === ' ' || e.key === 'Spacebar') && t.closest('button, [role="button"], summary')) return false
  return true
}

export function useStageBindings(app, { trackRef, stageRef, cueRef, flatHostRef, parkRef }) {
  // Elements first (layout effect), so the controller and host can use them in the same commit.
  useLayoutEffect(() => {
    const { dom, host } = app
    const els = {
      track: trackRef.current,
      stage: stageRef.current,
      cue: cueRef.current,
    }
    Object.assign(dom, els)
    host.bindFlatHost(flatHostRef.current)
    host.attachPark(parkRef.current)
    return () => {
      host.detachPark()
      host.bindFlatHost(null)
      for (const k of Object.keys(els)) if (dom[k] === els[k]) dom[k] = null
    }
  }, [app, trackRef, stageRef, cueRef, flatHostRef, parkRef])

  useEffect(() => {
    const { ctrl, scene, ui, os, host } = app
    const stage = stageRef.current
    const offClasses = bindHostClasses({ os, host, sceneStore: scene.store })

    // Scene status changes move the OS in or out of the flat host.
    let status = scene.store.get().status
    ctrl.applyFlat()
    const offScene = scene.store.subscribe((s) => {
      if (s.status === status) return
      status = s.status
      ctrl.applyFlat()
    })

    const ticker = createTicker({
      raf: (cb) => window.requestAnimationFrame(cb),
      caf: (id) => window.cancelAnimationFrame(id),
      onFrame(t, dt) {
        ctrl.update(dt)
        app.scene.api?.frame?.(t, dt)
        app.wallpaperEngine?.tick?.(t)
      },
    })
    const isParked = () => Boolean(ctrl.store.get().parked)
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          const on = en.isIntersecting && !isParked()
          ui.store.set({ stageVisible: on })
          if (on) ticker.start()
          else ticker.stop()
        }
      },
      { threshold: 0 },
    )
    io.observe(stage)
    // Parking hides the stage; unparking shows it at a pinned place, so the ticker need not wait for
    // the observer's next report.
    let parked = isParked()
    const offPark = ctrl.store.subscribe((s) => {
      if (Boolean(s.parked) === parked) return
      parked = Boolean(s.parked)
      ui.store.set({ stageVisible: !parked })
      if (parked) ticker.stop()
      else ticker.start()
    })

    // A hidden (parked) stage measures 0 × 0, which would flip `narrow` and compact the OS.
    const ro = new ResizeObserver(() => {
      if (isParked()) return
      ctrl.setNarrow(stage.clientWidth < NARROW_PX || stage.clientHeight < SHORT_PX)
      app.os.refit?.()
    })
    ro.observe(stage)
    // The fallback's flat host sits in a grid under the notice and HUD bar, so its size can change
    // while the stage's does not (the bar wrapping, the notice mounting): re-fit on its size too.
    if (flatHostRef.current) ro.observe(flatHostRef.current)

    const timers = app.timers.child()
    // No settle under the Recruiter view: keys there may nudge the page (nothing in the card to
    // scroll), and a glide must not open the laptop behind the dialog. The rest still counts, so the
    // next one after it closes measures its travel from here.
    const onIdle = (info) => {
      if (!ui.store.get().recOpen && !isParked()) ctrl.settle(info)
    }
    const idle = createScrollIdle({ timers, onIdle, y: window.scrollY })
    // The wheel and the scroll keys come in bursts (momentum, key repeat) with gaps where the page
    // can look at rest; each one holds the settle until SETTLE_GRACE_MS after its last event.
    const graceEnds = {}
    const graceHold = (kind) => {
      idle.hold(kind, true)
      graceEnds[kind]?.()
      graceEnds[kind] = timers.timeout(() => {
        graceEnds[kind] = null
        idle.hold(kind, false)
      }, SETTLE_GRACE_MS)
    }
    const passive = { passive: true }
    const on = []
    const listen = (target, type, fn, opts = passive) => {
      target.addEventListener(type, fn, opts)
      on.push([target, type, fn, opts])
    }

    // On the window, so a wheel anywhere (the résumé too) cancels a glide and holds the settle.
    listen(window, 'wheel', () => {
      endKonamiOwn()
      app.glide.cancel()
      graceHold('wheel')
    })
    // While the Konami code is typed, its arrows move the page too; those moves are not the user
    // scrolling, so once the code completes the settle has no direction or travel to follow. Its
    // last native arrow frames can land just after it completes (KONAMI_TAIL_MS). A real wheel,
    // touch or pointer press is the user taking the page back, and ends this at once.
    let konami = false
    let konamiTail = null
    const endKonamiOwn = () => {
      konami = false
      konamiTail?.()
      konamiTail = null
    }
    // Parked, the window scroll is the résumé's, never the laptop's direction or travel.
    listen(window, 'scroll', () => {
      if (isParked()) return
      const y = window.scrollY
      const own = Boolean(app.glide.owns?.(y))
      app.glide.onScroll(y)
      idle.scroll(y, own || konami)
    })
    if ('onscrollend' in window) listen(window, 'scrollend', () => idle.scrollEnd())
    for (const [kind, down, ups] of [
      ['touch', 'touchstart', ['touchend', 'touchcancel']],
      ['pointer', 'pointerdown', ['pointerup', 'pointercancel']],
    ]) {
      listen(window, down, () => {
        endKonamiOwn()
        app.glide.cancel()
        idle.hold(kind, true)
      })
      for (const up of ups) listen(window, up, () => idle.hold(kind, false))
    }
    // Typing the Konami code holds the settle, so its arrows never open the laptop halfway.
    const hold = (on) => {
      if (on) konami = true
      else endKonamiOwn()
      idle.hold('konami', on)
    }
    const onKey = createKeyHandler({ app, hold, timers })
    listen(
      window,
      'keydown',
      (e) => {
        if (!MODIFIER_KEYS.has(e.key)) app.glide.cancel()
        if (scrollsPage(e)) graceHold('key')
        if (onKey(e)) {
          konami = true
          konamiTail = timers.timeout(endKonamiOwn, KONAMI_TAIL_MS)
        }
      },
      false,
    )

    // Bug J: keep the overflow:hidden containers that hold the OS from keeping a scroll offset.
    const unpins = [stage, flatHostRef.current, host.osEl].map(pinScroll)

    return () => {
      unpins.forEach((off) => off())
      for (const [target, type, fn, opts] of on.splice(0)) target.removeEventListener(type, fn, opts)
      idle.dispose()
      timers.clearAll()
      app.glide.cancel()
      ro.disconnect()
      io.disconnect()
      ticker.stop()
      offPark()
      offScene()
      offClasses()
    }
  }, [app, stageRef, flatHostRef])
}
