// Canvas texture painters for the 3D scene, each (ctx, w, h, …) and free of three.js.
// Ported unchanged from initScene (L1082–1106, L1143–1146, L1155, L1163–1164, L1223–1230).

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

export const CORK_SLOTS = [[252, 52], [340, 52], [428, 52], [252, 160], [340, 160], [428, 160]]
const PINS = ['#E8452E', '#4AA6EE', '#FFD15C']

/**
 * The Visitor Wall corkboard with up to 6 pinned drawings (L1101–1106). The caption counts
 * approved drawings only (D16), so the examples shown while none are approved read
 * "your drawing here?".
 */
export function drawCork(x, w, h, imgs = [], approvedCount = imgs.length) {
  x.fillStyle = '#C8955E'
  x.fillRect(0, 0, w, h)
  for (let i = 0; i < 900; i++) {
    x.fillStyle = i % 2 ? 'rgba(90,50,20,.18)' : 'rgba(255,230,190,.12)'
    x.fillRect((i * 73) % w, (i * 151) % h, 2, 2)
  }
  x.fillStyle = '#2A1A0C'
  x.font = '20px Silkscreen, monospace'
  x.fillText('VISITOR WALL', 258, 34)
  CORK_SLOTS.forEach(([sx, sy], i) => {
    const im = imgs[i]
    x.save()
    x.translate(sx + 38, sy + 44)
    x.rotate((((i * 37) % 7) - 3) * 0.035)
    if (im) {
      x.fillStyle = '#fff'
      x.fillRect(-38, -38, 76, 76)
      x.imageSmoothingEnabled = false
      x.drawImage(im, -33, -33, 66, 66)
    } else {
      x.strokeStyle = 'rgba(42,26,12,.35)'
      x.setLineDash([5, 4])
      x.lineWidth = 2
      x.strokeRect(-34, -34, 68, 68)
    }
    x.fillStyle = PINS[i % 3]
    x.beginPath()
    x.arc(0, -36, 6, 0, 7)
    x.fill()
    x.restore()
  })
  x.fillStyle = '#2A1A0C'
  x.font = '15px JetBrains Mono, monospace'
  x.fillText(approvedCount > 0 ? approvedCount + ' pinned by visitors' : 'your drawing here?', 258, h - 16)
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
 * desktop blue stands in.
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
    for (let i = 0; i < 7; i++) {
      x.fillStyle = '#FFD15C'
      x.fillRect(16, 32 + i * 48, 26, 24)
    }
    for (let i = 0; i < 7; i++) {
      x.fillStyle = '#fff'
      x.fillRect(w - 42, 32 + i * 48, 26, 24)
    }
    x.fillStyle = '#FBFCFD'
    x.fillRect(120, 70, 270, 190)
    x.fillStyle = '#4AA6EE'
    x.fillRect(120, 70, 270, 20)
    x.strokeStyle = '#122030'
    x.lineWidth = 2
    x.strokeRect(120, 70, 270, 190)
    return
  }
  x.fillStyle = '#030508'
  x.fillRect(0, 0, w, h)
  if (osState === 'standby') {
    x.fillStyle = '#7FD4FF'
    x.font = '42px Silkscreen, monospace'
    x.textAlign = 'center'
    x.fillText('JAY-OS', w / 2, h / 2 - 6)
    x.font = '24px VT323, monospace'
    x.fillText('waking up …', w / 2, h / 2 + 34)
    x.textAlign = 'left'
  }
  if (osState === 'boot') {
    x.fillStyle = '#C9D6E3'
    x.font = '20px VT323, monospace'
    BIOS.forEach((l, i) => x.fillText(l, 20, 36 + i * 24))
  }
}
