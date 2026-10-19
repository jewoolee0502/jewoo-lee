// Attaches the stage's listeners, observers and the frame loop; every one is removed on cleanup (B5).
// Scrolling is native (plan-r2 R1): the window listeners are passive and only feed the glide's
// cancel and the idle settle. The one non-passive listener is the #stage wheel detent (R5), and it
// is attached only while the controller says the detent can act (the dive), so wheel scrolling
// everywhere else stays on the compositor.
import { useEffect, useLayoutEffect } from 'react'
import { NARROW_PX, SHORT_PX, SETTLE_GRACE_MS } from '../core/constants.js'
import { createTicker } from './ticker.js'
import { createKeyHandler } from './keys.js'
import { createScrollIdle } from './scrollIdle.js'
import { bindHostClasses } from '../os/hostClasses.js'
import { pinScroll } from './pinScroll.js'

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
    const els = { track: trackRef.current, stage: stageRef.current, cue: cueRef.current }
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
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          ui.store.set({ stageVisible: en.isIntersecting })
          if (en.isIntersecting) ticker.start()
          else ticker.stop()
        }
      },
      { threshold: 0 },
    )
    io.observe(stage)

    const ro = new ResizeObserver(() => {
      ctrl.setNarrow(stage.clientWidth < NARROW_PX || stage.clientHeight < SHORT_PX)
      app.os.refit?.()
    })
    ro.observe(stage)

    const timers = app.timers.child()
    const idle = createScrollIdle({ timers, onIdle: (dir) => ctrl.settle(dir), y: window.scrollY })
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

    // Passive and on the window, so a wheel anywhere (the résumé too) cancels a glide and holds
    // the settle whether or not the detent listener is attached.
    listen(window, 'wheel', () => {
      app.glide.cancel()
      graceHold('wheel')
    })
    // R5: the detent, only while it can act (see controller `detent`). It runs before the window
    // listener, so it cancels a running glide itself before it may snap.
    const detentWheel = (e) => {
      app.glide.cancel()
      if (ctrl.onWheel(e)) e.preventDefault()
    }
    const blocking = { passive: false }
    let detentOn = false
    const syncDetent = () => {
      const want = Boolean(ctrl.store.get().detent)
      if (want === detentOn) return
      detentOn = want
      if (want) stage.addEventListener('wheel', detentWheel, blocking)
      else stage.removeEventListener('wheel', detentWheel, blocking)
    }
    syncDetent()
    const offDetent = ctrl.store.subscribe(syncDetent)
    listen(window, 'scroll', () => {
      app.glide.onScroll(window.scrollY)
      idle.scroll(window.scrollY)
    })
    if ('onscrollend' in window) listen(window, 'scrollend', () => idle.scrollEnd())
    for (const [kind, down, ups] of [
      ['touch', 'touchstart', ['touchend', 'touchcancel']],
      ['pointer', 'pointerdown', ['pointerup', 'pointercancel']],
    ]) {
      listen(window, down, () => {
        app.glide.cancel()
        idle.hold(kind, true)
      })
      for (const up of ups) listen(window, up, () => idle.hold(kind, false))
    }
    const onKey = createKeyHandler({ app })
    listen(
      window,
      'keydown',
      (e) => {
        if (!MODIFIER_KEYS.has(e.key)) app.glide.cancel()
        if (scrollsPage(e)) graceHold('key')
        onKey(e)
      },
      false,
    )

    // Bug J: keep the overflow:hidden containers that hold the OS from keeping a scroll offset.
    const unpins = [stage, flatHostRef.current, host.osEl].map(pinScroll)

    return () => {
      unpins.forEach((off) => off())
      for (const [target, type, fn, opts] of on.splice(0)) target.removeEventListener(type, fn, opts)
      offDetent()
      if (detentOn) stage.removeEventListener('wheel', detentWheel, blocking)
      detentOn = false
      idle.dispose()
      timers.clearAll()
      app.glide.cancel()
      ro.disconnect()
      io.disconnect()
      ticker.stop()
      offScene()
      offClasses()
    }
  }, [app, stageRef, flatHostRef])
}
