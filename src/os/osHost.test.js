// Round 2 Phase 2 TEST LIST item 7 (osHost): live toggles keep scroll offsets, no trap, fade class, fitFlat returns k.
import { describe, it, expect, vi } from 'vitest'
import { createOsHost } from './osHost.js'
import { OS_W, OS_H } from '../core/constants.js'

function makeFlatHost(width, height) {
  const el = document.createElement('div')
  el.className = 'flat-host'
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height })
  return el
}

describe('createOsHost', () => {
  it('creates the holder and the OS element with the right ids, classes and size', () => {
    const host = createOsHost()

    expect(host.holder.id).toBe('os-holder')
    expect(host.holder.style.width).toBe('1040px')
    expect(host.holder.style.height).toBe('676px')
    expect(host.osEl.id).toBe('os')
    expect(host.osEl.classList.contains('os')).toBe(true)
    expect(host.osEl.dataset.state).toBe('standby')
    expect(host.holder.contains(host.osEl)).toBe(true)
  })

  it('attachPark puts the holder inside the park element', () => {
    const host = createOsHost()
    const park = document.createElement('div')
    park.className = 'park'
    document.body.appendChild(park)

    host.attachPark(park)

    expect(park.contains(host.holder)).toBe(true)
  })

  it('setFlat(true) moves the OS element into the flat host with classes flat and on', () => {
    const host = createOsHost()
    const flatHost = makeFlatHost(1200, 675)
    host.bindFlatHost(flatHost)

    host.setFlat(true, false)

    expect(flatHost.contains(host.osEl)).toBe(true)
    expect(host.osEl.classList.contains('flat')).toBe(true)
    expect(flatHost.classList.contains('on')).toBe(true)
  })

  it('fitFlat in a 1040x676 host (the OS size) scales by 1 and sizes to the host', () => {
    const host = createOsHost()
    host.bindFlatHost(makeFlatHost(1040, 676))
    host.setFlat(true, false)

    host.fitFlat()

    expect(host.osEl.style.transform).toBe('scale(1)')
    expect(host.osEl.style.width).toBe('1040px')
    expect(host.osEl.style.height).toBe('676px')
  })

  it('fitFlat in a 520x676 host scales by 0.5 and grows the logical size to 1040 x 1352', () => {
    const host = createOsHost()
    host.bindFlatHost(makeFlatHost(520, 676))
    host.setFlat(true, false)

    host.fitFlat()

    expect(host.osEl.style.transform).toBe('scale(0.5)')
    expect(host.osEl.style.width).toBe('1040px')
    expect(host.osEl.style.height).toBe('1352px')
  })

  it('setFlat(true, true) in compact mode clears transform, width and height', () => {
    const host = createOsHost()
    host.bindFlatHost(makeFlatHost(450, 675))
    host.setFlat(true, false)
    host.fitFlat()

    host.setFlat(true, true)

    expect(host.osEl.classList.contains('compact')).toBe(true)
    expect(host.osEl.style.transform).toBe('')
    expect(host.osEl.style.width).toBe('')
    expect(host.osEl.style.height).toBe('')
  })

  it('setFlat(false) moves the OS element back into the holder and restores 1040px', () => {
    const host = createOsHost()
    const flatHost = makeFlatHost(450, 675)
    host.bindFlatHost(flatHost)
    host.setFlat(true, false)
    host.fitFlat()

    host.setFlat(false)

    expect(host.holder.contains(host.osEl)).toBe(true)
    expect(host.osEl.classList.contains('flat')).toBe(false)
    expect(flatHost.classList.contains('on')).toBe(false)
    expect(host.osEl.style.transform).toBe('')
    expect(host.osEl.style.width).toBe('1040px')
  })

  it('setSize writes both widths and reports no shrink when growing', () => {
    const host = createOsHost()

    const result = host.setSize(1100, 700)

    expect(host.holder.style.width).toBe('1100px')
    expect(host.osEl.style.width).toBe('1100px')
    expect(result).toEqual({ shrunk: false })
  })

  it('setSize reports a shrink when the desk gets smaller', () => {
    const host = createOsHost()
    host.setSize(1000, 700)

    expect(host.setSize(950, 650)).toEqual({ shrunk: true })
  })

  it('setSize with an unchanged size returns no shrink and makes no style write', () => {
    const host = createOsHost()
    host.setSize(950, 650)
    const widthSet = vi.spyOn(host.holder.style, 'width', 'set')
    const osWidthSet = vi.spyOn(host.osEl.style, 'width', 'set')

    const result = host.setSize(950, 650)

    expect(result).toEqual({ shrunk: false })
    expect(widthSet).not.toHaveBeenCalled()
    expect(osWidthSet).not.toHaveBeenCalled()
  })

  it('setLive(false) keeps the scrollTop of .wb and .t-out (R9: a live flip must not reset the windows)', () => {
    const host = createOsHost()
    const wb = document.createElement('div')
    wb.className = 'wb'
    const tOut = document.createElement('div')
    tOut.className = 't-out'
    host.osEl.append(wb, tOut)
    wb.scrollTop = 50
    tOut.scrollTop = 50

    host.setLive(false)

    expect(host.osEl.classList.contains('live')).toBe(false)
    expect(wb.scrollTop).toBe(50)
    expect(tOut.scrollTop).toBe(50)
  })

  it('has no setTrap (the touch trap is gone with the wheel hijack)', () => {
    const host = createOsHost()

    expect(host).not.toHaveProperty('setTrap')
  })

  it('setFlat(true, true) adds the fade class to the flat host; setFlat(true, false) removes it', () => {
    const host = createOsHost()
    const flatHost = makeFlatHost(1440, 900)
    host.bindFlatHost(flatHost)

    host.setFlat(true, true)
    expect(flatHost.classList.contains('fade')).toBe(true)

    host.setFlat(true, false)
    expect(flatHost.classList.contains('fade')).toBe(false)
  })

  it('fitFlat returns the scale k = min(W/OS_W, H/OS_H) for a non-compact flat host and sizes the OS to about 1081.6px wide at 1440x900', () => {
    const host = createOsHost()
    host.bindFlatHost(makeFlatHost(1440, 900))
    host.setFlat(true, false)

    const k = host.fitFlat()

    expect(k).toBeCloseTo(Math.min(1440 / OS_W, 900 / OS_H), 6)
    expect(k).toBeCloseTo(1.33136, 5)
    expect(parseFloat(host.osEl.style.width)).toBeCloseTo(1440 / k, 6)
    expect(parseFloat(host.osEl.style.width)).toBeCloseTo(1081.6, 1)
    expect(parseFloat(host.osEl.style.height)).toBeCloseTo(OS_H, 6)
  })

  it('fitFlat returns 1 for the compact layout', () => {
    const host = createOsHost()
    host.bindFlatHost(makeFlatHost(450, 675))
    host.setFlat(true, true)

    expect(host.fitFlat()).toBe(1)
  })

  it('syncClasses toggles the classes and sets dataset.state', () => {
    const host = createOsHost()

    host.syncClasses({ state: 'on', collapsing: true, disco: true, fallback: true })

    expect(host.osEl.dataset.state).toBe('on')
    expect(host.osEl.classList.contains('collapsing')).toBe(true)
    expect(host.osEl.classList.contains('disco')).toBe(true)
    expect(host.osEl.classList.contains('fallback')).toBe(true)

    host.syncClasses({ state: 'off', collapsing: false, disco: false, fallback: false })

    expect(host.osEl.dataset.state).toBe('off')
    expect(host.osEl.classList.contains('collapsing')).toBe(false)
    expect(host.osEl.classList.contains('disco')).toBe(false)
    expect(host.osEl.classList.contains('fallback')).toBe(false)
  })

  it('scale() is 1 in jsdom (no layout)', () => {
    const host = createOsHost()

    expect(host.scale()).toBe(1)
  })

  it('scale() is the rendered width over the offset width (0.5 here)', () => {
    const host = createOsHost()
    vi.spyOn(host.osEl, 'getBoundingClientRect').mockReturnValue({ width: 450 })
    Object.defineProperty(host.osEl, 'offsetWidth', { configurable: true, value: 900 })

    expect(host.scale()).toBe(0.5)
  })
})

