import { describe, it, expect, vi } from 'vitest'
import { createApp } from './createApp.js'
import { setReducedMotion } from '../test/setup.js'
import { OS_W, OS_H } from '../core/constants.js'

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
    expect(app.os.size()).toEqual({ w: 1040, h: 676 })
    expect(app.os.size()).toEqual({ w: OS_W, h: OS_H })
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
      getBoundingClientRect: () => ({ top: -top, height: 2120, bottom: 0, left: 0, right: 0, width: 0 }),
    }
    app.scene.setStatus('ready')

    let sawDim = false
    for (let s = 0; s <= 2120; s += 10) {
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

  // Round 3 Phase R3-1 (plan-r3 V4): the snap rail is gone from the app, and the glide never touches the
  // classes on <html> (nothing snaps the page, so there is no hold to set).
  it('app.dom has no rail slot', () => {
    const app = createApp()
    expect(app.dom).not.toHaveProperty('rail')
    app.dispose()
  })

  it('the glide adds no class to <html> on to(), jump() or cancel()', () => {
    const app = createApp()
    vi.spyOn(globalThis, 'scrollTo').mockImplementation(() => {})
    const before = document.documentElement.className
    app.glide.to(1000)
    expect(document.documentElement.className).toBe(before)
    app.glide.jump(640)
    expect(document.documentElement.className).toBe(before)
    app.glide.cancel()
    expect(document.documentElement.className).toBe(before)
    vi.restoreAllMocks()
    app.dispose()
  })

  // Round 3 Phase R3-2 (plan-r3 §3, V8, V11): the two views and the navigation over them.
  describe('views and nav (R3-2)', () => {
    // A stand-in for app.views: the nav calls it by name, and get() decides which view it is in.
    function fakeViews(view = 'laptop') {
      return {
        get: vi.fn(() => view),
        toResume: vi.fn(),
        toLaptop: vi.fn(),
        dispose: vi.fn(),
      }
    }

    it('app.views is the laptop view before any init, and the page has no data-view yet', () => {
      const app = createApp()
      expect(app.views.get()).toBe('laptop')
      expect(document.documentElement.hasAttribute('data-view')).toBe(false)
      app.dispose()
    })

    it('nav.goToResume passes its options (the opener) on to views.toResume', () => {
      const views = fakeViews()
      const app = createApp({ views })
      const opener = document.createElement('button')
      app.nav.goToResume({ opener })
      expect(views.toResume).toHaveBeenCalledTimes(1)
      expect(views.toResume).toHaveBeenCalledWith({ opener })
      app.dispose()
    })

    it('nav.openLaptop enters the laptop (ctrl.enter) from the laptop view', () => {
      const views = fakeViews('laptop')
      const app = createApp({ views })
      const enter = vi.spyOn(app.ctrl, 'enter')
      app.nav.openLaptop()
      expect(enter).toHaveBeenCalledTimes(1)
      expect(views.toLaptop).not.toHaveBeenCalled()
      app.dispose()
    })

    it('nav.openLaptop from the résumé view returns to the laptop, open, through views.toLaptop', () => {
      const views = fakeViews('resume')
      const app = createApp({ views })
      const enter = vi.spyOn(app.ctrl, 'enter')
      app.nav.openLaptop()
      expect(views.toLaptop).toHaveBeenCalledTimes(1)
      expect(views.toLaptop).toHaveBeenCalledWith({ place: 'open' })
      expect(enter).not.toHaveBeenCalled()
      app.dispose()
    })

    it('nav.backToLaptop goes through views.toLaptop with no place', () => {
      const views = fakeViews('resume')
      const app = createApp({ views })
      app.nav.backToLaptop()
      expect(views.toLaptop).toHaveBeenCalledTimes(1)
      expect(views.toLaptop.mock.calls[0]).toEqual([])
      app.dispose()
    })

    it('dispose tears down the views', () => {
      const views = fakeViews()
      const app = createApp({ views })
      app.dispose()
      expect(views.dispose).toHaveBeenCalledTimes(1)
    })

    // The OS windows are display:none while the résumé shows, which drops their scroll offsets.
    it('a round trip through the résumé view keeps the OS window and terminal scroll offsets', () => {
      setReducedMotion(true)
      vi.spyOn(window.history, 'back').mockImplementation(() => {})
      const app = createApp()
      const wb = document.createElement('div')
      wb.className = 'wb'
      const out = document.createElement('div')
      out.className = 't-out'
      app.host.osEl.append(wb, out)
      document.body.appendChild(app.host.osEl)
      wb.scrollTop = 300
      out.scrollTop = 40
      app.nav.goToResume()
      expect(document.documentElement.getAttribute('data-view')).toBe('resume')
      // What the browser does to a display:none subtree.
      wb.scrollTop = 0
      out.scrollTop = 0
      app.nav.backToLaptop()
      expect(document.documentElement.getAttribute('data-view')).toBe('laptop')
      expect(wb.scrollTop).toBe(300)
      expect(out.scrollTop).toBe(40)
      app.host.osEl.remove()
      vi.restoreAllMocks()
      app.dispose()
    })

    it('the real views close the Recruiter view and the ◆ menu when they leave the laptop', () => {
      setReducedMotion(true)
      const app = createApp()
      app.ui.store.set({ recOpen: true })
      const setMenu = vi.spyOn(app.os, 'setMenu')
      app.views.toResume()
      expect(app.ui.store.get().recOpen).toBe(false)
      expect(setMenu).toHaveBeenCalledWith(false)
      expect(document.documentElement.getAttribute('data-view')).toBe('resume')
      app.dispose()
    })
  })
})
