// Paint (registry id `paint`, 336×336 canvas, 24×24 grid). Opened inside a booted JAY-OS so the
// desktop icons and achievements are real. Pointer events are dispatched through a small
// PointerEvent stand-in, because jsdom has none and RTL would drop clientX/clientY.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { act, fireEvent, within } from '@testing-library/react'
import { renderWithApp } from '../../../test/renderWithApp.jsx'
import { JayOS } from '../../JayOS.jsx'
import { validateDrawingDataUrl, PNG_PREFIX } from '../../../lib/png.js'

class FakePointerEvent extends MouseEvent {
  constructor(type, init = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
  }
}

const RECT = { left: 0, top: 0, right: 336, bottom: 336, width: 336, height: 336, x: 0, y: 0 }
const WINDOW = 'section.win[data-app="paint"]'

beforeAll(() => {
  window.PointerEvent = FakePointerEvent
})

afterAll(() => {
  delete window.PointerEvent
})

beforeEach(() => {
  vi.useFakeTimers()
})

// Stub wall: records submitted data URLs and answers with the given result (or a pending promise).
function stubWall(result = { ok: true }) {
  const calls = []
  return {
    calls,
    submit: async (url) => {
      calls.push(url)
      return result
    },
  }
}

function bootedApp(overrides = {}) {
  const result = renderWithApp(<JayOS />, { wall: stubWall(), ...overrides })
  act(() => {
    result.app.os.boot()
  })
  act(() => {
    vi.advanceTimersByTime(2200)
  })
  return result
}

/** Opens Paint and returns its window element and canvas (with a fixed 336×336 layout). */
function openPaint(app) {
  act(() => {
    app.os.openApp('paint')
  })
  const win = document.querySelector(WINDOW)
  const canvas = within(win).getByLabelText('Pixel canvas')
  canvas.getBoundingClientRect = () => RECT
  return { win, canvas }
}

const pointer = (canvas, type, x, y) => fireEvent(canvas, new FakePointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true, cancelable: true }))
const down = (c, x, y) => pointer(c, 'pointerdown', x, y)
const move = (c, x, y) => pointer(c, 'pointermove', x, y)
const up = (c, x, y) => pointer(c, 'pointerup', x, y)

const button = (w, name) => within(w).getByRole('button', { name })
const toasts = (app) => app.toasts.store.get().list
const hasToast = (app, title, body) =>
  toasts(app).some((t) => t.title === title && t.body === body)

/** Decodes an indexed PNG data URL into {w, h, px: [{hex, a}]}. */
function decodePng(dataUrl) {
  const buf = Buffer.from(dataUrl.slice(PNG_PREFIX.length), 'base64')
  let o = 8
  let w = 0
  let h = 0
  let plte = null
  let trns = null
  const idat = []
  while (o < buf.length) {
    const len = buf.readUInt32BE(o)
    const type = buf.toString('latin1', o + 4, o + 8)
    const data = buf.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
    } else if (type === 'PLTE') plte = data
    else if (type === 'tRNS') trns = data
    else if (type === 'IDAT') idat.push(data)
    o += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const px = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = raw[y * (w + 1) + 1 + x]
      const hex = '#' + [0, 1, 2].map((j) => plte[k * 3 + j].toString(16).padStart(2, '0')).join('').toUpperCase()
      px.push({ hex, a: trns && k < trns.length ? trns[k] : 255 })
    }
  }
  return { w, h, px }
}

/** Indices of the opaque pixels of a saved drawing. */
const opaqueCells = (img) => img.px.flatMap((p, i) => (p.a === 255 ? [i] : []))

