import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApp } from './createApp.js'
import { runwayLayout, snapPoints } from '../stage/runway.js'

describe('createApp', () => {
  it('returns motion, toasts, snd, ach and wallpaper', () => {
    const app = createApp()

    for (const key of ['motion', 'toasts', 'snd', 'ach', 'wallpaper']) {
      expect(app[key], key).toBeDefined()
    }
  })

  it('an overrides object replaces a field', () => {
    const fakeToasts = { toast: vi.fn(), store: null }

    const app = createApp({ toasts: fakeToasts })

    expect(app.toasts).toBe(fakeToasts)
  })

  it('has no wall store and no Paint or Visitor Wall state (round 2 Phase 1)', () => {
    const app = createApp()

    expect(app).not.toHaveProperty('wall')
    expect(app.os.store.get()).not.toHaveProperty('art')
    app.dispose()
  })

  it('gains the OS host and controller (phase 2), wired to each other', () => {
    const app = createApp()

    expect(app.host.osEl.id).toBe('os')
    expect(app.os.store.get().state).toBe('standby')
    expect(app.os.size()).toEqual({ w: 900, h: 675 })
    app.dispose()
  })

  it('gains the scroll glide (round 2 Phase 2): to, cancel and onScroll', () => {
    const app = createApp()

    expect(typeof app.glide.to).toBe('function')
    expect(typeof app.glide.cancel).toBe('function')
    expect(typeof app.glide.onScroll).toBe('function')
    app.dispose()
  })

  it('with no scene, the controller marks the track flat-runway on its first update (no runway in the fallback)', () => {
    const app = createApp()
    app.dom.track = document.createElement('section')
    app.scene.setStatus('unavailable')

    app.ctrl.update(0)

    expect(app.dom.track.classList.contains('flat-runway')).toBe(true)
    app.dispose()
  })

  // Round 3 TEST LIST 6 (HUD): ui.setHud marks the stage .hud-dim while the HUD is faded below half
  // (--hud < .5), so the CSS can stop its clicks; .hud-off stays at zero. Driven through the real
  // controller: a sweep of scroll positions over a ready scene, checked against --hud.
  it('the stage carries hud-dim exactly while --hud is below .5 (and hud-off at zero)', () => {
    const app = createApp()
    const stage = document.createElement('div')
    Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 1000 })
    let top = 0
    app.dom.stage = stage
    app.dom.track = {
      getBoundingClientRect: () => ({ top: -top, height: 2900, bottom: 0, left: 0, right: 0, width: 0 }),
    }
    app.scene.setStatus('ready')

    let sawDim = false
    for (let s = 0; s <= 2900; s += 50) {
      top = s
      app.ctrl.update(0)
      const raw = stage.style.getPropertyValue('--hud')
      const v = raw === '' ? 1 : Number(raw)
      expect(stage.classList.contains('hud-dim'), `hud-dim at scroll ${s} (--hud ${raw || 1})`).toBe(v < 0.5)
      if (v < 0.5) sawDim = true
      if (v === 0) expect(stage.classList.contains('hud-off')).toBe(true)
    }
    expect(sawDim, 'the sweep reached a faded HUD').toBe(true)
    app.dispose()
  })

  // Phase 6A (plan-r2 section 7, U1–U3): the snap rail is synced from the controller's ready frame, and the
  // classes on <html> follow snap support (CSS.supports) and the glide's holds.
  describe('snap rail and snap classes (phase 6A)', () => {
    afterEach(() => {
      document.documentElement.classList.remove('runway-snap', 'snap-hold')
    })

    function readyApp(overrides = {}) {
      const app = createApp(overrides)
      const stage = document.createElement('div')
      Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 1000 })
      app.dom.stage = stage
      app.dom.track = {
        getBoundingClientRect: () => ({ top: 0, height: 2900, bottom: 2900, left: 0, right: 0, width: 0 }),
      }
      app.dom.rail = document.createElement('div')
      app.scene.setStatus('ready')
      return app
    }

    it('dom gains a rail slot, null until the stage mounts it', () => {
      const app = createApp()
      expect(app.dom).toHaveProperty('rail', null)
      app.dispose()
    })

    it('with snap support, a ready frame adds runway-snap to <html> and fills the rail: the stop plus one marker per point', () => {
      const app = readyApp({ snapSupported: () => true })
      app.ctrl.update(0)
      const L = runwayLayout({ trackH: 2900, stageH: 1000 })
      expect(document.documentElement.classList.contains('runway-snap')).toBe(true)
      expect(app.dom.rail.children).toHaveLength(snapPoints(L).points.length + 1)
      expect(app.dom.rail.children[0]).toHaveClass('stop')
      expect(app.dom.rail.children[0].style.top).toBe('1000px')
      app.dispose()
    })

    it('without CSS.supports (jsdom), the page never snaps: no runway-snap class and no markers', () => {
      const app = readyApp()
      app.ctrl.update(0)
      expect(document.documentElement.classList.contains('runway-snap')).toBe(false)
      expect(app.dom.rail.children).toHaveLength(0)
      app.dispose()
    })

    it('releaseSnap() removes runway-snap and snap-hold from <html>', () => {
      const app = readyApp({ snapSupported: () => true })
      app.ctrl.update(0)
      document.documentElement.classList.add('snap-hold')
      app.ctrl.releaseSnap()
      expect(document.documentElement.classList.contains('runway-snap')).toBe(false)
      expect(document.documentElement.classList.contains('snap-hold')).toBe(false)
      app.dispose()
    })

    it('a detent hold (ui.holdSnap) keeps snap-hold on through a glide write until it is released', () => {
      const app = readyApp({ snapSupported: () => true })
      app.ctrl.update(0)
      vi.spyOn(globalThis, 'scrollTo').mockImplementation(() => {})
      const root = document.documentElement.classList
      app.ctrl.onWheel({ deltaY: 1200, deltaMode: 0, timeStamp: 0 })
      expect(root.contains('snap-hold')).toBe(true)
      app.ctrl.settle({ dir: 1, travel: 0 })
      expect(root.contains('snap-hold')).toBe(false)
      vi.restoreAllMocks()
      app.dispose()
    })

    it('the glide holds the snap: hold(true) adds snap-hold to <html> during its write, hold(false) removes it', () => {
      const app = createApp()
      const seen = []
      vi.spyOn(globalThis, 'scrollTo').mockImplementation(() => {
        seen.push(document.documentElement.classList.contains('snap-hold'))
      })
      app.glide.jump(640)
      expect(seen).toEqual([true])
      expect(document.documentElement.classList.contains('snap-hold')).toBe(false)
      vi.restoreAllMocks()
      app.dispose()
    })

    // Phase 6A TEST LIST (dispose releases the snap): tearing the app down leaves no snap on <html>.
    it('app.dispose() calls ctrl.releaseSnap and leaves no runway-snap or snap-hold on <html>', () => {
      const app = readyApp({ snapSupported: () => true })
      app.ctrl.update(0)
      const spy = vi.spyOn(app.ctrl, 'releaseSnap')
      document.documentElement.classList.add('snap-hold')
      app.dispose()
      expect(spy).toHaveBeenCalled()
      expect(document.documentElement.classList.contains('runway-snap')).toBe(false)
      expect(document.documentElement.classList.contains('snap-hold')).toBe(false)
    })

    // Phase 6A TEST LIST (snap holds consistent): snap-hold on <html> always equals (glide hold || detent hold),
    // including after the rail is cleared (setSnap(null)) or re-synced (setSnap(L)).
    it('a glide hold survives setSnap(null) and setSnap(L): snap-hold stays on until the glide releases', () => {
      const app = readyApp({ snapSupported: () => true })
      vi.spyOn(globalThis, 'scrollTo').mockImplementation(() => {})
      const root = document.documentElement.classList
      app.glide.to(2000)
      expect(root.contains('snap-hold')).toBe(true)
      app.ctrl.releaseSnap()
      expect(root.contains('snap-hold'), 'after setSnap(null)').toBe(true)
      app.ctrl.update(0)
      expect(root.contains('runway-snap')).toBe(true)
      expect(root.contains('snap-hold'), 'after setSnap(L)').toBe(true)
      app.glide.cancel()
      expect(root.contains('snap-hold'), 'after the glide releases').toBe(false)
      vi.restoreAllMocks()
      app.dispose()
    })

    it('a detent hold does not outlive releaseSnap: snap-hold is off after the release, and stays off on the next glide write', () => {
      const app = readyApp({ snapSupported: () => true })
      app.ctrl.update(0)
      vi.spyOn(globalThis, 'scrollTo').mockImplementation(() => {})
      const root = document.documentElement.classList
      app.ctrl.onWheel({ deltaY: 1200, deltaMode: 0, timeStamp: 0 })
      expect(root.contains('snap-hold')).toBe(true)
      app.ctrl.releaseSnap()
      expect(root.contains('snap-hold'), 'after releaseSnap').toBe(false)
      app.glide.jump(640)
      expect(root.contains('snap-hold'), 'after a later glide write').toBe(false)
      vi.restoreAllMocks()
      app.dispose()
    })
  })
})
