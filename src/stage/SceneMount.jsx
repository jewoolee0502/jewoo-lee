// Loads the 3D scene lazily (B6: StrictMode-safe): only the last effect run creates a scene,
// and cleanup disposes it. No WebGL, a failed chunk or a throwing createScene gives status
// 'unavailable', so the site runs flat. `app.loadScene` is injectable for tests.
import { useEffect } from 'react'
import { useApp } from '../app/AppContext.jsx'

export default function SceneMount({ sceneLayerRef, stageRef, tipRef, parkRef }) {
  const app = useApp()

  useEffect(() => {
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
  }, [app, sceneLayerRef, stageRef, tipRef, parkRef])

  return null
}
