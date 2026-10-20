// Loads the 3D scene lazily (B6: StrictMode-safe): only the last effect run creates a scene,
// and cleanup disposes it. No WebGL, a failed chunk or a throwing createScene gives status
// 'unavailable', so the site runs flat. `app.loadScene` is injectable for tests.
// plan-r3 V17 (I17): a deep link to the résumé parks the laptop before the Stage mounts, so the scene
// (the three.js chunk and the GPU init) waits for the first unparked moment. `live` is a one-way
// latch: the loading effect depends on it, not on `parked`, so a later park never disposes the scene.
import { useEffect, useState } from 'react'
import { useApp } from '../app/AppContext.jsx'

const isParked = (app) => Boolean(app.ctrl?.store?.get?.().parked)

export default function SceneMount({ sceneLayerRef, stageRef, tipRef, parkRef }) {
  const app = useApp()
  const [live, setLive] = useState(() => !isParked(app))

  // While waiting, latch on the first unparked state (re-checked here in case it changed before
  // the effect ran).
  useEffect(() => {
    if (live) return undefined
    if (!isParked(app)) {
      setLive(true)
      return undefined
    }
    return app.ctrl.store.subscribe((s) => {
      if (!s.parked) setLive(true)
    })
  }, [app, live])

  useEffect(() => {
    // Status stays 'loading' while the laptop has never been shown.
    if (!live) return undefined
    let cancelled = false
    let api = null
    app.scene.setStatus('loading')
    Promise.resolve()
      .then(() => app.loadScene())
      .then(
        (mod) => {
          if (cancelled) return
          if (!mod) return app.scene.setStatus('unavailable')
          try {
            api = mod.createScene({
              app,
              mount: sceneLayerRef?.current ?? null,
              stage: stageRef?.current ?? null,
              holder: app.host.holder,
              park: parkRef?.current ?? null,
              tipEl: tipRef?.current ?? null,
              reduce: () => app.motion.reduce(),
            })
            app.scene.setApi(api)
            app.scene.setStatus('ready')
          } catch (e) {
            console.error(e)
            api = null
            app.scene.setStatus('unavailable')
          }
        },
        (e) => {
          if (cancelled) return
          console.error(e)
          app.scene.setStatus('unavailable')
        },
      )
    return () => {
      cancelled = true
      api?.dispose?.()
      api = null
      app.scene.setApi(null)
    }
  }, [app, live, sceneLayerRef, stageRef, tipRef, parkRef])

  return null
}
