// Round 2 Phase 1 TEST LIST 13: scene/props.test.js. props.js is pure data (no three). The polaroid
// must clear the laptop lid, stay clear of the dog tags and the window, and hang in front of the wall.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { POLAROID } from './props.js'

describe('scene/props POLAROID', () => {
  it('has the shape the scene builds from (pos, rotZ, scale, card, photo, photoY, tape)', () => {
    expect(POLAROID.pos).toEqual([1.6, 3.05, -2.975])
    expect(POLAROID.rotZ).toBe(-0.06)
    expect(POLAROID.scale).toBe(1.2)
    expect(POLAROID.card).toEqual([0.64, 0.76, 0.012])
    expect(POLAROID.photo).toEqual([0.54, 0.58])
    expect(POLAROID.photoY).toBe(0.06)
    expect(POLAROID.tape).toEqual({
      size: [0.3, 0.08, 0.004],
      pos: [0, 0.38, 0.012],
      rotZ: 0.08,
      color: 0xffd15c,
      opacity: 0.85,
    })
  })

  it('its bottom edge clears the lid top (>= 2.45) and stays on the wall (<= 3.0)', () => {
    const bottom = POLAROID.pos[1] - (POLAROID.card[1] / 2) * POLAROID.scale
    expect(bottom).toBeGreaterThanOrEqual(2.45)
    expect(bottom).toBeLessThanOrEqual(3.0)
  })

  it('its x range lies within [0.9, 2.4]: clear of the dog tags (-1.6) and the window (x <= -2.25)', () => {
    const half = (POLAROID.card[0] / 2) * POLAROID.scale
    const left = POLAROID.pos[0] - half
    const right = POLAROID.pos[0] + half
    expect(left).toBeGreaterThanOrEqual(0.9)
    expect(right).toBeLessThanOrEqual(2.4)
  })

  it('pos z is in front of the wall at z = -3 (between -2.99 and -2.95)', () => {
    expect(POLAROID.pos[2]).toBeGreaterThan(-2.99)
    expect(POLAROID.pos[2]).toBeLessThan(-2.95)
  })

  it('props.js imports nothing from three (pure data)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/scene/props.js'), 'utf8')
    expect(src).not.toMatch(/from\s+['"]three/)
    expect(src).not.toMatch(/require\(\s*['"]three/)
  })
})
