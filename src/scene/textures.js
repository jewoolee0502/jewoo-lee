// Canvas texture painters for the 3D scene, each (ctx, w, h, …) and free of three.js.
// Ported from initScene (L1082–1088, L1143–1146, L1155, L1163–1164, L1223–1230); the mirror's
// standby and desktop drawings were reworked to match the DOM screen it crossfades with. Round 4
// (R4-2) adds the MacBook keyboard's atlas and glow and the Touch ID ring; the lid's JAY logo is
// gone (the lid carries a J geometry instead). R4-3 adds the laptop's contact shadow, the lid sheen
// band and the screen's glow on the deck.
import { OS_W, OS_H } from '../core/constants.js'
import { SCREEN, keyboardUv } from './laptop.js'

/** Night sky over Mont-Royal with its cross, the city and a strip of snow (L1082–1088). */
export function drawSky(x, w, h) {
  const g = x.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#08122A')
  g.addColorStop(1, '#2B3D6B')
  x.fillStyle = g
  x.fillRect(0, 0, w, h)
  x.fillStyle = 'rgba(255,255,255,.8)'
  for (let i = 0; i < 60; i++) x.fillRect((i * 97) % w, (i * 53) % (h * 0.5), 1.5, 1.5)
  x.fillStyle = '#16203A'
  x.beginPath()
  x.moveTo(0, h * 0.62)
  x.quadraticCurveTo(w * 0.3, h * 0.28, w * 0.62, h * 0.6)
  x.lineTo(w, h * 0.66)
  x.lineTo(w, h)
  x.lineTo(0, h)
  x.fill()
  x.strokeStyle = '#F4F7FF'
  x.shadowColor = '#BFD8FF'
  x.shadowBlur = 12
  x.lineWidth = 4
  x.beginPath()
  x.moveTo(w * 0.3, h * 0.24)
  x.lineTo(w * 0.3, h * 0.38)
  x.moveTo(w * 0.27, h * 0.29)
  x.lineTo(w * 0.33, h * 0.29)
  x.stroke()
  x.shadowBlur = 0
  const BUILDINGS = [
    [0, 0.72, 0.1], [0.09, 0.66, 0.08], [0.18, 0.76, 0.12], [0.32, 0.7, 0.07], [0.4, 0.6, 0.09],
    [0.5, 0.74, 0.1], [0.62, 0.64, 0.08], [0.71, 0.7, 0.12], [0.84, 0.58, 0.08], [0.92, 0.72, 0.1],
  ]
  for (const [bx, by, bw] of BUILDINGS) {
    x.fillStyle = '#0D1529'
    x.fillRect(bx * w, by * h, bw * w, h)
    x.fillStyle = '#FFD98A'
    for (let yy = by * h + 10; yy < h; yy += 16)
      for (let xx = bx * w + 6; xx < (bx + bw) * w - 6; xx += 12) if (((xx * 7 + yy * 3) | 0) % 5 < 2) x.fillRect(xx, yy, 5, 7)
  }
  x.fillStyle = '#F4F7FF'
  x.fillRect(0, h - 14, w, 14)
}

/** The yellow sticky note on the palm rest (L1143). */
export function drawNote(x, w, h) {
  x.fillStyle = '#FFE36E'
  x.fillRect(0, 0, w, h)
  x.fillStyle = 'rgba(0,0,0,.06)'
  x.fillRect(0, 0, w, 26)
  x.fillStyle = '#2a2f3a'
  x.font = '600 54px Caveat, cursive'
  x.fillText('type', 40, 104)
  x.fillText('"help" :)', 34, 170)
}

/** The JAY-OS 2.0 sticker on the palm rest (L1145). */
export function drawSticker(x, w, h) {
  x.fillStyle = '#122030'
  x.fillRect(0, 0, w, h)
  x.fillStyle = '#4AA6EE'
  x.font = '26px Silkscreen, monospace'
  x.fillText('JAY-OS', 12, 42)
  x.fillStyle = '#9fb2c8'
  x.font = '16px Silkscreen, monospace'
  x.fillText('2.0', 172, 42)
}

