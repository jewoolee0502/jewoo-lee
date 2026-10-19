// Phase 5 TEST LIST: wallpaper/engine.test.js. Fake canvas (recording ctx), injected clock via
// tick(now), injected OS state, tweening, reduce and size. The throttle, gating and debounce
// rules come from L596–602: skip when hidden, when the OS is not 'on', when tweening and not
// dirty, when reduce and not dirty, or when now - lastDraw < 70 and not dirty.
import { describe, it, expect, vi } from 'vitest'
import { createWallpaperEngine } from './engine.js'

function make(over = {}) {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({
    left: 0, top: 0, x: 0, y: 0, width: 240, height: 180, right: 240, bottom: 180,
  })
  const env = { size: { w: 900, h: 675 }, state: 'on', tweening: false, reduce: false }
  const snd = { tone: vi.fn() }
  const tracker = { found: vi.fn() }
  const engine = createWallpaperEngine({
    canvas,
    getOsSize: () => env.size,
    getOsState: () => env.state,
    isTweening: () => env.tweening,
    reduce: () => env.reduce,
    snd,
    tracker,
    ...over,
  })
  // Every frame draws the static layer with drawImage on the main context (L540).
  const draws = () => canvas.getContext('2d').calls.filter((c) => c[0] === 'drawImage').length
  return { engine, canvas, env, snd, tracker, draws }
}

// Screen position of the moon at W 240 (mx = round(240 * .74) = 178, my = 24), L564.
const MOON = { clientX: 178, clientY: 24 }

describe('engine gating', () => {
  it('draws nothing while the OS is booting or off', () => {
    const { engine, env, draws } = make()
    env.state = 'boot'
    engine.tick(1000)
    engine.tick(1200)
    expect(draws()).toBe(0)
    env.state = 'off'
    engine.tick(1400)
    expect(draws()).toBe(0)
  })

  it('draws nothing while the document is hidden', () => {
    const { engine, draws } = make()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    try {
      engine.tick(1000)
      expect(draws()).toBe(0)
    } finally {
      delete document.hidden
    }
  })

  it('draws on the first tick when the OS is on, and throttles idle frames to 70 ms', () => {
    const { engine, draws } = make()
    engine.tick(1000)
    const first = draws()
    expect(first).toBeGreaterThan(0)
    engine.tick(1030)
    expect(draws()).toBe(first)
    engine.tick(1080)
    expect(draws()).toBeGreaterThan(first)
  })

  it('while tweening and not dirty, draws nothing; a click on the moon makes it dirty and draws', () => {
    const { engine, env, snd, tracker, draws } = make()
    engine.tick(1000)
    env.tweening = true
    const idle = draws()
    engine.tick(1100)
    expect(draws()).toBe(idle)
    engine.click(MOON)
    expect(tracker.found).toHaveBeenCalledWith('moon')
    expect(snd.tone).toHaveBeenCalledWith(660, 0.05, 'square', 0.04)
    engine.tick(1110)
    expect(draws()).toBeGreaterThan(idle)
  })

  it('with reduced motion, draws only when dirty', () => {
    const { engine, env, draws } = make()
    env.reduce = true
    engine.tick(1000)
    const first = draws()
    expect(first).toBeGreaterThan(0)
    engine.tick(1200)
    engine.tick(2000)
    expect(draws()).toBe(first)
    engine.click(MOON)
    engine.tick(2100)
    expect(draws()).toBeGreaterThan(first)
  })
})

describe('engine resize and mode', () => {
  it('rebuilds at the new width only after the size has been stable for 200 ms', () => {
    const { engine, env, canvas } = make()
    engine.tick(1000)
    expect(canvas.width).toBe(240)
    env.size = { w: 1200, h: 675 } // clampWidth gives 320
    engine.tick(1100)
    expect(canvas.width).toBe(240)
    engine.tick(1180)
    expect(canvas.width).toBe(240)
    engine.tick(1320)
    expect(canvas.width).toBe(320)
  })

  it('setMode redraws immediately, without waiting for a tick', () => {
    const { engine, draws } = make()
    engine.tick(1000)
    const before = draws()
    engine.setMode('golden')
    expect(draws()).toBeGreaterThan(before)
  })

  // B4: never rebuild during a camera tween, and a size that bounces back cancels the rebuild.
  it('waits for the camera tween to end before applying a new width', () => {
    const { engine, env, canvas } = make()
    engine.tick(1000)
    env.tweening = true
    env.size = { w: 1200, h: 675 }
    engine.tick(1100)
    engine.tick(1400)
    engine.tick(1700)
    expect(canvas.width).toBe(240)
    env.tweening = false
    engine.tick(1800)
    expect(canvas.width).toBe(320)
  })

  it('cancels a pending rebuild when the size returns to the current width', () => {
    const { engine, env, canvas } = make()
    engine.tick(1000)
    env.size = { w: 1200, h: 675 }
    engine.tick(1100)
    env.size = { w: 900, h: 675 }
    engine.tick(1200)
    env.size = { w: 1200, h: 675 }
    engine.tick(1320)
    expect(canvas.width).toBe(240)
    engine.tick(1530)
    expect(canvas.width).toBe(320)
  })

  it('applies a resize under reduced motion too (a rebuild counts as a change)', () => {
    const { engine, env, canvas, draws } = make()
    env.reduce = true
    engine.tick(1000)
    env.size = { w: 1200, h: 675 }
    engine.tick(1100)
    const before = draws()
    engine.tick(1400)
    expect(canvas.width).toBe(320)
    expect(draws()).toBeGreaterThan(before)
  })
})
