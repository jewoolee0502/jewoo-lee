// Phase 5 TEST LIST item 1: pure image-plan helpers (no DOM, no node: imports in the module under test).
import { describe, it, expect } from 'vitest'
import { planWidths, srcSetFrom, sizesFor, WIDTHS } from './imagePlan.js'

describe('imagePlan', () => {
  it('WIDTHS is 640, 1280, 1920', () => {
    expect(WIDTHS).toEqual([640, 1280, 1920])
  })

  it('planWidths keeps every width up to the natural width, never enlarging', () => {
    expect(planWidths(3356)).toEqual([640, 1280, 1920])
    expect(planWidths(1920)).toEqual([640, 1280, 1920])
    expect(planWidths(1772)).toEqual([640, 1280])
    expect(planWidths(1280)).toEqual([640, 1280])
    expect(planWidths(704)).toEqual([640])
    expect(planWidths(640)).toEqual([640])
  })

  it('planWidths falls back to the natural width when it is below the smallest planned width', () => {
    expect(planWidths(420)).toEqual([420])
    expect(planWidths(639)).toEqual([639])
  })

  it('planWidths accepts a custom width list', () => {
    expect(planWidths(1000, [400, 800, 1200])).toEqual([400, 800])
  })

  it('srcSetFrom joins url and width descriptors with ", "', () => {
    expect(srcSetFrom([[640, 'a'], [1280, 'b']])).toBe('a 640w, b 1280w')
    expect(srcSetFrom([[1920, '/img/x-1920.webp']])).toBe('/img/x-1920.webp 1920w')
  })

  it('srcSetFrom of no files is the empty string', () => {
    expect(srcSetFrom([])).toBe('')
  })

  it('sizesFor shot in the OS at scale 1.3333 (not compact) is ceil(560 × scale)', () => {
    expect(sizesFor('shot', { compact: false, scale: 1.3333 })).toBe('747px')
  })

  it('sizesFor shot at scale 1 is 560px', () => {
    expect(sizesFor('shot', { compact: false, scale: 1 })).toBe('560px')
  })

  it('sizesFor shot in compact (phone) layout fills the viewport minus the gutter', () => {
    expect(sizesFor('shot', { compact: true })).toBe('calc(100vw - 52px)')
    expect(sizesFor('shot', { compact: true, scale: 2.1333 })).toBe('calc(100vw - 52px)')
  })

  it('sizesFor thumb is ceil(200 × scale), and shows the grid width in compact', () => {
    expect(sizesFor('thumb', { compact: false, scale: 2.1333 })).toBe('427px')
    expect(sizesFor('thumb', { compact: false, scale: 1 })).toBe('200px')
    expect(sizesFor('thumb', { compact: true })).toBe('calc(50vw - 30px)')
  })
})
