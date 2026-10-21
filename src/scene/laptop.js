// The MacBook Air's numbers (plan-r4 §1.1, M1), pure data and helpers free of three.js, so the
// tests check the geometry as numbers (as props.js does for the mug). Lengths are in scene units
// (1 unit ≈ 101 mm) and base-local unless marked "rig". The screen is the 20:13 Air panel: OS_W ×
// OS_H OS px at SCREEN.unit scene units per px; everything else about it is derived from that.
// R4-2 adds the keyboard layout and its cap buffers, the trackpad, the J monogram, the materials
// and the env map's room; R4-3 the side floppy slot, the ports and the MagSafe cable (laptopBuild.js
// turns them into meshes; floppy.js builds its lane on SLOT).
import { OS_W, OS_H } from '../core/constants.js'

const DEG = Math.PI / 180
const UNIT = 0.00275
const SCREEN_H = OS_H * UNIT

/** The base slab: rig position, footprint and thickness, the plan corner radius and the edge bevel.
 *  `lift` is the rubber feet; the deck top is at `deckY` = lift + h. */
export const BASE = { pos: [0, 0, 0.35], w: 3.0, d: 2.1, h: 0.095, lift: 0.006, r: 0.12, bevel: 0.014, deckY: 0.101 }

/** The lid: thickness `t`, corner radius and bevel, and the bezels around the screen (chin under
 *  it, `top` over it, `side` either side). Its height is chin + SCREEN.h + top. */
export const LID = {
  w: 3.0,
  h: 0.166 + SCREEN_H + 0.065,
  t: 0.045,
  r: 0.12,
  bevel: 0.012,
  chin: 0.166,
  top: 0.065,
  side: 0.07,
}

/** The lid pivot (base-local y, z) at the back edge, and the clutch barrel under it. The closed lid
 *  front (z + LID.h) is flush with the base front (BASE.d/2). */
export const HINGE = { y: 0.107, z: -1.04, barrel: { r: 0.028, length: 2.5, pos: [0, 0.078, -1.035] } }

/** The screen on the lid (lid-local): size, centre height `cy`, the drawn mirror canvas and the
 *  top corner radius in OS px (the CSS `.os:not(.flat)` radius and drawMirror's corner mask). */
export const SCREEN = {
  unit: UNIT,
  w: OS_W * UNIT,
  h: SCREEN_H,
  cy: LID.chin + SCREEN_H / 2,
  mirror: [640, 416],
  cornerPx: 10,
}

/** The open lid's highest point (at −10°, plus its thickness), which the polaroid must clear. */
export const lidOpenTop = () => HINGE.y + LID.h * Math.cos(10 * DEG) + LID.t * Math.sin(10 * DEG)

/**
 * The rounded-rect shape to extrude (with a bevel `bevel`) so that the outer size is exactly
 * w × d × h with plan corner radius r: the bevel grows the shape by `bevel` on every side and
 * the depth by `bevel` at each end (M4).
 */
export function extrudeSpec(w, d, h, r, bevel) {
  return { w: w - 2 * bevel, d: d - 2 * bevel, depth: h - 2 * bevel, r: r - bevel }
}

// ---------- R4-2: the keyboard, the trackpad, the J and the materials ----------

const KEY_U = 2.62 / 14.5
/**
 * The ANSI Air keyboard (M8): `width` is 14.5 u, `gap` the space between caps, `top` the cap tops
 * (the caps stand on the well floor), and `travel` how far a pressed cap dips. The well is the hole in
 * the deck the caps sit in (centred at `z`, its floor at `floor`). Row r is centred at
 * z = well.z + (r − 2.5)·u: row 0 is the fn row at the back, row 5 the space bar row at the front.
 */
export const KEYBOARD = {
  width: 2.62,
  u: KEY_U,
  gap: 0.026,
  top: 0.104,
  travel: 0.005,
  well: { w: 2.68, d: 1.12, z: -0.38, floor: 0.095 },
}

/** The Force Touch trackpad on the palm rest: centre (x, z), size and corner radius. */
export const TRACKPAD = { x: 0, z: 0.62, w: 1.2, d: 0.72, r: 0.06 }

