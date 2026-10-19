// Canvas texture painters for the 3D scene, each (ctx, w, h, …) and free of three.js.
// Ported from initScene (L1082–1088, L1143–1146, L1155, L1163–1164, L1223–1230); the mirror's
// standby and desktop drawings were reworked to match the DOM screen it crossfades with.
import { OS_W, OS_H } from '../core/constants.js'

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

/** The JAY logo on the back of the lid (L1155). */
export function drawLogo(x, w, h) {
  x.clearRect(0, 0, w, h)
  x.fillStyle = '#4AA6EE'
  x.font = '72px Silkscreen, monospace'
  x.textAlign = 'center'
  x.fillText('JAY', w / 2, 90)
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
 * What the WebGL screen shows under (or, without CSS3D, instead of) the live DOM (L1223–1230).
 * `wall` is the wallpaper engine's canvas; without one (or before it has a size) the
 * desktop blue stands in. The DOM screen crossfades in over this drawing while the lid opens,
 * so the standby text sits where the DOM draws it (StandbyLayer: 64px logo with its baseline at
 * 337 of 675 OS px, 34px "waking up" at 398) and the desktop is only the wallpaper and the
 * menubar: drawn stand-in icons would ghost against the real ones during the fade.
 */
export function drawMirror(x, w, h, osState, wall) {
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
    x.fillRect(0, 0, w, 18)
    x.fillStyle = '#122030'
    x.font = '10px Silkscreen, monospace'
    x.fillText('◆ JAY-OS', 8, 13)
    return
  }
  x.fillStyle = '#030508'
  x.fillRect(0, 0, w, h)
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
    const k = w / OS_W
    x.fillStyle = '#7FD4FF'
    x.textAlign = 'center'
    x.font = Math.round(64 * k) + 'px Silkscreen, monospace'
    x.shadowColor = 'rgba(127,212,255,.6)'
    x.shadowBlur = 18 * k
    x.fillText('JAY-OS', w / 2, Math.round((337 / OS_H) * h))
    x.shadowBlur = 0
    x.font = Math.round(34 * k) + 'px VT323, monospace'
    x.fillText('waking up …', w / 2, Math.round((398 / OS_H) * h))
    x.textAlign = 'left'
  }
  if (osState === 'boot') {
    x.fillStyle = '#C9D6E3'
    x.font = '20px VT323, monospace'
    BIOS.forEach((l, i) => x.fillText(l, 20, 36 + i * 24))
  }
}
