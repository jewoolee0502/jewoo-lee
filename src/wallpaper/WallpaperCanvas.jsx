// The desktop background canvas (L316). Creates the wallpaper engine and registers it as
// `app.wallpaperEngine`, where the shared stage ticker drives it (D6). Follows the wallpaper
// store's mode. Everything is undone on unmount, so StrictMode's double mount is safe.
import { useEffect, useRef } from 'react'
import { useApp } from '../app/AppContext.jsx'
import { createWallpaperEngine } from './engine.js'
import { createSecretTracker } from './secrets.js'

export default function WallpaperCanvas() {
  const app = useApp()
  const ref = useRef(null)
  const engineRef = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const tracker = createSecretTracker({
      toast: (...args) => app.toasts.toast(...args),
      unlock: (id) => app.ach.unlock(id),
    })
    const engine = createWallpaperEngine({
      canvas,
      getOsSize: () => app.host.size(),
      getOsState: () => app.os.state,
      // The camera moves during the dive and during a programmatic glide (enter, exit, settle).
      isTweening: () => app.ctrl?.store.get().phase === 'dive' || Boolean(app.glide?.active),
      reduce: () => Boolean(app.motion.reduce()),
      snd: app.snd,
      tracker,
    })
    engineRef.current = engine
    app.wallpaperEngine = engine
    engine.setMode(app.wallpaper.store.get().mode)
    let mode = app.wallpaper.store.get().mode
    const offMode = app.wallpaper.store.subscribe((s) => {
      if (s.mode === mode) return
      mode = s.mode
      engine.setMode(mode)
    })
    // The OS turning on is the first moment the desktop is visible: draw it right away.
    const offOs = app.os.store.subscribe((s) => {
      if (s.state === 'on') engine.setMode(mode)
    })
    return () => {
      offMode()
      offOs()
      engine.dispose()
      if (engineRef.current === engine) engineRef.current = null
      if (app.wallpaperEngine === engine) app.wallpaperEngine = null
    }
  }, [app])

  return (
    <canvas
      ref={ref}
      className="wallpaper"
      id="wallpaper"
      aria-label="Animated pixel-art Montréal. Some things in the city are clickable."
      onClick={(e) => engineRef.current?.click(e)}
      onPointerMove={(e) => engineRef.current?.move(e)}
    />
  )
}
