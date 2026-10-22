import { describe, it, expect, vi } from 'vitest'
import { PXPAL, retroDither } from './dither.js'

const STRENGTH = 28

function gradientRgba(w, h) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4
      data[k] = x * 32
      data[k + 1] = y * 32
      data[k + 2] = (x + y) * 16
      data[k + 3] = 255
    }
  }
  return data
}

describe('retroDither', () => {
  it('every output pixel RGB is a member of PXPAL, and alpha is 255', () => {
    const w = 8
    const h = 8
    const out = retroDither(gradientRgba(w, h), w, h, PXPAL, STRENGTH)

    for (let k = 0; k < out.length; k += 4) {
      const isPaletteColour = PXPAL.some((p) => p[0] === out[k] && p[1] === out[k + 1] && p[2] === out[k + 2])
      expect(isPaletteColour, `pixel at ${k / 4}`).toBe(true)
      expect(out[k + 3], `alpha at ${k / 4}`).toBe(255)
    }
  })

  it('the same input gives the same output', () => {
    const w = 8
    const h = 8
    const a = retroDither(gradientRgba(w, h), w, h, PXPAL, STRENGTH)
    const b = retroDither(gradientRgba(w, h), w, h, PXPAL, STRENGTH)

    expect(Array.from(b)).toEqual(Array.from(a))
  })

  it('an all-[16,14,24] input gives an all-PXPAL[0] output', () => {
    const w = 4
    const h = 4
    const input = new Uint8ClampedArray(w * h * 4)
    for (let k = 0; k < input.length; k += 4) {
      input[k] = 16
      input[k + 1] = 14
      input[k + 2] = 24
      input[k + 3] = 255
    }

    const out = retroDither(input, w, h, PXPAL, STRENGTH)

    for (let k = 0; k < out.length; k += 4) {
      expect([out[k], out[k + 1], out[k + 2]], `pixel at ${k / 4}`).toEqual(PXPAL[0])
    }
  })
})
