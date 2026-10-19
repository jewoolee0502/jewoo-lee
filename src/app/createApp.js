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
import { snapPoints } from '../stage/runway.js'
import { syncSnapRail } from '../stage/snapRail.js'
import { RUNWAY_SNAP } from '../core/constants.js'
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
  // per-frame cue opacity, the `zoomed` class and `flat-runway` straight to them (no React state
  // per frame), and syncs the snap rail once per layout.
  app.dom = pick('dom', () => ({ track: null, stage: null, cue: null, rail: null }))
  // plan-r2 §7 U1: snapping needs scroll-snap-stop (the plateau stop); without it the page never snaps.
  app.snapSupported = pick('snapSupported', () => () =>
    RUNWAY_SNAP && Boolean(globalThis.CSS?.supports?.('scroll-snap-stop', 'always')),
  )
  const root = () => globalThis.document?.documentElement
  // `snap-hold` is on while either the glide is writing or a detent snap is waiting for its wheel
  // burst to end (see the controller's onWheel).
  const snapHolds = { glide: false, detent: false }
  const syncHold = () => root()?.classList.toggle('snap-hold', snapHolds.glide || snapHolds.detent)
  const holdSnap = (kind, on) => {
    snapHolds[kind] = Boolean(on)
    syncHold()
  }
  // Programmatic page scrolls at our own pace (R7); the bindings cancel it on user input. Its
  // writes suspend the page's snap (U3).
  app.glide = pick('glide', () =>
    createGlide({
      getY: () => globalThis.scrollY,
      scrollTo: (o) => globalThis.scrollTo(o),
      raf: (cb) => globalThis.requestAnimationFrame(cb),
      caf: (id) => globalThis.cancelAnimationFrame(id),
      now: () => performance.now(),
      reduce: () => app.motion.reduce(),
      hold: (on) => holdSnap('glide', on),
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
      scrollTo: (opts) => globalThis.scrollTo(opts),
      glide: app.glide,
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
        // U1, U2: the rail first, then the class, so the page never snaps without its rail.
        setSnap(L) {
          const html = root()
          if (!html) return
          if (!L || !app.dom.rail || !app.snapSupported()) {
            snapHolds.detent = false
            html.classList.remove('runway-snap')
            syncHold()
            return
          }
          syncSnapRail(app.dom.rail, snapPoints(L))
          html.classList.add('runway-snap')
          syncHold()
        },
        holdSnap: (on) => holdSnap('detent', on),
      },
      scrollToResume: (behavior) => scrollToResume(behavior),
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
    app.glide?.cancel?.()
    app.ctrl?.releaseSnap?.()
    app.os?.dispose?.()
    app.timers.clearAll?.()
    app.motion.dispose?.()
  }

  return app
}
