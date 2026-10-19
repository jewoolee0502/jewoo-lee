// Composition root (D5). One app object per mount; tests pass fakes for any field.
// Cross-module calls use late-bound getters (e.g. `app.toasts`) so overrides win.
import { createTimers } from '../core/timers.js'
import { createMotion } from '../core/motion.js'
import { createToasts } from '../core/toasts.js'
import { createSound } from '../core/sound.js'
import { createAchievements } from '../core/achievements.js'
import { createWallpaperStore } from '../wallpaper/wallpaperStore.js'
import { createOsHost } from '../os/osHost.js'
import { createOsController } from '../os/osController.js'
import { registry } from '../os/registry.js'

export function createApp(overrides = {}) {
  const app = {}
  const pick = (key, make) => (Object.hasOwn(overrides, key) ? overrides[key] : make())

  app.timers = pick('timers', () => createTimers())
  app.motion = pick('motion', () => createMotion())
  app.toasts = pick('toasts', () => createToasts({ timers: app.timers.child() }))
  app.snd = pick('snd', () => createSound())
  app.ach = pick('ach', () =>
    createAchievements({
      toast: (...args) => app.toasts.toast(...args),
      snd: { ach: () => app.snd.ach() },
    }),
  )
  app.wallpaper = pick('wallpaper', () => createWallpaperStore())
  app.host = pick('host', () => createOsHost())
  app.os = pick('os', () =>
    createOsController({
      host: app.host,
      registry,
      ach: app.ach,
      toasts: app.toasts,
      snd: app.snd,
      motion: app.motion,
      timers: app.timers,
      scene: () => app.scene?.api ?? null,
      ctrl: () => app.ctrl,
    }),
  )

  // Any extra override fields (later phases' modules or test fakes) are kept as given.
  for (const key of Object.keys(overrides)) {
    if (!Object.hasOwn(app, key)) app[key] = overrides[key]
  }

  /** Starts app-level background work. Returns a stop function. */
  app.start = () => {
    const stopWp = app.wallpaper.start?.(app.timers)
    return () => stopWp?.()
  }

  /** Tears everything down: timers, media listeners. */
  app.dispose = () => {
    app.os?.dispose?.()
    app.timers.clearAll?.()
    app.motion.dispose?.()
  }

  return app
}
