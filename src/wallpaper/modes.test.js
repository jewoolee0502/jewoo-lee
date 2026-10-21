import { describe, it, expect, vi } from 'vitest'
import { MODES, isMode, autoWp, clampWidth } from './modes.js'
import { OS_W, OS_H } from '../core/constants.js'

describe('autoWp in July (EDT)', () => {
  it.each([
    ['2026-07-15T10:59Z', 'night'],
    ['2026-07-15T11:00Z', 'day'],
    ['2026-07-15T20:59Z', 'day'],
    ['2026-07-15T21:00Z', 'golden'],
    ['2026-07-15T23:59Z', 'golden'],
    ['2026-07-16T00:00Z', 'night'],
    ['2026-07-16T04:00Z', 'night'],
  ])('at %s (Montréal) gives %s', (iso, expected) => {
    expect(autoWp(new Date(iso))).toBe(expected)
  })
})

describe('autoWp edge cases', () => {
  it('January (EST) at 12:00Z, which is 07:00 Montréal, gives day', () => {
    expect(autoWp(new Date('2026-01-15T12:00Z'))).toBe('day')
  })

  it('an invalid time zone falls back to hour 12 and gives day', () => {
    // 23:00Z is 19:00 EDT (golden) in Montréal, so only the fallback can produce day here.
    expect(autoWp(new Date('2026-07-15T23:00Z'), 'Invalid/Zone')).toBe('day')
  })
})

describe('clampWidth', () => {
  it('clamps the pixel-city width to 160..420 and uses OS_W x OS_H (1040 x 676) defaults', () => {
    expect(clampWidth(900, 675)).toBe(240)
    expect(clampWidth(0, 0)).toBe(clampWidth(OS_W, OS_H))
    expect(clampWidth(0, 0)).toBe(277)
    expect(clampWidth(100, 675)).toBe(160)
    expect(clampWidth(2000, 675)).toBe(420)
  })
})

describe('isMode', () => {
  it('accepts real mode keys and rejects inherited Object.prototype keys', () => {
    expect(isMode('day')).toBe(true)
    expect(Object.keys(MODES)).toContain('day')
    expect(isMode('constructor')).toBe(false)
  })
})