describe('Paint app', () => {
  it('shows 10 palette buttons, and the first (Colour #122030) is on', () => {
    const { app } = bootedApp()
    const { win } = openPaint(app)
    const pal = win.querySelector('.palette')
    expect(pal.querySelectorAll('button')).toHaveLength(10)
    expect(button(win, 'Colour #122030').classList.contains('on')).toBe(true)
    expect(button(win, 'Eraser')).toBeInTheDocument()
  })

  it('pointerdown then pointermove paints the two cells under the pointer', () => {
    const { app } = bootedApp()
    const { win, canvas } = openPaint(app)
    down(canvas, 7, 7)
    move(canvas, 21, 7)
    up(canvas, 21, 7)
    fireEvent.click(button(win, 'Save to desktop'))
    const img = decodePng(app.os.store.get().art[0])
    expect(opaqueCells(img)).toEqual([0, 1])
    expect(img.px[0].hex).toBe('#122030')
  })

  it('after pointercancel, a pointermove does not paint', () => {
    const { app } = bootedApp()
    const { win, canvas } = openPaint(app)
    down(canvas, 7, 7)
    pointer(canvas, 'pointercancel', 7, 7)
    move(canvas, 21, 7)
    fireEvent.click(button(win, 'Save to desktop'))
    expect(opaqueCells(decodePng(app.os.store.get().art[0]))).toEqual([0])
  })

  it('lostpointercapture and pointerup also end the stroke', () => {
    const { app } = bootedApp()
    const { win, canvas } = openPaint(app)
    down(canvas, 7, 7)
    pointer(canvas, 'lostpointercapture', 7, 7)
    move(canvas, 21, 7)
    down(canvas, 35, 7)
    up(canvas, 35, 7)
    move(canvas, 49, 7)
    fireEvent.click(button(win, 'Save to desktop'))
    expect(opaqueCells(decodePng(app.os.store.get().art[0]))).toEqual([0, 2])
  })

  it('the Eraser removes a painted cell', () => {
    const { app } = bootedApp()
    const { win, canvas } = openPaint(app)
    down(canvas, 7, 7)
    up(canvas, 7, 7)
    down(canvas, 21, 7)
    up(canvas, 21, 7)
    fireEvent.click(button(win, 'Eraser'))
    expect(button(win, 'Eraser').classList.contains('on')).toBe(true)
    down(canvas, 7, 7)
    up(canvas, 7, 7)
    fireEvent.click(button(win, 'Save to desktop'))
    expect(opaqueCells(decodePng(app.os.store.get().art[0]))).toEqual([1])
  })

  it('the canvas keeps touch-action none, so painting does not scroll the page', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/apps.css'), 'utf8')
    const rule = css.match(/[^{}]*\.paint-cv[^{}]*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).toMatch(/touch-action:\s*none/)
  })

  it('Save to desktop on an empty grid toasts Draw something first! and saves nothing', () => {
    const { app } = bootedApp()
    const { win } = openPaint(app)
    fireEvent.click(button(win, 'Save to desktop'))
    expect(hasToast(app, 'Paint', 'Draw something first!')).toBe(true)
    expect(app.os.store.get().art).toEqual([])
    expect(app.ach.store.get().got.has('paint')).toBe(false)
  })

  it('Save to desktop after painting adds my-art-0.png to the desktop, toasts Saved, and unlocks paint', () => {
    const { app } = bootedApp()
    const { win, canvas } = openPaint(app)
    down(canvas, 7, 7)
    up(canvas, 7, 7)
    fireEvent.click(button(win, 'Save to desktop'))
    expect(app.os.store.get().art).toHaveLength(1)
    expect(validateDrawingDataUrl(app.os.store.get().art[0])).toMatchObject({ ok: true })
    const icons = document.querySelector('#icons-r')
    expect([...icons.querySelectorAll('span')].map((s) => s.textContent)).toContain('my-art-0.png')
    expect(hasToast(app, 'Saved', 'my-art-0.png is on the desktop.')).toBe(true)
    expect(app.ach.store.get().got.has('paint')).toBe(true)
  })

  it('Clear empties the grid, so Save then shows the empty toast', () => {
    const { app } = bootedApp()
    const { win, canvas } = openPaint(app)
    down(canvas, 7, 7)
    up(canvas, 7, 7)
    fireEvent.click(button(win, 'Clear'))
    fireEvent.click(button(win, 'Save to desktop'))
    expect(hasToast(app, 'Paint', 'Draw something first!')).toBe(true)
    expect(app.os.store.get().art).toEqual([])
  })

  it('Pin to wall on an empty grid toasts Draw something first! and does not submit', () => {
    const wall = stubWall()
    const { app } = bootedApp({ wall })
    const { win } = openPaint(app)
    fireEvent.click(button(win, 'Pin to wall'))
    expect(hasToast(app, 'Paint', 'Draw something first!')).toBe(true)
    expect(wall.calls).toEqual([])
  })

  it('Pin to wall submits a valid 24×24 drawing; on success it toasts Pinned!, unlocks paint, and disables the button while sending', async () => {
    let resolveSubmit
    const wall = {
      calls: [],
      submit: (url) => {
        wall.calls.push(url)
        return new Promise((resolve) => {
          resolveSubmit = resolve
        })
      },
    }
    const { app } = bootedApp({ wall })
    const { win, canvas } = openPaint(app)
    down(canvas, 7, 7)
    up(canvas, 7, 7)
    fireEvent.click(button(win, 'Pin to wall'))
    expect(wall.calls).toHaveLength(1)
    expect(validateDrawingDataUrl(wall.calls[0])).toMatchObject({ ok: true })
    expect(button(win, 'Pin to wall')).toBeDisabled()

    await act(async () => {
      resolveSubmit({ ok: true })
    })
    expect(button(win, 'Pin to wall')).not.toBeDisabled()
    expect(hasToast(app, 'Pinned!', 'It’s waiting for Jay’s approval.')).toBe(true)
    expect(app.ach.store.get().got.has('paint')).toBe(true)
  })

  it.each([
    ['rate_limited', 'Visitor Wall', 'Slow down a little. Try again later.'],
    ['queue_full', 'Visitor Wall', 'The queue is full right now. Try again later.'],
    ['bad_png', 'Visitor Wall', 'That drawing couldn’t be sent.'],
    ['too_large', 'Visitor Wall', 'That drawing couldn’t be sent.'],
    ['bad_size', 'Visitor Wall', 'That drawing couldn’t be sent.'],
    ['network', 'Visitor Wall', 'Couldn’t reach the wall. Try again.'],
  ])('a failed pin with %s toasts "%s" and does not unlock paint', async (code, title, body) => {
    const wall = stubWall({ ok: false, code })
    const { app } = bootedApp({ wall })
    const { win, canvas } = openPaint(app)
    down(canvas, 7, 7)
    up(canvas, 7, 7)
    await act(async () => {
      fireEvent.click(button(win, 'Pin to wall'))
    })
    expect(hasToast(app, title, body)).toBe(true)
    expect(app.ach.store.get().got.has('paint')).toBe(false)
  })
})
