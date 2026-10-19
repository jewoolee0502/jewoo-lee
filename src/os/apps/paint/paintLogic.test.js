// Pure Paint helpers: the 24×24 grid, cell hit-testing, the PNG export and emptiness.
import { describe, it, expect } from 'vitest'
import { inflateSync } from 'node:zlib'
import { N, COLS, cellFromPoint, exportPng, isEmpty } from './paintLogic.js'
import { validateDrawingDataUrl, PNG_PREFIX } from '../../../lib/png.js'

// Decodes an indexed PNG data URL into per-pixel {hex, a} (a = alpha, 0..255).
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
      const a = trns && k < trns.length ? trns[k] : 255
      px.push({ hex, a })
    }
  }
  return { w, h, px }
}

describe('paint logic', () => {
  it('uses a 24×24 grid and the 9 colours plus the eraser (null) last', () => {
    expect(N).toBe(24)
    expect(COLS).toHaveLength(10)
    expect(COLS[0]).toBe('#122030')
    expect(COLS.at(-1)).toBeNull()
  })

  it('cellFromPoint maps the corners of a 336×336 canvas and returns null outside it', () => {
    const rect = { left: 0, top: 0, width: 336, height: 336 }
    expect(cellFromPoint(rect, 0, 0)).toEqual({ x: 0, y: 0 })
    expect(cellFromPoint(rect, 335, 335)).toEqual({ x: 23, y: 23 })
    expect(cellFromPoint(rect, -1, 5)).toBeNull()
    expect(cellFromPoint(rect, 336, 0)).toBeNull()
  })

  it('exportPng of a grid with cell 0 = #E8452E is a valid drawing with that colour at (0,0) and transparency elsewhere', () => {
    const grid = Array(N * N).fill(null)
    grid[0] = '#E8452E'
    const url = exportPng(grid)
    expect(validateDrawingDataUrl(url)).toMatchObject({ ok: true })
    const img = decodePng(url)
    expect(img.w).toBe(24)
    expect(img.h).toBe(24)
    expect(img.px[0]).toEqual({ hex: '#E8452E', a: 255 })
    expect(img.px.slice(1).every((p) => p.a === 0)).toBe(true)
  })

  it('isEmpty is true for a blank grid and false once a cell is painted', () => {
    const grid = Array(N * N).fill(null)
    expect(isEmpty(grid)).toBe(true)
    grid[100] = '#4AA6EE'
    expect(isEmpty(grid)).toBe(false)
  })
})
