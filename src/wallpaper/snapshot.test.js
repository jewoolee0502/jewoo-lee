// Phase 5 TEST LIST: wallpaper/snapshot.test.js. snapshot(modeKey) builds its own layout at W 240,
// draws onto a new canvas and returns toDataURL. It never touches a live engine (fixes L603–605).
// The module keeps a per-key cache (B14), so each test loads a fresh copy of the module.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWallpaperEngine } from './engine.js'

let snapshot

beforeEach(async () => {
  vi.resetModules()
  ;({ snapshot } = await import('./snapshot.js'))
})

describe('snapshot', () => {
  it('returns the PNG data URL of the mode', () => {
    expect(snapshot('night')).toBe('data:image/png;base64,TEST')
  })

  it('caches per mode key: a second call does not create another canvas', () => {
    const spy = vi.spyOn(document, 'createElement')
    snapshot('night')
    const afterFirst = spy.mock.calls.filter(([tag]) => tag === 'canvas').length
    expect(afterFirst).toBeGreaterThan(0)
    snapshot('night')
    expect(spy.mock.calls.filter(([tag]) => tag === 'canvas').length).toBe(afterFirst)
  })

  it('does not change an existing engine layout: the engine stays at width 320', () => {
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: 320, height: 180, right: 320, bottom: 180 })
    const env = { size: { w: 900, h: 675 } }
    const engine = createWallpaperEngine({
      canvas,
      getOsSize: () => env.size,
      getOsState: () => 'on',
      isTweening: () => false,
      reduce: () => false,
      snd: { tone: vi.fn() },
      tracker: { found: vi.fn() },
    })
    engine.tick(1000)
    env.size = { w: 1200, h: 675 }
    engine.tick(1100)
    engine.tick(1180)
    engine.tick(1320)
    expect(canvas.width).toBe(320)

    const before = canvas.getContext('2d').calls.length
    snapshot('golden')
    expect(canvas.width).toBe(320)
    expect(canvas.getContext('2d').calls.length).toBe(before)
    engine.tick(1400)
    expect(canvas.width).toBe(320)
  })
})
