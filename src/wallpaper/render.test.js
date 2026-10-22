// Phase 5 TEST LIST: wallpaper/render.test.js (fake ctx from src/test/fakeCanvas.js, fixed rand).
// drawFrame(g, state, L, mode, W, dt, T, rand) returns the hot list (L540–573, L583–590 hit test).
import { describe, it, expect } from 'vitest'
import { buildLayout } from './layout.js'
import { drawFrame, hitTest } from './render.js'

const W = 240
const rand = () => 0.5

function freshState(over = {}) {
  return {
    wheelA: 0,
    wheelV: 0.35,
    cross: 0,
    bagel: false,
    shades: false,
    boatX: 30,
    boatV: 5,
    rac: { x: 40, dir: 1, run: false, away: 0 },
    off: {},
    flick: 0,
    ...over,
  }
}

const ctx = () => document.createElement('canvas').getContext('2d')
const kinds = (hot) => new Set(hot.map((h) => h.k))

describe('drawFrame hot list per mode', () => {
  it('night: moon, cross, wheel, boat and raccoon, one bld per building, and no sun', () => {
    const L = buildLayout(W)
    const hot = drawFrame(ctx(), freshState(), L, 'night', W, 0.016, 1, rand)
    const k = kinds(hot)
    for (const name of ['moon', 'cross', 'wheel', 'boat', 'raccoon']) expect(k.has(name)).toBe(true)
    expect(k.has('sun')).toBe(false)
    const blds = hot.filter((h) => h.k === 'bld')
    expect(blds).toHaveLength(L.blds.length)
    expect(blds.map((h) => h.i)).toEqual(L.blds.map((_, i) => i))
  })

  it('day: sun and no bld and no moon', () => {
    const L = buildLayout(W)
    const hot = drawFrame(ctx(), freshState(), L, 'day', W, 0.016, 1, rand)
    const k = kinds(hot)
    expect(k.has('sun')).toBe(true)
    expect(k.has('bld')).toBe(false)
    expect(k.has('moon')).toBe(false)
  })

  it('golden: bld and neither sun nor moon', () => {
    const L = buildLayout(W)
    const hot = drawFrame(ctx(), freshState(), L, 'golden', W, 0.016, 1, rand)
    const k = kinds(hot)
    expect(k.has('bld')).toBe(true)
    expect(k.has('sun')).toBe(false)
    expect(k.has('moon')).toBe(false)
  })
})

describe('hitTest order', () => {
  // Boxes from the prototype formulas (L583–590), listed in push order as drawFrame does.
  const hot = [
    { k: 'moon', x: 170, y: 16, w: 17, h: 17 },
    { k: 'cross', x: 66, y: 64, w: 13, h: 17 },
    { k: 'bld', i: 0, x: 60, y: 60, w: 20, h: 80 },
    { k: 'wheel', x: 36, y: 88, w: 48, h: 48 },
    { k: 'boat', x: 28, y: 147, w: 18, h: 10 },
    { k: 'raccoon', x: 37, y: 131, w: 16, h: 11 },
  ]

  it('returns the building when a point is inside both the cross box and a building box', () => {
    expect(hitTest(hot, { x: 70, y: 70 })).toMatchObject({ k: 'bld', i: 0 })
  })

  it('returns the raccoon for a point inside the raccoon and wheel boxes', () => {
    expect(hitTest(hot, { x: 40, y: 135 })).toMatchObject({ k: 'raccoon' })
  })

  it('returns the raccoon for a point inside the raccoon and boat boxes', () => {
    const overlap = [
      { k: 'boat', x: 28, y: 147, w: 18, h: 10 },
      { k: 'raccoon', x: 28, y: 145, w: 16, h: 11 },
    ]
    expect(hitTest(overlap, { x: 30, y: 149 })).toMatchObject({ k: 'raccoon' })
  })

  it('returns nothing for a point outside every box', () => {
    expect(hitTest(hot, { x: 200, y: 120 })).toBeFalsy()
  })
})

describe('raccoon and wheel state', () => {
  it('a running raccoon that leaves the screen is not hot and sets away to 14', () => {
    const L = buildLayout(W)
    const state = freshState({ rac: { x: W + 5, dir: 1, run: true, away: 0 } })
    const hot = drawFrame(ctx(), state, L, 'night', W, 0.016, 1, rand)
    expect(hot.some((h) => h.k === 'raccoon')).toBe(false)
    expect(state.rac.away).toBe(14)
  })

  it('wheelV decays toward .35 with the prototype formula', () => {
    const L = buildLayout(W)
    const state = freshState({ wheelV: 4 })
    drawFrame(ctx(), state, L, 'night', W, 1, 1, rand)
    // wheelV += (.35 - wheelV) * min(1, dt * .6), with dt = 1
    expect(state.wheelV).toBeCloseTo(4 + (0.35 - 4) * 0.6, 10)
    for (let i = 0; i < 200; i++) drawFrame(ctx(), state, L, 'night', W, 1, 1, rand)
    expect(state.wheelV).toBeCloseTo(0.35, 3)
  })
})
