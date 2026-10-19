import { describe, it, expect, vi } from 'vitest'
import { createOsHost } from './osHost.js'

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
    expect(host.holder.style.width).toBe('900px')
    expect(host.holder.style.height).toBe('675px')
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

  it('fitFlat in a 1200x675 host scales by 1 and sizes to the host', () => {
    const host = createOsHost()
    host.bindFlatHost(makeFlatHost(1200, 675))
    host.setFlat(true, false)

    host.fitFlat()

    expect(host.osEl.style.transform).toBe('scale(1)')
    expect(host.osEl.style.width).toBe('1200px')
    expect(host.osEl.style.height).toBe('675px')
  })

  it('fitFlat in a 450x675 host scales by 0.5 and grows the logical size', () => {
    const host = createOsHost()
    host.bindFlatHost(makeFlatHost(450, 675))
    host.setFlat(true, false)

    host.fitFlat()

    expect(host.osEl.style.transform).toBe('scale(0.5)')
    expect(host.osEl.style.width).toBe('900px')
    expect(host.osEl.style.height).toBe('1350px')
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

  it('setFlat(false) moves the OS element back into the holder and restores 900px', () => {
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
    expect(host.osEl.style.width).toBe('900px')
  })

  it('setSize writes both widths and reports no shrink when growing', () => {
    const host = createOsHost()

    const result = host.setSize(1000, 700)

    expect(host.holder.style.width).toBe('1000px')
    expect(host.osEl.style.width).toBe('1000px')
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

  it('setLive(false) resets scrollTop of .wb and .t-out inside the OS element', () => {
    const host = createOsHost()
    const wb = document.createElement('div')
    wb.className = 'wb'
    const tOut = document.createElement('div')
    tOut.className = 't-out'
    host.osEl.append(wb, tOut)
    wb.scrollTop = 50
    tOut.scrollTop = 50

    host.setLive(false)

    expect(wb.scrollTop).toBe(0)
    expect(tOut.scrollTop).toBe(0)
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
