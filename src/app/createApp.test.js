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

  it('gains the OS host and controller (phase 2), wired to each other', () => {
    const app = createApp()

    expect(app.host.osEl.id).toBe('os')
    expect(app.os.store.get().state).toBe('standby')
    expect(app.os.size()).toEqual({ w: 900, h: 675 })
    app.dispose()
  })
})
