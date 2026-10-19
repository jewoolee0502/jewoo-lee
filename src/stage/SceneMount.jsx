// Loads the 3D scene lazily (B6: StrictMode-safe). The phase 3 loader returns null, so the
// status becomes 'unavailable' and the site runs flat. `app.loadScene` is injectable for tests.
import { useEffect } from 'react'
import { useApp } from '../app/AppContext.jsx'

export default function SceneMount({ sceneLayerRef, stageRef, tipRef }) {
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
              stage: stageRef?.current ?? null,
              layer: sceneLayerRef?.current ?? null,
              tip: tipRef?.current ?? null,
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
  }, [app, sceneLayerRef, stageRef, tipRef])

  return null
}
