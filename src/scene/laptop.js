// The MacBook Air's numbers (plan-r4 §1.1, M1), pure data and helpers free of three.js, so the
// tests check the geometry as numbers (as props.js does for the mug). Lengths are in scene units
// (1 unit ≈ 101 mm) and base-local unless marked "rig". The screen is the 20:13 Air panel: OS_W ×
// OS_H OS px at SCREEN.unit scene units per px; everything else about it is derived from that.
// R4-2 adds the keyboard layout and its cap buffers, the trackpad, the J monogram, the materials
// and the env map's room (laptopBuild.js turns them into meshes).
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
