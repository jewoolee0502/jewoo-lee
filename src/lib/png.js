// Pure-JS indexed (colour type 3, 8-bit) PNG encoder plus a small IHDR reader, used
// by the pixel icons and the asset script. Deflate uses stored blocks only, so the
// output is deterministic and needs no zlib.

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
export const PNG_PREFIX = 'data:image/png;base64,'

let crcTable = null
function getCrcTable() {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  return crcTable
}

export function crc32(bytes, start = 0, end = bytes.length) {
  const table = getCrcTable()
  let c = 0xffffffff
  for (let i = start; i < end; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function adler32(bytes) {
  let a = 1
  let b = 0
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function u32(n) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length)
  out.set(u32(data.length), 0)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  out.set(u32(crc32(out, 4, 8 + data.length)), 8 + data.length)
  return out
}

/** zlib stream (header 78 01) made of stored deflate blocks of at most 65535 bytes. */
function zlibStored(raw) {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535))
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4)
  let o = 0
  out[o++] = 0x78
  out[o++] = 0x01
  for (let b = 0; b < blocks; b++) {
    const start = b * 65535
    const len = Math.min(65535, raw.length - start)
    out[o++] = b === blocks - 1 ? 1 : 0 // BFINAL, BTYPE=00
    out[o++] = len & 0xff
    out[o++] = len >>> 8
    out[o++] = ~len & 0xff
    out[o++] = (~len >>> 8) & 0xff
    out.set(raw.subarray(start, start + len), o)
    o += len
  }
  out.set(u32(adler32(raw)), o)
  return out
}

/**
 * encodeIndexedPng({width, height, indices, palette: [[r,g,b]...], alpha?: number[]}) -> Uint8Array
 * tRNS is written only when some alpha is below 255.
 */
export function encodeIndexedPng({ width, height, indices, palette, alpha }) {
  const ihdr = new Uint8Array(13)
  ihdr.set(u32(width), 0)
  ihdr.set(u32(height), 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 3 // colour type: indexed
  // compression, filter, interlace = 0

  const plte = new Uint8Array(palette.length * 3)
  palette.forEach((c, i) => plte.set([c[0], c[1], c[2]], i * 3))

  const raw = new Uint8Array(height * (width + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0 // filter: none
    for (let x = 0; x < width; x++) raw[y * (width + 1) + 1 + x] = indices[y * width + x] || 0
  }

  const parts = [Uint8Array.from(SIGNATURE), chunk('IHDR', ihdr), chunk('PLTE', plte)]
  if (alpha && alpha.some((a) => a < 255)) parts.push(chunk('tRNS', Uint8Array.from(alpha)))
  parts.push(chunk('IDAT', zlibStored(raw)), chunk('IEND', new Uint8Array(0)))

  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export function bytesToBase64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function hasSignature(bytes) {
  if (!bytes || bytes.length < 8) return false
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) return false
  return true
}

/** readPngInfo(bytes) -> {ok, width, height, colorType}; reads the leading IHDR chunk. */
export function readPngInfo(bytes) {
  if (!hasSignature(bytes) || bytes.length < 33) return { ok: false }
  const type = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])
  const len = ((bytes[8] << 24) | (bytes[9] << 16) | (bytes[10] << 8) | bytes[11]) >>> 0
  if (type !== 'IHDR' || len !== 13) return { ok: false }
  const be = (o) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0
  return { ok: true, width: be(16), height: be(20), colorType: bytes[25] }
}
