import { describe, it, expect, vi } from 'vitest'
import { clamp, ss, easeIO, easeQuad } from './math.js'

describe('clamp', () => {
  it('limits a value to the given range', () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-3, 0, 1)).toBe(0)
    expect(clamp(0.5, 0, 1)).toBe(0.5)
  })
})

describe('ss (smoothstep)', () => {
  it('returns the smoothstep curve with clamping at both ends', () => {
    expect(ss(0, 1, 0.5)).toBe(0.5)
    expect(ss(0, 1, -1)).toBe(0)
    expect(ss(0, 1, 2)).toBe(1)
  })
})

describe('easeIO', () => {
  it('is an in-out cubic', () => {
    expect(easeIO(0)).toBe(0)
    expect(easeIO(0.5)).toBe(0.5)
    expect(easeIO(1)).toBe(1)
    expect(easeIO(0.25)).toBe(0.0625)
  })
})

describe('easeQuad', () => {
  it('is an in-out quadratic', () => {
    expect(easeQuad(0.25)).toBe(0.125)
  })
})