/**
 * The McGill mug's wrap-around label (R16): McGill red all round, with "McGill" in white EB
 * Garamond centred on it (the canvas centre lands on the mug's front). The size starts at 150 px
 * and shrinks by 2 px until the word is at most 30 % of the width (about the third of the mug the
 * camera sees), never below 60 px. Text only: no crest or shield.
 */
export function drawMugLabel(x, w, h) {
  x.fillStyle = '#ED1B2F'
  x.fillRect(0, 0, w, h)
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillStyle = '#FFFFFF'
  const font = (px) => `500 ${px}px "EB Garamond", Garamond, "Times New Roman", serif`
  let size = 150
  x.font = font(size)
  while (size > 60 && x.measureText('McGill').width > 0.3 * w) {
    size -= 2
    x.font = font(size)
  }
  x.fillText('McGill', w / 2, h * 0.5)
}

/** A soft round puff for the mug's steam particles: white, fading out to the edge. */
export function drawPuff(x, w, h) {
  x.clearRect(0, 0, w, h)
  const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, w, h)
}

/** A floppy's top face: shutter, label and handwriting (L1163–1164). */
export function drawFloppyLabel(x, w, h, f) {
  x.fillStyle = f.hex
  x.fillRect(0, 0, w, h)
  x.fillStyle = '#C4CCD4'
  x.fillRect(70, 0, 116, 92)
  x.fillStyle = '#5B6670'
  x.fillRect(146, 12, 24, 64)
  x.fillStyle = '#F7F7F2'
  x.fillRect(22, 112, 212, 128)
  x.fillStyle = '#2a2f3a'
  x.font = '600 46px Caveat, cursive'
  x.fillText(f.label, 34, 178)
  x.font = '16px JetBrains Mono, monospace'
  x.fillText('3½" HD · JAY', 34, 220)
}

const BIOS = ['JAY-BIOS (C) 2001-2026', 'Memory test ... OK', 'Loading JAY-OS ...']
const DESK_BLUE = '#3D98DD'

/**
 * Masks the screen's two top corners to radius r with black (arcTo paths, drawn last), so the
 * mirror matches the rounded DOM screen (`.os:not(.flat)`, SCREEN.cornerPx OS px).
 */
export function maskCorners(x, w, h, r) {
  if (!(r > 0)) return
  x.fillStyle = '#000'
  x.beginPath()
  x.moveTo(0, 0)
  x.lineTo(r, 0)
  x.arcTo(0, 0, 0, r, r)
  x.closePath()
  x.moveTo(w, 0)
  x.lineTo(w, r)
  x.arcTo(w, 0, w - r, 0, r)
  x.closePath()
  x.fill()
}

/**
 * What the WebGL screen shows under (or, without CSS3D, instead of) the live DOM (L1223–1230).
 * `wall` is the wallpaper engine's canvas; without one (or before it has a size) the
 * desktop blue stands in. The DOM screen crossfades in over this drawing while the lid opens,
 * so everything is laid out in OS px scaled by k = w/OS_W, where the DOM draws it: the standby
 * text is centre-relative like StandbyLayer's flex column (the 64px logo's baseline at OS_H/2 −
 * 0.5, the 34px "waking up" at OS_H/2 + 60.5), the BIOS lines follow `.l-boot` (padding 28/34,
 * 24px/1.25), and the desktop is only the wallpaper and the 34px menubar: drawn stand-in icons
 * would ghost against the real ones during the fade. Every state ends with the corner mask.
 */
