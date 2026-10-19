// Phase 6A TEST LIST: stage/snapRail.test.js (plan-r2 section 7, U2). syncSnapRail(el, { stop, points })
// keeps the rail inside #track in step with the layout: child 0 is the plateau stop, then one plain
// marker per point, in order. It writes only the values that changed, so a snapped page stays on its
// snap target when the layout is re-synced.
import { describe, it, expect } from 'vitest'
import { syncSnapRail } from './snapRail.js'

const tops = (el) => [...el.children].map((n) => n.style.top)

function watch(el) {
  const mo = new MutationObserver(() => {})
  mo.observe(el, { attributes: true, childList: true, subtree: true })
  return mo
}

describe('stage/snapRail', () => {
  it('builds the stop first (class stop), then one <i> per point, in order, each at its px top', () => {
    const el = document.createElement('div')
    syncSnapRail(el, { stop: 100, points: [0, 8, 16] })
    expect(el.children).toHaveLength(4)
    expect(el.children[0]).toHaveClass('stop')
    expect(el.children[1]).not.toHaveClass('stop')
    expect(el.children[0].tagName).toBe('I')
    expect(tops(el)).toEqual(['100px', '0px', '8px', '16px'])
  })

  it('the same data again writes nothing: no attribute or child mutation', () => {
    const el = document.createElement('div')
    syncSnapRail(el, { stop: 100, points: [0, 8, 16] })
    const mo = watch(el)
    syncSnapRail(el, { stop: 100, points: [0, 8, 16] })
    expect(mo.takeRecords()).toHaveLength(0)
    mo.disconnect()
  })

  it('a new stop moves only the stop node, and an extra point is appended without touching the others', () => {
    const el = document.createElement('div')
    syncSnapRail(el, { stop: 100, points: [0, 8, 16] })
    const kept = [...el.children]
    const mo = watch(el)
    syncSnapRail(el, { stop: 120, points: [0, 8, 16, 24] })
    const recs = mo.takeRecords()
    mo.disconnect()
    expect(el.children).toHaveLength(5)
    expect(kept.every((n, i) => el.children[i] === n)).toBe(true)
    expect(tops(el)).toEqual(['120px', '0px', '8px', '16px', '24px'])
    const attrTargets = recs.filter((r) => r.type === 'attributes').map((r) => r.target)
    expect(attrTargets.length).toBeGreaterThan(0)
    expect(attrTargets.every((t) => t === kept[0])).toBe(true)
    const added = recs.filter((r) => r.type === 'childList').flatMap((r) => [...r.addedNodes])
    expect(added).toHaveLength(1)
    expect(added[0].style.top).toBe('24px')
    expect(added[0]).not.toHaveClass('stop')
  })

  it('fewer points removes nodes from the end, keeping the rest in place', () => {
    const el = document.createElement('div')
    syncSnapRail(el, { stop: 100, points: [0, 8, 16] })
    const kept = [...el.children]
    syncSnapRail(el, { stop: 120, points: [0, 8] })
    expect(el.children).toHaveLength(3)
    expect(el.children[0]).toBe(kept[0])
    expect(el.children[1]).toBe(kept[1])
    expect(el.children[2]).toBe(kept[2])
    expect(tops(el)).toEqual(['120px', '0px', '8px'])
  })

  it('a null element is a no-op and does not throw', () => {
    expect(() => syncSnapRail(null, { stop: 100, points: [0, 8] })).not.toThrow()
  })
})
