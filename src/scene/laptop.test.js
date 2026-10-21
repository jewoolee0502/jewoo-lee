// Round 4 Phase R4-1 TEST LIST: scene/laptop.test.js. laptop.js is pure data and helpers (no three),
// so the MacBook Air proportions and the 20:13 screen are checked as numbers, as props.test does.
// The contracts (plan-r4 §1.1): SCREEN {unit, w, h, cy, mirror: [w, h], cornerPx}, with lid-local cy;
// LID {w, h, t, r, bevel, chin, top, side}; BASE {pos (rig), w, d, h, lift, r, bevel, deckY};
// HINGE {y, z, barrel: {r, length, pos}}, base-local; lidOpenTop() is the open lid's top y;
// extrudeSpec(w, d, h, r, bevel) is the rounded-rect shape {w, d, depth, r} whose bevelled extrude
// is exactly w × d × h.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OS_W, OS_H } from '../core/constants.js'
import { SCREEN, LID, BASE, HINGE, lidOpenTop, extrudeSpec } from './laptop.js'

const DEG = Math.PI / 180

describe('scene/laptop (R4-1 geometry module)', () => {
  it('(a) imports nothing from three: it reads like props.js, as pure data', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/scene/laptop.js'), 'utf8')
    expect(src).not.toMatch(/from\s+['"]three/)
    expect(src).not.toMatch(/require\(\s*['"]three/)
  })

  it('(b) the OS logical size is 1040 × 676, the 2560 × 1664 Air panel at 20:13', () => {
    expect(OS_W).toBe(1040)
    expect(OS_H).toBe(676)
    expect(OS_W / OS_H).toBeCloseTo(2560 / 1664, 12)
  })

  it('(c) SCREEN is 2.86 × 1.859 scene units at 0.00275 per OS px, with the OS aspect', () => {
    expect(SCREEN.unit).toBeCloseTo(0.00275, 12)
    expect(SCREEN.w).toBeCloseTo(OS_W * SCREEN.unit, 12)
    expect(SCREEN.h).toBeCloseTo(OS_H * SCREEN.unit, 12)
    expect(SCREEN.w).toBeCloseTo(2.86, 9)
    expect(SCREEN.h).toBeCloseTo(1.859, 9)
    expect(SCREEN.w / SCREEN.h).toBeCloseTo(OS_W / OS_H, 12)
  })

  it('(d) the mirror canvas is 640 × 416 with the OS aspect, and the top corners round 10 OS px', () => {
    expect(SCREEN.mirror[0] / SCREEN.mirror[1]).toBeCloseTo(OS_W / OS_H, 12)
    expect(SCREEN.mirror).toEqual([640, 416])
    expect(SCREEN.cornerPx).toBe(10)
  })

  it('(e) LID.h = chin + SCREEN.h + top; the side bezels are 0.05 to 0.1; the top bezel is no taller than the chin', () => {
    expect(LID.h).toBeCloseTo(LID.chin + SCREEN.h + LID.top, 9)
    expect(LID.h).toBeCloseTo(2.09, 9)
    const side = (LID.w - SCREEN.w) / 2
    expect(side).toBeGreaterThanOrEqual(0.05)
    expect(side).toBeLessThanOrEqual(0.1)
    expect(LID.top).toBeLessThanOrEqual(LID.chin)
  })

  it('(f) BASE is 3.0 × 2.1 at [0, 0, 0.35] and 0.09 to 0.10 thick; LID is 0.04 to 0.05 thick; the closed height is at most 0.16', () => {
    expect(BASE.w).toBe(3)
    expect(BASE.d).toBe(2.1)
    expect(BASE.pos).toEqual([0, 0, 0.35])
    expect(BASE.h).toBeGreaterThanOrEqual(0.09)
    expect(BASE.h).toBeLessThanOrEqual(0.1)
    expect(LID.t).toBeGreaterThanOrEqual(0.04)
    expect(LID.t).toBeLessThanOrEqual(0.05)
    const closed = HINGE.y + LID.t
    expect(closed).toBeLessThanOrEqual(0.16)
    expect(closed).toBeCloseTo(0.152, 3)
  })

  it('(f2) the deck top sits on the feet: BASE.deckY = BASE.lift + BASE.h (0.101)', () => {
    expect(BASE.deckY).toBeCloseTo(BASE.lift + BASE.h, 12)
    expect(BASE.deckY).toBeCloseTo(0.101, 12)
  })

  it('(g) the closed lid front is flush with the base front: HINGE.z + LID.h is within 0.02 of BASE.d/2', () => {
    const front = HINGE.z + LID.h
    expect(front).toBeGreaterThanOrEqual(BASE.d / 2 - 0.02)
    expect(front).toBeLessThanOrEqual(BASE.d / 2)
  })

  it('(h) the hinge barrel top is below the pivot: barrel.pos.y + barrel.r < HINGE.y', () => {
    const top = HINGE.barrel.pos[1] + HINGE.barrel.r
    expect(top).toBeLessThan(HINGE.y)
    expect(HINGE.barrel.r).toBeCloseTo(0.028, 9)
    expect(HINGE.barrel.length).toBeCloseTo(2.5, 9)
  })

  it('(i) lidOpenTop() = HINGE.y + LID.h·cos 10° + LID.t·sin 10°, about 2.173, and below 2.3', () => {
    const formula = HINGE.y + LID.h * Math.cos(10 * DEG) + LID.t * Math.sin(10 * DEG)
    expect(lidOpenTop()).toBeCloseTo(formula, 9)
    expect(lidOpenTop()).toBeCloseTo(2.173, 3)
    expect(lidOpenTop()).toBeLessThan(2.3)
  })

  it('(j) SCREEN.cy = LID.chin + SCREEN.h/2, about 1.0955', () => {
    expect(SCREEN.cy).toBeCloseTo(LID.chin + SCREEN.h / 2, 12)
    expect(SCREEN.cy).toBeCloseTo(1.0955, 9)
  })

  it('(k) extrudeSpec(3, 2.1, 0.095, 0.12, 0.014) gives an outer size of exactly (3, 2.1, 0.095)', () => {
    const b = 0.014
    const s = extrudeSpec(3, 2.1, 0.095, 0.12, b)
    // The shape is inset by the bevel on every side, so the bevel adds it back to give the outer size.
    expect(s.w + 2 * b).toBeCloseTo(3, 12)
    expect(s.d + 2 * b).toBeCloseTo(2.1, 12)
    expect(s.depth + 2 * b).toBeCloseTo(0.095, 12)
    expect(s.r).toBeCloseTo(0.12 - b, 12)
  })
})
