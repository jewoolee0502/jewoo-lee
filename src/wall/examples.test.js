import { describe, it, expect } from 'vitest'
import { EXAMPLES } from './examples.js'
import { PNG_PREFIX, base64ToBytes, readPngInfo } from '../lib/png.js'

describe('wall examples', () => {
  it('are 3 distinct 12×12 PNG data URLs', () => {
    expect(EXAMPLES).toHaveLength(3)
    expect(new Set(EXAMPLES).size).toBe(3)
    for (const url of EXAMPLES) {
      expect(url.startsWith(PNG_PREFIX)).toBe(true)
      const info = readPngInfo(base64ToBytes(url.slice(PNG_PREFIX.length)))
      expect(info).toMatchObject({ ok: true, width: 12, height: 12 })
    }
  })
})
