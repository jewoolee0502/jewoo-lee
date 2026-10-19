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
})
