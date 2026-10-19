// Phase 6A TEST LIST: stage/arrowStep.test.js (plan-r2 section 7, U4). While the page snaps, a plain
// ArrowUp/ArrowDown steps the page ARROW_STEP_PX (40) in JS, because native arrows move 8 px under the
// rail. The step is 0 whenever the browser should keep the key: snapping off, a modifier held, another
// key, or the window the pointer last touched can still scroll that way.
import { describe, it, expect } from 'vitest'
import { arrowStep } from './arrowStep.js'

const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false }
const base = { key: 'ArrowDown', mods: NO_MODS, snapping: true, scroller: null }
const step = (over) => arrowStep({ ...base, ...over })

describe('stage/arrowStep', () => {
  it('ArrowDown with snapping on and no scroller steps +40', () => {
    expect(step({})).toBe(40)
  })

  it('ArrowUp with snapping on and no scroller steps −40', () => {
    expect(step({ key: 'ArrowUp' })).toBe(-40)
  })

  it('with snapping off, the arrow is native (0)', () => {
    expect(step({ snapping: false })).toBe(0)
    expect(step({ snapping: false, key: 'ArrowUp' })).toBe(0)
  })

  it('any held modifier (alt, ctrl, meta, shift) leaves the arrow native (0)', () => {
    for (const m of ['alt', 'ctrl', 'meta', 'shift']) {
      expect(step({ mods: { ...NO_MODS, [m]: true } }), m).toBe(0)
    }
  })

  it('other scroll keys stay native (0): PageDown, PageUp, Space, Home, End', () => {
    for (const key of ['PageDown', 'PageUp', ' ', 'Home', 'End']) {
      expect(step({ key }), key).toBe(0)
    }
  })

  it('a window that can still scroll down keeps ArrowDown (0); one that cannot step +40', () => {
    expect(step({ scroller: { scrollTop: 0, clientHeight: 100, scrollHeight: 300 } })).toBe(0)
    expect(step({ scroller: { scrollTop: 200, clientHeight: 100, scrollHeight: 300 } })).toBe(40)
  })

  it('a window that can still scroll up keeps ArrowUp (0); one at its top steps −40', () => {
    expect(step({ key: 'ArrowUp', scroller: { scrollTop: 200, clientHeight: 100, scrollHeight: 300 } })).toBe(0)
    expect(step({ key: 'ArrowUp', scroller: { scrollTop: 0, clientHeight: 100, scrollHeight: 300 } })).toBe(-40)
  })
})
