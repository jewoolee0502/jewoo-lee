// Attaches the stage's listeners, observers and the frame loop; every one is removed on cleanup (B5).
import { useEffect, useLayoutEffect } from 'react'
import { NARROW_PX } from '../core/constants.js'
import { createTicker } from './ticker.js'
import { createWheelHandler } from './wheel.js'
import { createKeyHandler } from './keys.js'
import { bindHostClasses } from '../os/hostClasses.js'

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

    const ro = new ResizeObserver(() => ctrl.setNarrow(stage.clientWidth < NARROW_PX))
    ro.observe(stage)

    const onWheel = createWheelHandler({
      ctrl,
      sceneStatus: () => scene.store.get().status,
      toast: (...args) => app.toasts.toast(...args),
    })
    stage.addEventListener('wheel', onWheel, { passive: false })
    const onKey = createKeyHandler({ app })
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      stage.removeEventListener('wheel', onWheel, { passive: false })
      ro.disconnect()
      io.disconnect()
      ticker.stop()
      offScene()
      offClasses()
    }
  }, [app, stageRef])
}
