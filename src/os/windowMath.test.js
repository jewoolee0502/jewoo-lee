import { describe, it, expect } from 'vitest'
import { openRect, dragPosition, fitWindows } from './windowMath.js'

const DESK = { w: 900, h: 675 }

describe('openRect', () => {
  it('places a window at the default cascade origin', () => {
    expect(openRect({ w: 300, h: 200 }, DESK, 0)).toEqual({ x: 130, y: 46, w: 300, h: 200 })
  })

  it('offsets each cascade step by 30 px across and 26 px down', () => {
    expect(openRect({ w: 300, h: 200 }, DESK, 1)).toMatchObject({ x: 160, y: 72 })
  })

  it('caps the size at the desk minus margins (W-20, H-50)', () => {
    expect(openRect({ w: 2000, h: 2000 }, DESK, 0)).toMatchObject({ w: 880, h: 625 })
  })

  it('uses an explicit def.x and def.y, clamped to the desk', () => {
    expect(openRect({ w: 340, h: 250, x: 520, y: 50 }, DESK, 0)).toMatchObject({ x: 520, y: 50 })
  })

  it('clamps an explicit def.x so the window stays inside the right margin', () => {
    expect(openRect({ x: 800, w: 340 }, DESK, 0).x).toBe(552)
  })
})

describe('dragPosition', () => {
  const start = { l: 130, t: 46, x: 100, y: 100, s: 1 }
  const win = { w: 300, h: 200 }

  it('moves by the pointer delta when the scale is 1', () => {
    expect(dragPosition(start, 110, 105, 300, DESK)).toEqual({ left: 140, top: 51 })
  })

  it('moves by twice the delta when the scale is 0.5', () => {
    expect(dragPosition({ ...start, s: 0.5 }, 110, 105, 300, DESK)).toEqual({ left: 150, top: 56 })
  })

  it('clamps left to -winW+90 and W-90', () => {
    expect(dragPosition(start, -5000, 100, 300, DESK).left).toBe(-300 + 90)
    expect(dragPosition(start, 5000, 100, 300, DESK).left).toBe(900 - 90)
  })

  it('clamps top to 34 and H-34', () => {
    expect(dragPosition(start, 100, -5000, 300, DESK).top).toBe(34)
    expect(dragPosition(start, 100, 5000, 300, DESK).top).toBe(675 - 34)
  })

  it('uses the window width it is given for the left clamp', () => {
    expect(dragPosition(start, -5000, 100, win.w, DESK).left).toBe(-win.w + 90)
  })
})

describe('fitWindows', () => {
  it('pulls a window that is off the right edge back inside', () => {
    const wins = [{ id: 'a', x: 600, y: 50, w: 300, h: 200 }]
    const [fitted] = fitWindows(wins, { w: 700, h: 500 })
    expect(fitted.x).toBe(392)
  })

  it('returns the identical array when no record changes', () => {
    const wins = [{ id: 'a', x: 100, y: 60, w: 300, h: 200 }]
    expect(fitWindows(wins, { w: 900, h: 675 })).toBe(wins)
  })
})
