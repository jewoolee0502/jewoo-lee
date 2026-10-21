// Round 2 Phase 1 TEST LIST 13: scene/props.test.js. props.js is pure data (no three). The polaroid
// must clear the laptop lid, stay clear of the dog tags and the window, and hang in front of the wall.
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as PR from './props.js'
import { POLAROID, MUG, mugRadiusAt, handleEnds, handleBulgeX, faceAngle, HIT } from './props.js'
import { glowColor } from './sceneMath.js'

// handleEnds may return [x, y] pairs or {x, y} points; both are accepted here.
const pt = (p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : p)

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

  // R4-1: the open MacBook lid's top is lidOpenTop() ≈ 2.173 (was 2.45 for the old lid). The polaroid
  // does not move, so its bottom (3.05 − 0.38 · 1.2 = 2.594) clears the lid by 0.3.
  it('its bottom edge clears the open lid top by 0.3 (lidOpenTop() + 0.3) and stays on the wall (<= 3.0)', async () => {
    // Loaded here, not at the top, so a missing laptop.js fails only this test (R4-1).
    const { lidOpenTop } = await vi.importActual('./laptop.js')
    const bottom = POLAROID.pos[1] - (POLAROID.card[1] / 2) * POLAROID.scale
    expect(bottom).toBeGreaterThanOrEqual(lidOpenTop() + 0.3)
    expect(bottom).toBeLessThanOrEqual(3.0)
    expect(bottom).toBeCloseTo(2.594, 3)
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

// Round 2 Phase 4 TEST LIST 1 (R16, mug handle and facing; drive slot on the front face).
describe('scene/props McGill mug and drive slot', () => {
  it('the wall radius runs from rBot at the base to rTop at the rim', () => {
    expect(mugRadiusAt(0)).toBeCloseTo(0.17, 10)
    expect(mugRadiusAt(MUG.h)).toBeCloseTo(0.19, 10)
  })

  it('both handle ends are attached to the wall (within tube + 0.01 of the wall radius at their height)', () => {
    for (const end of handleEnds(MUG.handle).map(pt)) {
      expect(Math.abs(end.x - mugRadiusAt(end.y))).toBeLessThanOrEqual(MUG.handle.tube + 0.01)
    }
  })

  it('the handle ends are at least 0.18 apart vertically and inside [0.05, h - 0.05]', () => {
    const [a, b] = handleEnds(MUG.handle).map(pt)
    expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(0.18)
    for (const end of [a, b]) {
      expect(end.y).toBeGreaterThanOrEqual(0.05)
      expect(end.y).toBeLessThanOrEqual(MUG.h - 0.05)
    }
  })

  it('the handle bulges out to +x by at least 0.08 past the wall at its centre height (a C on the right)', () => {
    expect(handleBulgeX(MUG.handle)).toBeGreaterThanOrEqual(mugRadiusAt(MUG.handle.center[1]) + 0.08)
  })

  it('faceAngle turns the mug to the wide camera: (-2.3, 0.85) to (1.4, 10.2) is about 0.377 rad', () => {
    expect(faceAngle({ x: -2.3, z: 0.85 }, { x: 1.4, z: 10.2 })).toBeCloseTo(0.377, 3)
  })

  it('faceAngle is 0 for a target straight along +z, and pi/2 for a target straight along +x', () => {
    expect(faceAngle({ x: 0, z: 0 }, { x: 0, z: 1 })).toBe(0)
    expect(faceAngle({ x: 0, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(Math.PI / 2, 10)
  })

  // R4-3 (M20): the floppy slot moved to the right face, so its numbers are in laptop.js
  // (laptop.test.js, "side floppy slot"). props.js no longer exports it.
  it('props.js no longer exports SLOT (the drive slot is laptop.js SLOT on the right face)', () => {
    expect(PR).not.toHaveProperty('SLOT')
  })
})

// Round 2 §7 6C TEST LIST item 1 (U15, U16): a softer mug glow, and invisible hit boxes that cover the
// dog tags and floppies. HIT boxes are group-local: [x, y, z] centre and [w, h, d] size.
describe('scene/props hover glow and hit proxies (plan §7 6C)', () => {
  const lo = ({ pos, size }) => pos.map((p, i) => p - size[i] / 2)
  const hi = ({ pos, size }) => pos.map((p, i) => p + size[i] / 2)

  // R4-2 (M11): the power button is Touch ID, so HIT gains a touchId box for its key cell.
  it('HIT has a tags box, a floppy box and a Touch ID box', () => {
    expect(Object.keys(HIT).sort()).toEqual(['floppy', 'tags', 'touchId'])
  })

  it('the Touch ID box is HIT.touchId: size [0.24, 0.05, 0.22] at [0, 0.01, 0] in its group', () => {
    expect(HIT.touchId).toEqual({ size: [0.24, 0.05, 0.22], pos: [0, 0.01, 0] })
  })

  it('the Touch ID box covers the Touch ID cell in x and z (its footprint is the cell plus a margin)', async () => {
    const LP = await vi.importActual('./laptop.js')
    const cell = LP.keyboardLayout().find((k) => k.touchId)
    expect(HIT.touchId.size[0]).toBeGreaterThanOrEqual(cell.w)
    expect(HIT.touchId.size[2]).toBeGreaterThanOrEqual(cell.d)
  })

  it('the mug glow is softer than the old 0.35 and below 0.2 (U15)', () => {
    expect(MUG.glow).toBeLessThan(0.2)
  })

  it('the mug glow keeps every channel of the red at or below 0.1', () => {
    expect(Math.max(...glowColor(MUG.color, MUG.glow))).toBeLessThanOrEqual(0.1)
  })

  it('the tags box covers both plates with a 0.05 margin in x, the chain and the ring top', () => {
    const [min, max] = [lo(HIT.tags), hi(HIT.tags)]
    expect(min[0]).toBeLessThanOrEqual(-0.085 - 0.05)
    expect(max[0]).toBeGreaterThanOrEqual(0.125 + 0.05)
    expect(min[1]).toBeLessThanOrEqual(-0.82)
    expect(max[1]).toBeGreaterThanOrEqual(0.06)
  })

  it('the tags box back face is in front of the wall: tags z -2.92 + pos z - size z / 2 is above -3', () => {
    expect(-2.92 + HIT.tags.pos[2] - HIT.tags.size[2] / 2).toBeGreaterThan(-3)
  })

  it('the floppy box is at least 0.06 wider and 0.06 deeper than the 0.5 x 0.52 floppy', () => {
    expect(HIT.floppy.size[0]).toBeGreaterThanOrEqual(0.5 + 0.06)
    expect(HIT.floppy.size[2]).toBeGreaterThanOrEqual(0.52 + 0.06)
  })

  it('the floppy box is thicker than the floppy but not the whole stack (0.06 to 0.08)', () => {
    expect(HIT.floppy.size[1]).toBeGreaterThanOrEqual(0.06)
    expect(HIT.floppy.size[1]).toBeLessThanOrEqual(0.08)
  })

  it('the floppy box covers the floppy plate in y (-0.015 to 0.015 about its origin)', () => {
    expect(lo(HIT.floppy)[1]).toBeLessThanOrEqual(-0.015)
    expect(hi(HIT.floppy)[1]).toBeGreaterThanOrEqual(0.015)
  })
})
