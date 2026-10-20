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
import { createGlide } from '../stage/glide.js'
import { createViews } from '../stage/views.js'
import { saveScroll, restoreScroll } from '../os/keepScroll.js'
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
  // per-frame cue opacity, the `zoomed` class and `flat-runway` straight to them (no React state
  // per frame).
  app.dom = pick('dom', () => ({ track: null, stage: null, cue: null }))
  // Programmatic page scrolls at our own pace (R7); the bindings cancel it on user input.
  app.glide = pick('glide', () =>
    createGlide({
      getY: () => globalThis.scrollY,
      scrollTo: (o) => globalThis.scrollTo(o),
      raf: (cb) => globalThis.requestAnimationFrame(cb),
      caf: (id) => globalThis.cancelAnimationFrame(id),
      now: () => performance.now(),
      reduce: () => app.motion.reduce(),
    }),
  )
  let cueEl = null
  let cueOpacity = null
  let hudStage = null
  let hudOpacity = null
  app.ctrl = pick('ctrl', () =>
    createController({
      getTrackRect: () => app.dom.track?.getBoundingClientRect() ?? NO_RECT,
      getStageHeight: () => app.dom.stage?.clientHeight || globalThis.innerHeight,
      scrollY: () => globalThis.scrollY,
      glide: app.glide,
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
        // The HUD fades out as the screen grows under it, so it never sits on the OS menubar.
        setHud(v) {
          const el = app.dom.stage
          if (!el || (el === hudStage && v === hudOpacity)) return
          hudStage = el
          hudOpacity = v
          if (v === 1) el.style.removeProperty('--hud')
          else el.style.setProperty('--hud', String(Math.round(v * 1000) / 1000))
          el.classList.toggle('hud-dim', v < 0.5)
          el.classList.toggle('hud-off', v === 0)
        },
        setZoomed: (v) => app.dom.stage?.classList.toggle('zoomed', Boolean(v)),
        setRunway: (flat) => app.dom.track?.classList.toggle('flat-runway', Boolean(flat)),
      },
    }),
  )
  // The two views (plan-r3 V1, V6): the laptop is parked while the résumé view is shown. Leaving
  // the laptop closes its dialogs, so nothing is left open (or focused) behind display:none. The
  // OS windows' and terminal's scroll offsets are dropped by display:none, so they are saved at
  // park (still shown) and written back right after unpark (shown again, before the next frame).
  // main.jsx calls views.init() once; until then nothing reads the URL or listens to history.
  let osScroll = null
  app.views = pick('views', () =>
    createViews({
      laptop: {
        park: (w) => {
          osScroll = saveScroll(app.host?.osEl)
          return app.ctrl.park(w)
        },
        unpark: (w) => {
          const where = app.ctrl.unpark(w)
          restoreScroll(osScroll)
          osScroll = null
          return where
        },
        beforeLeave: () => {
          app.ui.store.set({ recOpen: false })
          app.os.setMenu?.(false)
        },
      },
      reduce: () => app.motion.reduce(),
      timers: app.timers.child(),
    }),
  )
  // Every way between the views: the HUD, the pill, the Recruiter view, ◆ Résumé, ResumeApp and the
  // skip link go to the résumé; "← Laptop view" goes back; "Open the laptop" goes back, open (or
  // just opens it from the laptop view).
  app.nav = pick('nav', () => ({
    goToResume: (o) => app.views.toResume(o),
    openLaptop: () => (app.views.get() === 'resume' ? app.views.toLaptop({ place: 'open' }) : app.ctrl.enter()),
    backToLaptop: () => app.views.toLaptop(),
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

  /** Tears everything down: timers, media and history listeners. */
  app.dispose = () => {
    app.views?.dispose?.()
    app.glide?.cancel?.()
    app.os?.dispose?.()
    app.timers.clearAll?.()
    app.motion.dispose?.()
  }

  return app
}