// ---------- R4-3: the side floppy slot, the ports and the MagSafe cable (M18–M20) ----------

// The slab's mid-height (BASE.lift + BASE.h/2): the slot and every port are centred on it.
const MID_Y = 0.0535

/**
 * The floppy drive slot on the right face (M20): `x` is the face plane, the mouth is centred at
 * (y, z) and is `len` long along z and `h` high, with `lip` the shade frame's margin around it. It
 * leaves 0.029 of aluminium above and below, and sits toward the back (rig z −0.1), behind the
 * floppy pile.
 */
export const SLOT = { x: BASE.w / 2, y: MID_Y, z: -0.45, len: 0.56, h: 0.036, lip: 0.012 }

/**
 * The side ports (M18), base-local z on the faces' flat parts, all centred at the slot's height.
 * Left: the MagSafe plug (`len` along z, `h` high, standing `out` proud of the face) and two USB-C
 * mouths; right: the headphone jack behind the floppy slot.
 */
export const PORTS = {
  y: MID_Y,
  left: {
    magsafe: { z: -0.78, len: 0.16, h: 0.034, out: 0.13 },
    usbc: [
      { z: -0.5, len: 0.09, h: 0.028 },
      { z: -0.32, len: 0.09, h: 0.028 },
    ],
  },
  right: { jack: { z: -0.9, r: 0.018 } },
}

/**
 * The braided MagSafe cable (M18): a tube of radius `r` on the Catmull-Rom spline through these rig
 * points (catmullRomPoint), from the plug end, left and back over the desk between the laptop and
 * the plant, then over the desk's back edge (z −1.6) and straight down behind it. The desk run is
 * at y 0.017, so the sampled tube's bottom stays just above the desk top (y 0) where the spline sags
 * between points, and the hang point sits 0.025 behind the edge so the tube clears it.
 */
export const CABLE = {
  r: 0.014,
  points: [
    [-1.63, 0.054, -0.43],
    [-1.77, 0.03, -0.47],
    [-1.94, 0.017, -0.7],
    [-1.99, 0.017, -1.15],
    [-1.96, 0.017, -1.52],
    [-1.95, 0, -1.625],
    [-1.95, -0.7, -1.64],
  ],
}

/**
 * A point `t` (0…1) along the open centripetal Catmull-Rom spline through `points` ([x, y, z]
 * each): three's CatmullRomCurve3.getPoint with its defaults, ported so the tests can check where
 * the cable's tube really runs (the scene builds the tube on three's own curve).
 */
