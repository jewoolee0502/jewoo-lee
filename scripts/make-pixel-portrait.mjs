// Precomputes the 56×72 dithered portrait (L476–478) -> public/img/jay-px.png.
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { PXPAL, retroDither } from '../src/lib/dither.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'design/img/jay.jpg')
const OUT = join(ROOT, 'public/img/jay-px.png')
const W = 56
const H = 72

async function main() {
  const meta = await sharp(SRC).metadata()
  const sw = meta.width
  const sh = Math.min(meta.height, Math.round((sw * H) / W))
  const { data } = await sharp(SRC)
    .extract({ left: 0, top: 0, width: sw, height: sh })
    .resize({ width: W, height: H, fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const out = retroDither(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), W, H, PXPAL, 28)
  await sharp(Buffer.from(out.buffer), { raw: { width: W, height: H, channels: 4 } }).png({ palette: false }).toFile(OUT)
  console.log(`public/img/jay-px.png  ${W}×${H}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
