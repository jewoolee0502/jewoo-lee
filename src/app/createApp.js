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
import { createStore } from '../core/store.js'
import { createController } from '../stage/controller.js'
import { scrollToResume } from '../stage/scrollToResume.js'
import { loadScene } from '../scene/loadScene.js'

const NO_RECT = { top: 0, height: 0, bottom: 0, left: 0, right: 0, width: 0 }

/** The scene slot: its load status and, once ready, the imperative scene api. */
export function createSceneSlot() {
  const store = createStore({ status: 'loading' })
  const scene = {
    store,
    api: null,
    setApi(api) {
      scene.api = api ?? null
    },
    setStatus(status) {
      store.set({ status })
    },
  }
  return scene
}

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
      snd: app.snd,
      motion: app.motion,
      timers: app.timers,
      scene: () => app.scene?.api ?? null,
    }),
  )

  app.scene = pick('scene', () => createSceneSlot())
  app.ui = pick('ui', () => ({ store: createStore({ recOpen: false, stageVisible: false }) }))
  app.loadScene = pick('loadScene', () => loadScene)
  app.wallpaperEngine = pick('wallpaperEngine', () => null)

  // Stage elements, registered by <Stage/> while it is mounted. The controller writes the
  // per-frame cue opacity and the `zoomed` class straight to them (no React state per frame).
  app.dom = pick('dom', () => ({ track: null, stage: null, cue: null }))
  let cueEl = null
  let cueOpacity = null
  app.ctrl = pick('ctrl', () =>
    createController({
      getTrackRect: () => app.dom.track?.getBoundingClientRect() ?? NO_RECT,
      innerHeight: () => globalThis.innerHeight,
      scrollY: () => globalThis.scrollY,
      scrollTo: (opts) => globalThis.scrollTo(opts),
      reduce: () => app.motion.reduce(),
      sceneStatus: () => app.scene.store.get().status,
      os: app.os,
      ui: {
        setCue(v) {
          const el = app.dom.cue
          if (!el || (el === cueEl && v === cueOpacity)) return
          cueEl = el
          cueOpacity = v
          el.style.opacity = String(v)
        },
        setZoomed: (v) => app.dom.stage?.classList.toggle('zoomed', Boolean(v)),
        setTrap: (v) => app.host.setTrap(v),
      },
      scrollToResume: (behavior) => scrollToResume(behavior),
      timers: app.timers.child(),
    }),
  )
  app.nav = pick('nav', () => ({
    goToResume: () => app.ctrl.goToResume(),
    openLaptop: () => app.ctrl.enter(),
  }))

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