export function catmullRomPoint(points, t) {
  const l = points.length
  let i = Math.floor((l - 1) * t)
  let w = (l - 1) * t - i
  if (w === 0 && i === l - 1) {
    i = l - 2
    w = 1
  }
  const ext = (a, b) => a.map((v, k) => 2 * v - b[k])
  const p0 = i > 0 ? points[i - 1] : ext(points[0], points[1])
  const p1 = points[i]
  const p2 = points[i + 1]
  const p3 = i + 2 < l ? points[i + 2] : ext(points[l - 1], points[l - 2])
  const dt = (a, b) => Math.pow((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2, 0.25)
  let d1 = dt(p1, p2)
  if (d1 < 1e-4) d1 = 1
  let d0 = dt(p0, p1)
  if (d0 < 1e-4) d0 = d1
  let d2 = dt(p2, p3)
  if (d2 < 1e-4) d2 = d1
  return [0, 1, 2].map((k) => {
    const [x0, x1, x2, x3] = [p0[k], p1[k], p2[k], p3[k]]
    const t1 = ((x1 - x0) / d0 - (x2 - x0) / (d0 + d1) + (x2 - x1) / d1) * d1
    const t2 = ((x2 - x1) / d1 - (x3 - x1) / (d1 + d2) + (x3 - x2) / d2) * d1
    const c2 = -3 * x1 + 3 * x2 - 2 * t1 - t2
    const c3 = 2 * x1 - 2 * x2 + t1 + t2
    return x1 + t1 * w + c2 * w * w + c3 * w * w * w
  })
}

/** The drive LED on the front face (M19), base-local x and y, so a desk viewer sees it blink. */
export const DRIVE_LED = { x: 1.2, y: MID_Y }

/** The laptop hotspot's own hover glow (silver at GLOW_K reads chalky) and its mesh budget (M22, M23). */
export const LAPTOP = { glow: 0.12, drawBudget: 20 }

// Each row as [id, label, width in u]; a bare string is a 1 u key whose id and label are itself.
// 'UPDOWN' is the inverted T's middle slot: ↑ over ↓, each half height.
const FN_ROW = [['ESCAPE', 'esc', 1.5], ...Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, `F${i + 1}`, 1]), ['TOUCHID', '', 1]]
const ROWS = [
  FN_ROW,
  [...'`1234567890-=', ['BACKSPACE', 'delete', 1.5]],
  [['TAB', 'tab', 1.5], ...'QWERTYUIOP[]', ['\\', '\\', 1]],
  [['CAPSLOCK', 'caps lock', 1.75], ...'ASDFGHJKL;\'', ['ENTER', 'return', 1.75]],
  [['SHIFT', 'shift', 2.25], ...'ZXCVBNM,./', ['SHIFT_R', 'shift', 2.25]],
  [
    ['FN', 'fn', 1],
    ['CONTROL', 'control', 1],
    ['ALT', 'option', 1],
    ['META', 'command ⌘', 1.25],
    [' ', '', 5],
    ['META_R', 'command ⌘', 1.25],
    ['ALT_R', 'option', 1],
    ['ARROWLEFT', '◀', 1],
    ['UPDOWN', '', 1],
    ['ARROWRIGHT', '▶', 1],
  ],
]
const rowZ = (r) => KEYBOARD.well.z + (r - 2.5) * KEY_U

/**
 * The 78 keyboard cells (77 caps and the Touch ID cell, `touchId: true`), back row first and left
 * to right: {id, label, row, x, z, w, d} in base-local scene units, each cell inset by gap/2 from
 * its slot.
 */
export function keyboardLayout() {
  const { u, gap, width } = KEYBOARD
  const out = []
  ROWS.forEach((row, r) => {
    let s = -width / 2
    for (const key of row) {
      const [id, label, n] = typeof key === 'string' ? [key, key, 1] : key
      // The cell from its two edges, gap/2 in from the slot's.
      const left = s + gap / 2
      const right = s + n * u - gap / 2
      const x = (left + right) / 2
      const w = right - left
      const z = rowZ(r)
      if (id === 'UPDOWN') {
        const d = u / 2 - gap
        out.push({ id: 'ARROWUP', label: '▲', row: r, x, z: z - u / 4, w, d })
        out.push({ id: 'ARROWDOWN', label: '▼', row: r, x, z: z + u / 4, w, d })
      } else {
        const cell = { id, label, row: r, x, z, w, d: u - gap }
        if (id === 'TOUCHID') cell.touchId = true
        out.push(cell)
      }
      s += n * u
    }
  })
  return out
}

// Shifted symbols press the key that carries them; the right-hand duplicates and fn are never typed.
const SHIFTED = {
  '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
  _: '-', '+': '=', '{': '[', '}': ']', '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`',
}
const UNTYPED = new Set(['SHIFT_R', 'META_R', 'ALT_R', 'FN'])

/** The layout id a KeyboardEvent `key` presses (M10): 'a' → 'A', '!' → '1', 'ArrowUp' → 'ARROWUP'. */
export function keyIdOf(key) {
  const id = SHIFTED[key] ?? String(key).toUpperCase()
  return UNTYPED.has(id) ? null : id
}

/** The keyboard rectangle the atlas covers: from the left and back cap edges, 14.5 u × 6 u. */
const KB_RECT = { x0: -KEYBOARD.width / 2 + KEYBOARD.gap / 2, z0: rowZ(0) - (KEY_U - KEYBOARD.gap) / 2, w: KEYBOARD.width, d: 6 * KEY_U }

/** Planar UVs over the keyboard rectangle: u left to right, v 1 at the back row (the canvas top). */
export const keyboardUv = (x, z) => [(x - KB_RECT.x0) / KB_RECT.w, 1 - (z - KB_RECT.z0) / KB_RECT.d]

