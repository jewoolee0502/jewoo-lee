// Phase 5 TEST LIST: wallpaper/layout.test.js. buildLayout(W) is the seeded city layout (L502–519)
// with per-feature Park–Miller streams in normalised units (fix B4): a resize must not re-roll it.
import { describe, it, expect } from 'vitest'
import { buildLayout } from './layout.js'

describe('buildLayout determinism', () => {
  it('gives an identical layout for the same W', () => {
    expect(buildLayout(240)).toEqual(buildLayout(240))
  })

  it('places the fixed features at the W 240 positions from the formulas', () => {
    const L = buildLayout(240)
    expect(L.peakX).toBe(72)
    expect(L.wheel).toEqual({ x: 60, y: 112, r: 22 })
    expect(L.bridge).toEqual({ x0: 173, t1: 187, t2: 226 })
  })
})

describe('buildLayout stability across W (B4)', () => {
  const a = buildLayout(240)
  const b = buildLayout(300)

  it('keeps each building width and height stream (rh) equal for the overlapping prefix', () => {
    const n = Math.min(a.blds.length, b.blds.length)
    expect(n).toBeGreaterThan(0)
    for (let i = 0; i < n; i++) {
      // L509 forces the pvm tower to w 10, and the pvm index (half the count) depends on W.
      if (a.blds[i].kind !== 'pvm' && b.blds[i].kind !== 'pvm') expect(a.blds[i].w).toBe(b.blds[i].w)
      expect(a.blds[i].rh).toBe(b.blds[i].rh)
    }
  })

  it('keeps the tree gap sequence and heights equal for the overlapping prefix', () => {
    const m = Math.min(a.trees.length, b.trees.length)
    const gaps = (L) => L.trees.slice(1).map((t, i) => t.x - L.trees[i].x)
    expect(gaps(a).slice(0, m - 1)).toEqual(gaps(b).slice(0, m - 1))
    expect(a.trees.slice(0, m).map((t) => t.h)).toEqual(b.trees.slice(0, m).map((t) => t.h))
  })

  it('scales star x with W (within 1/240) and keeps star y and twinkle phase equal', () => {
    const n = Math.min(a.stars.length, b.stars.length)
    expect(n).toBeGreaterThan(0)
    for (let i = 0; i < n; i++) {
      expect(Math.abs(a.stars[i].x / 240 - b.stars[i].x / 300)).toBeLessThanOrEqual(1 / 240 + 1e-9)
      expect(a.stars[i].y).toBe(b.stars[i].y)
      expect(a.stars[i].p).toBe(b.stars[i].p)
    }
  })
})

describe('buildLayout special buildings', () => {
  it('has exactly one pvm, one pyr and one step building, and pvm is 78 tall and 10 wide', () => {
    const L = buildLayout(240)
    const of = (kind) => L.blds.filter((b) => b.kind === kind)
    expect(of('pvm')).toHaveLength(1)
    expect(of('pyr')).toHaveLength(1)
    expect(of('step')).toHaveLength(1)
    expect(of('pvm')[0].h).toBe(78)
    expect(of('pvm')[0].w).toBe(10)
  })
})