// Round 2 §7 6B TEST LIST item 2 (U10): a window's scroll offset survives the re-parent in setFlat.
// The browser resets a moved node's scroll offset, so each appendChild here resets it after the real move.
describe('createOsHost scroll offsets across setFlat (plan §7 6B)', () => {
  function scrolledWindow(top) {
    const wb = document.createElement('div')
    wb.className = 'wb'
    let t = top
    Object.defineProperty(wb, 'scrollTop', {
      configurable: true,
      get: () => t,
      set: (v) => {
        t = v
      },
    })
    return wb
  }

  function resetOnMove(parent, wb) {
    const real = parent.appendChild.bind(parent)
    return vi.spyOn(parent, 'appendChild').mockImplementation((node) => {
      const out = real(node)
      wb.scrollTop = 0
      return out
    })
  }

  it('setFlat(true) and back keeps a window at scrollTop 200', () => {
    const host = createOsHost()
    const flatHost = makeFlatHost(1200, 675)
    host.bindFlatHost(flatHost)
    const wb = scrolledWindow(200)
    host.osEl.appendChild(wb)

    resetOnMove(flatHost, wb)
    host.setFlat(true, false)
    expect(wb.scrollTop).toBe(200)

    resetOnMove(host.holder, wb)
    host.setFlat(false)
    expect(wb.scrollTop).toBe(200)
  })
})