export function drawMirror(x, w, h, osState, wall) {
  const k = w / OS_W
  const ky = (osPx) => Math.round((osPx / OS_H) * h)
  if (osState === 'on') {
    if (wall && wall.width > 0 && wall.height > 0) {
      x.imageSmoothingEnabled = false
      x.drawImage(wall, 0, 0, w, h)
      x.imageSmoothingEnabled = true
    } else {
      x.fillStyle = DESK_BLUE
      x.fillRect(0, 0, w, h)
    }
    x.fillStyle = '#F4F7FA'
    x.fillRect(0, 0, w, Math.round(34 * k))
    x.fillStyle = '#122030'
    x.font = Math.round(13 * k) + 'px Silkscreen, monospace'
    x.fillText('◆ JAY-OS', Math.round(17 * k), Math.round(21 * k))
  } else {
    x.fillStyle = '#030508'
    x.fillRect(0, 0, w, h)
  }
  if (osState === 'standby') {
    // .l-standby: radial-gradient(ellipse at center, #0b1a28, #030508 70%), farthest-corner.
    x.save()
    x.translate(w / 2, h / 2)
    x.scale(1, h / w)
    const g = x.createRadialGradient(0, 0, 0, 0, 0, (w / 2) * Math.SQRT2)
    g.addColorStop(0, '#0b1a28')
    g.addColorStop(0.7, '#030508')
    x.fillStyle = g
    x.fillRect(-w / 2, -w / 2, w, w)
    x.restore()
    x.fillStyle = '#7FD4FF'
    x.textAlign = 'center'
    x.font = Math.round(64 * k) + 'px Silkscreen, monospace'
    x.shadowColor = 'rgba(127,212,255,.6)'
    x.shadowBlur = 18 * k
    x.fillText('JAY-OS', w / 2, ky(OS_H / 2 - 0.5))
    x.shadowBlur = 0
    x.font = Math.round(34 * k) + 'px VT323, monospace'
    x.fillText('waking up …', w / 2, ky(OS_H / 2 + 60.5))
    x.textAlign = 'left'
  }
  if (osState === 'boot') {
    x.fillStyle = '#C9D6E3'
    x.font = Math.round(24 * k) + 'px VT323, monospace'
    BIOS.forEach((l, i) => x.fillText(l, Math.round(34 * k), Math.round((52 + 30 * i) * k)))
  }
  maskCorners(x, w, h, Math.round(SCREEN.cornerPx * k))
}

// ---------- the MacBook keyboard (plan-r4 M9, M11) ----------

const KEY_FONT = (px) => `600 ${px}px system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`
const CAP_SIDE = '#0c0d0f'
const CAP_TOP = '#1b1c1f'

/** A cap's top face in canvas px: the planar keyboard UVs (keyboardUv) of its inset footprint. */
function capRect(k, w, h) {
  const inset = 0.04 * Math.min(k.w, k.d)
  const [u0, v0] = keyboardUv(k.x - k.w / 2 + inset, k.z - k.d / 2 + inset)
  const [u1, v1] = keyboardUv(k.x + k.w / 2 - inset, k.z + k.d / 2 - inset)
  return { x: u0 * w, y: (1 - v0) * h, w: (u1 - u0) * w, h: (v0 - v1) * h }
}

/** Where a cap's legend goes: letters, digits, glyphs and F-keys centred; words in the lower
 *  corner toward the keyboard edge, as on a Mac. Sizes scale with the canvas width (1024 base). */
function legendOf(k, r, s) {
  const word = k.label.length > 1 && !/^F\d+$/.test(k.label)
  if (!word) {
    const px = Math.round((/^F\d+$/.test(k.label) ? 13 : /[◀▶▲▼]/.test(k.label) ? 12 : 22) * s)
    return { font: KEY_FONT(px), align: 'center', x: r.x + r.w / 2, y: r.y + r.h / 2 + px * 0.36 }
  }
  const px = Math.round((k.label.length > 7 ? 10 : 11) * s)
  const pad = 5 * s
  const right = k.x > 0
  return { font: KEY_FONT(px), align: right ? 'right' : 'left', x: right ? r.x + r.w - pad : r.x + pad, y: r.y + r.h - pad }
}

function legends(x, w, h, layout) {
  const s = w / 1024
  for (const k of layout) {
    if (k.touchId || !k.label) continue
    const l = legendOf(k, capRect(k, w, h), s)
    x.font = l.font
    x.textAlign = l.align
    x.fillText(k.label, l.x, l.y)
  }
  x.textAlign = 'left'
}

/**
 * The keycap atlas (the caps' `map`), planar over the keyboard rectangle: the cap sides' near
 * black, one rounded dark cap face per cap (the Touch ID cell is its own texture) and grey legends.
 */
