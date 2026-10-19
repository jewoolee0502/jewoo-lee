// Optimizes the prototype images into public/img (not part of `npm run build`).
//   node scripts/optimize-images.mjs                       all design/img/*.jpg -> public/img/projects/*.webp, jay.jpg -> public/img/jay.jpg
//   node scripts/optimize-images.mjs --one <src> <name>    one image -> public/img/projects/<name>.webp
//   node scripts/optimize-images.mjs --placeholder <name>  16:10 pixel Kanban placeholder -> public/img/projects/<name>.webp
import { mkdir, readdir } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { encodeIndexedPng, hexToRgb } from '../src/lib/png.js'
import { PAL } from '../src/lib/pixelIcons.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'design/img')
const OUT_DIR = join(ROOT, 'public/img')
const PROJ_DIR = join(OUT_DIR, 'projects')
const WIDTH = 420

async function toWebp(src, name) {
  const out = join(PROJ_DIR, `${name}.webp`)
  const info = await sharp(src).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 72 }).toFile(out)
  console.log(`${out.replace(ROOT + '/', '')}  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(1)} KB`)
}

/** 48×30 grid of three Kanban columns in PAL colours, upscaled ×8 nearest. */
async function placeholder(name) {
  const W = 48
  const H = 30
  const keys = ['D', 'K', 'S', 'W', 'B', 'Y', 'G']
  const idx = Object.fromEntries(keys.map((k, i) => [k, i]))
  const px = new Uint8Array(W * H).fill(idx.D)
  const rect = (x, y, w, h, k) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px[j * W + i] = idx[k]
  }
  rect(0, 0, W, 3, 'K') // title bar
  const accents = ['B', 'Y', 'G']
  for (let c = 0; c < 3; c++) {
    const x = 2 + c * 15
    rect(x, 5, 14, 23, 'K') // column
    rect(x + 1, 6, 12, 2, accents[c]) // column header
    const cards = [3, 2, 1][c]
    for (let n = 0; n < cards; n++) {
      rect(x + 1, 9 + n * 6, 12, 5, 'W')
      rect(x + 2, 10 + n * 6, 8, 1, 'S')
      rect(x + 2, 12 + n * 6, 5, 1, 'S')
    }
  }
  const png = encodeIndexedPng({ width: W, height: H, indices: px, palette: keys.map((k) => hexToRgb(PAL[k])) })
  const out = join(PROJ_DIR, `${name}.webp`)
  await sharp(Buffer.from(png)).resize({ width: W * 8, height: H * 8, kernel: 'nearest' }).resize({ width: WIDTH }).webp({ quality: 72 }).toFile(out)
  console.log(`${out.replace(ROOT + '/', '')}  placeholder`)
}

async function main() {
  await mkdir(PROJ_DIR, { recursive: true })
  const [flag, a, b] = process.argv.slice(2)
  if (flag === '--one') {
    if (!a || !b) throw new Error('usage: --one <src> <name>')
    return toWebp(resolve(a), b)
  }
  if (flag === '--placeholder') {
    if (!a) throw new Error('usage: --placeholder <name>')
    return placeholder(a)
  }
  const files = (await readdir(SRC_DIR)).filter((f) => extname(f).toLowerCase() === '.jpg').sort()
  for (const f of files) {
    const name = basename(f, extname(f))
    if (name === 'jay') continue
    await toWebp(join(SRC_DIR, f), name)
  }
  const jay = join(OUT_DIR, 'jay.jpg')
  const info = await sharp(join(SRC_DIR, 'jay.jpg')).resize({ width: WIDTH, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(jay)
  console.log(`public/img/jay.jpg  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(1)} KB`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
