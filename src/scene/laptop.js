// The MacBook Air's numbers (plan-r4 §1.1, M1), pure data and helpers free of three.js, so the
// tests check the geometry as numbers (as props.js does for the mug). Lengths are in scene units
// (1 unit ≈ 101 mm) and base-local unless marked "rig". The screen is the 20:13 Air panel: OS_W ×
// OS_H OS px at SCREEN.unit scene units per px; everything else about it is derived from that.
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