export function drawKeyAtlas(x, w, h, layout) {
  x.fillStyle = CAP_SIDE
  x.fillRect(0, 0, w, h)
  x.fillStyle = CAP_TOP
  for (const k of layout) {
    if (k.touchId) continue
    const r = capRect(k, w, h)
    const rr = Math.min(r.w, r.h) * 0.14
    x.beginPath()
    x.moveTo(r.x + rr, r.y)
    x.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rr)
    x.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rr)
    x.arcTo(r.x, r.y + r.h, r.x, r.y, rr)
    x.arcTo(r.x, r.y, r.x + r.w, r.y, rr)
    x.closePath()
    x.fill()
  }
  x.fillStyle = '#9da2aa'
  legends(x, w, h, layout)
}

/** The backlight's emissive map: white legends on black (drawn at half size, so they glow soft). */
export function drawKeyGlow(x, w, h, layout) {
  x.fillStyle = '#000'
  x.fillRect(0, 0, w, h)
  x.fillStyle = '#fff'
  legends(x, w, h, layout)
}

/** The Touch ID key: a glossy black face inside a thin brushed-steel ring. */
export function drawTouchId(x, w, h) {
  x.fillStyle = '#0d0e10'
  x.fillRect(0, 0, w, h)
  x.strokeStyle = '#8d939b'
  x.lineWidth = Math.max(1, w / 20)
  x.beginPath()
  x.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2)
  x.stroke()
}

/**
 * The laptop's contact shadow (plan-r4 M21), for a 3.4 × 2.5 plane under the 3.0 × 2.1 base: a
 * rounded rect a little larger than the base, blurred. The shape is drawn a canvas width off to the left and only
 * its shadow, offset back onto the canvas, lands, so the edge is soft all round.
 */
export function drawContactShadow(x, w, h) {
  x.clearRect(0, 0, w, h)
  // 0.05 past the base's edge all round, so the darkest part of the blur peeks out from under it.
  const rw = w * (3.1 / 3.4)
  const rh = h * (2.2 / 2.5)
  const r = w * (0.12 / 3.4)
  const x0 = (w - rw) / 2 - w
  const y0 = (h - rh) / 2
  x.shadowColor = 'rgba(0,0,0,1)'
  x.shadowBlur = Math.round(w / 28)
  x.shadowOffsetX = w
  x.fillStyle = '#000'
  x.beginPath()
  x.moveTo(x0 + r, y0)
  x.arcTo(x0 + rw, y0, x0 + rw, y0 + rh, r)
  x.arcTo(x0 + rw, y0 + rh, x0, y0 + rh, r)
  x.arcTo(x0, y0 + rh, x0, y0, r)
  x.arcTo(x0, y0, x0 + rw, y0, r)
  x.closePath()
  x.fill()
  x.shadowBlur = 0
  x.shadowOffsetX = 0
}

/**
 * The lid sheen's band (plan-r4 D5): one soft white stripe across the middle, skewed into a
 * diagonal, with fully transparent edges, so a clamped texture shows nothing until the sweep's
 * offset brings the stripe onto the lid.
 */
export function drawSheen(x, w, h) {
  x.clearRect(0, 0, w, h)
  const g = x.createLinearGradient(0, 0, w, 0)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.4, 'rgba(255,255,255,0)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.6, 'rgba(255,255,255,0)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.save()
  // x' = x + 0.5·(h − y): the stripe leans right toward the top.
  x.setTransform(1, 0, -0.5, 1, 0.5 * h, 0)
  x.fillStyle = g
  x.fillRect(-h, 0, w + 2 * h, h)
  x.restore()
}

/**
 * The screen's glow on the deck (plan-r4 D4): white, brightest at the back edge (the canvas top, by
 * the screen) and fading to transparent in a half ellipse that reaches the plane's sides and front.
 * The material tints it the screen light's colour.
 */
export function drawDeckGlow(x, w, h) {
  x.clearRect(0, 0, w, h)
  x.save()
  x.scale(1, (2 * h) / w)
  const g = x.createRadialGradient(w / 2, 0, 0, w / 2, 0, w / 2)
  // Broad stops: the texture is sRGB, so mid greys come out darker in linear light.
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.8)')
  g.addColorStop(0.8, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, w, w / 2)
  x.restore()
}
