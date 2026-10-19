import { describe, it, expect, vi } from 'vitest'
import { createApp } from './createApp.js'

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
})
