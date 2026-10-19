import { describe, it, expect, vi } from 'vitest'
import { ICON, BMP } from './pixelIcons.js'
import { readPngInfo } from './png.js'

const PREFIX = 'data:image/png;base64,'

describe('ICON', () => {
  it('has the 15 keys from BMP', () => {
    expect(Object.keys(ICON)).toHaveLength(15)
    expect(Object.keys(ICON).sort()).toEqual(Object.keys(BMP).sort())
  })

  it('every value is a PNG data URL', () => {
    for (const [key, url] of Object.entries(ICON)) {
      expect(url.startsWith(PREFIX), key).toBe(true)
    }
  })

  it('every icon decodes to a 12x12 PNG', () => {
    for (const [key, url] of Object.entries(ICON)) {
      const bytes = new Uint8Array(Buffer.from(url.slice(PREFIX.length), 'base64'))
      expect(readPngInfo(bytes), key).toMatchObject({ ok: true, width: 12, height: 12 })
    }
  })
})
