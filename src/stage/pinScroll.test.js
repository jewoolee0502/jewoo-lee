// Phase 9 TEST LIST: stage/pinScroll.js. Bug J: overflow:hidden containers that hold the OS must
// not keep a scroll offset (focus or scrollIntoView can scroll them and push the CSS3D OS away).
import { describe, it, expect } from 'vitest'
import { pinScroll } from './pinScroll.js'

function box() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('stage/pinScroll', () => {
  it('1. a scroll event resets scrollTop and scrollLeft to 0', () => {
    const el = box()
    const cleanup = pinScroll(el)
    el.scrollTop = 239
    el.scrollLeft = 12
    el.dispatchEvent(new Event('scroll'))
    expect(el.scrollTop).toBe(0)
    expect(el.scrollLeft).toBe(0)
    cleanup()
    el.remove()
  })

  it('2. the cleanup removes the scroll listener, so later scrolls are not pinned', () => {
    const el = box()
    const cleanup = pinScroll(el)
    cleanup()
    el.scrollTop = 50
    el.dispatchEvent(new Event('scroll'))
    expect(el.scrollTop).toBe(50)
    el.remove()
  })

  it('3. only the pinned element is reset; a sibling keeps its offset', () => {
    const pinned = box()
    const other = box()
    const cleanup = pinScroll(pinned)
    other.scrollTop = 80
    pinned.scrollTop = 30
    pinned.dispatchEvent(new Event('scroll'))
    expect(pinned.scrollTop).toBe(0)
    expect(other.scrollTop).toBe(80)
    cleanup()
    pinned.remove()
    other.remove()
  })
})
