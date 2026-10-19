// WallpaperCanvas wiring: it registers the engine as app.wallpaperEngine (driven by the shared
// stage ticker, so it has no rAF of its own), follows the wallpaper store, and undoes everything
// on unmount, including under StrictMode's double mount (B5).
import { describe, it, expect, vi } from 'vitest'
import { StrictMode } from 'react'
import { act, render } from '@testing-library/react'
import { createApp } from '../app/createApp.js'
import { AppProvider } from '../app/AppContext.jsx'
import WallpaperCanvas from './WallpaperCanvas.jsx'

function mount({ strict = false, osState = 'on' } = {}) {
  const app = createApp()
  Object.defineProperty(app.os, 'state', { configurable: true, get: () => osState })
  const ui = (
    <AppProvider app={app}>
      <WallpaperCanvas />
    </AppProvider>
  )
  const result = render(strict ? <StrictMode>{ui}</StrictMode> : ui)
  const canvas = result.container.querySelector('canvas.wallpaper')
  return { app, canvas, ...result }
}

describe('WallpaperCanvas', () => {
  it('renders the labelled wallpaper canvas and registers its engine on the app', () => {
    const { app, canvas } = mount()
    expect(canvas).toHaveAttribute('aria-label', 'Animated pixel-art Montréal. Some things in the city are clickable.')
    expect(app.wallpaperEngine).not.toBeNull()
    expect(app.wallpaperEngine.canvas).toBe(canvas)
  })

  it('starts no animation frame loop of its own', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    mount()
    expect(raf).not.toHaveBeenCalled()
  })

  it('follows the wallpaper store (Display app and terminal `wallpaper` command)', () => {
    const { app } = mount()
    act(() => {
      app.wallpaper.setChoice('golden')
    })
    expect(app.wallpaperEngine.mode).toBe('golden')
    act(() => {
      app.wallpaper.setChoice('day')
    })
    expect(app.wallpaperEngine.mode).toBe('day')
  })

  it('unregisters and disposes the engine on unmount; a later tick draws nothing', () => {
    const { app, canvas, unmount } = mount()
    const engine = app.wallpaperEngine
    unmount()
    expect(app.wallpaperEngine).toBeNull()
    const ctx = canvas.getContext('2d')
    const before = ctx.calls.length
    engine.tick(5000)
    engine.setMode('day')
    expect(ctx.calls.length).toBe(before)
  })

  it('under StrictMode leaves exactly one live engine, bound to the rendered canvas', () => {
    const { app, canvas, unmount } = mount({ strict: true })
    const engine = app.wallpaperEngine
    expect(engine.canvas).toBe(canvas)
    engine.tick(1000)
    const drew = canvas.getContext('2d').calls.filter((c) => c[0] === 'drawImage').length
    expect(drew).toBeGreaterThan(0)
    unmount()
    expect(app.wallpaperEngine).toBeNull()
  })

  it('does not draw while the OS is not on', () => {
    const { app, canvas } = mount({ osState: 'standby' })
    app.wallpaperEngine.tick(1000)
    app.wallpaperEngine.tick(2000)
    expect(canvas.getContext('2d').calls.filter((c) => c[0] === 'drawImage')).toHaveLength(0)
  })

  // The engine skips idle frames while the camera is moving (isTweening). The camera moves while
  // the phase is 'dive' (z strictly between 0 and 1) or a programmatic glide runs; on the desk and
  // inside the wallpaper is not tweening.
  describe('isTweening follows the camera', () => {
    function settled() {
      const { app, canvas } = mount()
      app.wallpaperEngine.tick(1000)
      const drawn = () => canvas.getContext('2d').calls.filter((c) => c[0] === 'drawImage').length
      return { app, drawn }
    }

    it('on the desk the wallpaper keeps drawing its idle frames', () => {
      const { app, drawn } = settled()
      app.ctrl.store.set({ phase: 'desk' })
      const before = drawn()
      app.wallpaperEngine.tick(5000)
      expect(drawn()).toBeGreaterThan(before)
    })

    it('during the dive (phase dive) the engine treats the camera as tweening and draws nothing while idle', () => {
      const { app, drawn } = settled()
      app.ctrl.store.set({ phase: 'dive' })
      const before = drawn()
      app.wallpaperEngine.tick(5000)
      expect(drawn()).toBe(before)
    })

    it('during a programmatic glide the engine treats the camera as tweening', () => {
      const { app, drawn } = settled()
      Object.defineProperty(app.glide, 'active', { configurable: true, get: () => true })
      app.ctrl.store.set({ phase: 'desk' })
      const before = drawn()
      app.wallpaperEngine.tick(5000)
      expect(drawn()).toBe(before)
    })

    it('inside the laptop (phase inside) the camera is not tweening, so the wallpaper draws', () => {
      const { app, drawn } = settled()
      app.ctrl.store.set({ phase: 'inside', interactive: true })
      const before = drawn()
      app.wallpaperEngine.tick(5000)
      expect(drawn()).toBeGreaterThan(before)
    })
  })
})
