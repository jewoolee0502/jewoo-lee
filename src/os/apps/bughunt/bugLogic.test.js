// Phase 5 TEST LIST: os/apps/bughunt/bugLogic.test.js. Pure helpers from L941–953.
import { describe, it, expect } from 'vitest'
import { spawnInterval, speed, spawnBug, stepBug, isOut } from './bugLogic.js'

const SIZE = { w: 900, h: 675 }

describe('spawnInterval(left) = max(.25, .8 - (20 - left) * .03)', () => {
  it('is .8 at 20 s left, .5 at 10 s, and clamps to .25 at 0 s', () => {
    expect(spawnInterval(20)).toBe(0.8)
    expect(spawnInterval(10)).toBeCloseTo(0.5, 10)
    expect(spawnInterval(0)).toBe(0.25)
  })
})

describe('speed(left, r) = 60 + r * 90 + (20 - left) * 6', () => {
  it('gives 60 at r 0 and 270 at the fastest end of the range', () => {
    expect(speed(20, 0)).toBe(60)
    expect(speed(0, 1)).toBe(270)
  })

  it('stays below 150 for r < 1 at 20 s left', () => {
    expect(speed(20, 0.999)).toBeLessThan(150)
  })
})

describe('spawnBug(size, left, rand)', () => {
  it('with rand returning 0 comes from the left edge at x -20, with the base speed', () => {
    const bug = spawnBug(SIZE, 20, () => 0)
    expect(bug.x).toBe(-20)
    expect(bug.sp).toBe(60)
    expect(bug.turn).toBe(0)
    expect(bug.dead).toBe(false)
  })
})

describe('stepBug(bug, dt, rand)', () => {
  it('moves along the heading by sp * dt, and turns by (rand - .5) * 4 * dt', () => {
    const straight = { x: 100, y: 100, a: 0, sp: 100, turn: 0, dead: false }
    stepBug(straight, 0.1, () => 0.5)
    expect(straight.x).toBeCloseTo(110, 10)
    expect(straight.y).toBeCloseTo(100, 10)

    const turning = { x: 100, y: 100, a: 0, sp: 100, turn: 0, dead: false }
    stepBug(turning, 0.1, () => 1)
    expect(turning.turn).toBeCloseTo(0.2, 10)
  })
})

describe('isOut(bug, size) boundaries', () => {
  it('is false on the margin lines and true just beyond them', () => {
    const at = (x, y) => isOut({ x, y }, SIZE)
    expect(at(-60, 300)).toBe(false)
    expect(at(-61, 300)).toBe(true)
    expect(at(960, 300)).toBe(false) // w + 60
    expect(at(961, 300)).toBe(true)
    expect(at(450, -60)).toBe(false)
    expect(at(450, -61)).toBe(true)
    expect(at(450, 705)).toBe(false) // h + 30
    expect(at(450, 706)).toBe(true)
  })
})