// A cap's sides stop this far under its top, so only the four top-face vertices sit at KEYBOARD.top
// (a thousandth of a millimetre: far below a pixel at any camera distance). The bottom is lifted by
// the same amount only because float32 rounds 0.095 down, which would put it a hair under the floor.
const SIDE_EPS = 1e-5

/**
 * Frustum caps (M8): per key 6 quads of 4 vertices (top, bottom and four sloped sides, flat-shaded),
 * the top inset by 4 % of the cap's shorter side so the sides catch light. `uvOf(x, z)` maps a
 * vertex to its texture coordinate; `bottom`/`top` are the cap's y range.
 */
export function capBuffers(keys, uvOf, bottom = KEYBOARD.well.floor + SIDE_EPS, top = KEYBOARD.top) {
  const n = keys.length
  const position = new Float32Array(n * 72)
  const normal = new Float32Array(n * 72)
  const uv = new Float32Array(n * 48)
  const index = new Uint16Array(n * 36)
  const ranges = []
  let v = 0
  let ix = 0
  const quad = (pts, want) => {
    // Flat normal of the quad, wound counter-clockwise when seen from `want`'s side.
    const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]]
    const e2 = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]]
    let nx = e1[1] * e2[2] - e1[2] * e2[1]
    let ny = e1[2] * e2[0] - e1[0] * e2[2]
    let nz = e1[0] * e2[1] - e1[1] * e2[0]
    if (nx * want[0] + ny * want[1] + nz * want[2] < 0) {
      pts = [pts[0], pts[3], pts[2], pts[1]]
      ;[nx, ny, nz] = [-nx, -ny, -nz]
    }
    const len = Math.hypot(nx, ny, nz)
    for (const p of pts) {
      position.set(p, v * 3)
      normal.set([nx / len, ny / len, nz / len], v * 3)
      uv.set(uvOf(p[0], p[2]), v * 2)
      v++
    }
    const a = v - 4
    index.set([a, a + 1, a + 2, a, a + 2, a + 3], ix)
    ix += 6
  }
  for (const k of keys) {
    const start = v
    const inset = 0.04 * Math.min(k.w, k.d)
    const [bx, bz] = [k.w / 2, k.d / 2]
    const [tx, tz] = [bx - inset, bz - inset]
    const ts = top - SIDE_EPS
    const B = (sx, sz) => [k.x + sx * bx, bottom, k.z + sz * bz]
    const T = (sx, sz, y = ts) => [k.x + sx * tx, y, k.z + sz * tz]
    quad([T(-1, -1, top), T(1, -1, top), T(1, 1, top), T(-1, 1, top)], [0, 1, 0])
    quad([B(-1, -1), B(1, -1), B(1, 1), B(-1, 1)], [0, -1, 0])
    quad([B(-1, 1), B(1, 1), T(1, 1), T(-1, 1)], [0, 0, 1])
    quad([B(1, -1), B(-1, -1), T(-1, -1), T(1, -1)], [0, 0, -1])
    quad([B(-1, -1), B(-1, 1), T(-1, 1), T(-1, -1)], [-1, 0, 0])
    quad([B(1, 1), B(1, -1), T(1, -1), T(1, 1)], [1, 0, 0])
    ranges.push([start, v])
  }
  return { position, normal, uv, index, ranges }
}

/** The 77 keycaps of `layout` (the Touch ID cell is its own mesh) in one buffer set, UV-mapped over
 *  the keyboard rectangle; `ids[i]` is the cap whose vertices are `ranges[i]`. */
export function keycapBuffers(layout) {
  const caps = layout.filter((k) => !k.touchId)
  return { ...capBuffers(caps, keyboardUv), ids: caps.map((k) => k.id) }
}

/**
 * Moves one cap (its vertex `range` in a position array) rigidly in y so that its top is at
 * baseY + dy (D8). Works from the cap's current top, so repeated calls never drift.
 */
