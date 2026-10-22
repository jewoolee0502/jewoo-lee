import { describe, it, expect, vi } from 'vitest'
import { inflateSync } from 'node:zlib'
import * as png from './png.js'
import { encodeIndexedPng, readPngInfo } from './png.js'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// Independent CRC-32 (poly 0xEDB88320) used to re-check the encoder's chunk CRCs.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function parseChunks(bytes) {
  const buf = Buffer.from(bytes)
  expect(buf.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  const chunks = []
  let off = 8
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('latin1', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    const crc = buf.readUInt32BE(off + 8 + len)
    chunks.push({ type, data, crc })
    off += 12 + len
  }
  return chunks
}

describe('encodeIndexedPng', () => {
  const bytes = encodeIndexedPng({
    width: 2,
    height: 2,
    indices: [0, 1, 1, 0],
    palette: [
      [255, 0, 0],
      [0, 0, 255],
    ],
    alpha: [0, 255],
  })
  const chunks = parseChunks(bytes)
  const byType = (t) => chunks.find((c) => c.type === t)

  it('writes the PNG signature and a 2x2 IHDR with bit depth 8 and colour type 3', () => {
    const ihdr = byType('IHDR').data
    expect(ihdr.readUInt32BE(0)).toBe(2)
    expect(ihdr.readUInt32BE(4)).toBe(2)
    expect(ihdr[8]).toBe(8)
    expect(ihdr[9]).toBe(3)
  })

  it('writes a 6-byte PLTE and a tRNS of [0,255]', () => {
    expect(byType('PLTE').data.length).toBe(6)
    expect(Buffer.from(byType('PLTE').data)).toEqual(Buffer.from([255, 0, 0, 0, 0, 255]))
    expect(Buffer.from(byType('tRNS').data)).toEqual(Buffer.from([0, 255]))
  })

  it('every chunk CRC matches a recomputed CRC over type and data', () => {
    for (const c of chunks) {
      const recomputed = crc32(Buffer.concat([Buffer.from(c.type, 'latin1'), c.data]))
      expect(c.crc, c.type).toBe(recomputed)
    }
  })

  it('ends with IEND', () => {
    expect(chunks[chunks.length - 1].type).toBe('IEND')
  })

  it('inflated IDAT data is the filter-0 rows of the indices', () => {
    const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => Buffer.from(c.data)))
    expect(inflateSync(idat)).toEqual(Buffer.from([0, 0, 1, 0, 1, 0]))
  })
})

describe('module surface after the Paint and Visitor Wall removal', () => {
  it('exports none of the removed drawing helpers', () => {
    for (const name of ['gridToPngDataUrl', 'validateDrawingDataUrl', 'MAX_DRAWING_BYTES', 'DRAWING_SIZE', 'base64ToBytes']) {
      expect(png, name).not.toHaveProperty(name)
    }
  })

  it('keeps the encoder, the icon helpers and readPngInfo', () => {
    for (const name of ['encodeIndexedPng', 'PNG_PREFIX', 'bytesToBase64', 'hexToRgb', 'readPngInfo']) {
      expect(png, name).toHaveProperty(name)
    }
  })
})

describe('readPngInfo', () => {
  it('returns ok:false for random bytes', () => {
    // Fixed-seed pseudo-random bytes, so the test is deterministic.
    let seed = 12345
    const junk = Uint8Array.from({ length: 64 }, () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed & 0xff
    })

    expect(readPngInfo(junk)).toMatchObject({ ok: false })
  })
})