export function offsetKeyVerts(position, baseY, [s, e], dy) {
  let top = -Infinity
  for (let v = s; v < e; v++) top = Math.max(top, position[3 * v + 1])
  const shift = Math.fround(baseY + dy) - top
  if (!shift) return
  for (let v = s; v < e; v++) position[3 * v + 1] += shift
}

const PI = Math.PI
/**
 * The lid's "J" monogram (M14), 0.35 tall and centred on the origin, as Shape commands: a top bar,
 * the stem down the right, and a hook of outer radius 0.10 and inner 0.05 about (−0.02, −0.08)
 * ending in a short upturned tail. absarc is [cx, cy, r, start, end, clockwise].
 */
export const J_PATH = [
  ['moveTo', -0.04, 0.17],
  ['lineTo', 0.12, 0.17],
  ['lineTo', 0.12, 0.12],
  ['lineTo', 0.08, 0.12],
  ['lineTo', 0.08, -0.08],
  ['absarc', -0.02, -0.08, 0.1, 0, -PI, true],
  ['lineTo', -0.12, -0.04],
  ['lineTo', -0.07, -0.04],
  ['lineTo', -0.07, -0.08],
  ['absarc', -0.02, -0.08, 0.05, -PI, 0, false],
  ['lineTo', 0.03, 0.12],
  ['lineTo', -0.04, 0.12],
  ['closePath'],
]

/**
 * Laptop materials (M5). Hex values are linear in r128 (no colour management), so they come out
 * lighter through the sRGB output; they were tuned by screenshot. `noEnv` replaces the metal's
 * parameters when the env map could not be built (metal with no env renders near black); `hue` is
 * the hover glow colour.
 */
export const MATERIALS = {
  alu: { color: 0xc9c9ca, metalness: 0.9, roughness: 0.42, hue: 0xc8ccd2, noEnv: { metalness: 0.35, roughness: 0.45 } },
  shade: { color: 0x8e949c, metalness: 0.8, roughness: 0.5, noEnv: { metalness: 0.3, roughness: 0.5 } },
  dark: { color: 0x0b0c0e, metalness: 0, roughness: 0.7 },
  glass: { color: 0x878c93, metalness: 0.3, roughness: 0.22, envMapIntensity: 0.7 },
  bezel: { color: 0x07080a, metalness: 0, roughness: 0.12 },
  j: { color: 0xeef0f3, metalness: 1, roughness: 0.06, envMapIntensity: 1.3, noEnv: { metalness: 0.5, roughness: 0.3 } },
  keys: { color: 0xb4b4b4, metalness: 0, roughness: 0.6, backlight: [1, 0xf4 / 255, 0xe0 / 255] },
  touchId: { color: 0x111214, metalness: 0, roughness: 0.3, hue: 0x9fb2c8 },
  // R4-3: the braided MagSafe cable, a soft silver-white so it reads on the dark desk.
  cable: { color: 0xc4c6ca, roughness: 0.85 },
}

/**
 * The laptop's own env map (M6): a dark navy room box seen from inside, a warm panel on +x where
 * the lamp is, cool panels on −x and at the back where the window is, the lamp-lit patch of the
 * back wall behind the laptop (what the lid and the J mirror at the desk), and a dim ceiling. Each
 * panel's colour is multiplied by `k` (the PMREM target is HDR). `min` is the env intensity with
 * the lamp off (it rises to 1 with the lamp on).
 */
export const ENV = {
  min: 0.55,
  wall: 0x1f2b45,
  box: [12, 8, 12],
  panels: [
    { side: '+x', color: 0xffc27a, k: 4, size: [3, 2.4], pos: [5.9, 1.6, -2] },
    { side: '-x', color: 0x8fb0ff, k: 2, size: [3, 2.4], pos: [-5.9, 1.8, -2] },
    { side: 'back', color: 0x8fb0ff, k: 2, size: [2.6, 2.2], pos: [-3, 1.8, -5.9] },
    { side: 'back', color: 0x5a6582, k: 1, size: [5, 3], pos: [1.2, 1.4, -5.95] },
    { side: 'top', color: 0x3a4766, k: 1, size: [8, 8], pos: [0, 3.9, 0] },
  ],
}
