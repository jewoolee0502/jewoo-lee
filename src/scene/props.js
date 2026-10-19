// Placement data for the room's props, free of three.js so it can be unit-tested (round 2, R13).

/**
 * The polaroid hangs alone on the back wall at x 1.6, mirroring the dog tags at x −1.6, high enough
 * to clear the lid's projected top edge. `card` is the print (w, h, depth), `photo` the picture
 * plane on it (w, h) raised by `photoY`; `tape` is the yellow strip holding it to the wall, in the
 * card's local space.
 */
export const POLAROID = {
  pos: [1.6, 3.05, -2.975],
  rotZ: -0.06,
  scale: 1.2,
  card: [0.64, 0.76, 0.012],
  photo: [0.54, 0.58],
  photoY: 0.06,
  tape: { size: [0.3, 0.08, 0.004], pos: [0, 0.38, 0.012], rotZ: 0.08, color: 0xffd15c, opacity: 0.85 },
}

const DEG = Math.PI / 180

/**
 * The McGill mug (R16) on the desk's left front, clear of the floppy lane and the screen. The
 * outer wall is an open cylinder (so the coffee shows) carrying the `label` canvas; `inner` is the
 * inside wall, `coffeeY` the coffee's height. The handle is a half torus of radius `R` turned so
 * it bulges out to +x, its ends on the wall at `center` ± R·scaleY; `lift` is the hover lift and
 * `glow` the hover glow strength.
 */
export const MUG = {
  pos: [-2.3, 0, 0.85],
  rTop: 0.19,
  rBot: 0.17,
  h: 0.44,
  segs: 48,
  inner: { rTop: 0.175, rBot: 0.158, h: 0.43, color: 0xc41526 },
  coffeeY: 0.38,
  color: 0xed1b2f,
  handle: { R: 0.105, tube: 0.028, arc: Math.PI, center: [0.19, 0.225, 0], rotZ: -Math.PI / 2, scaleY: 1.05 },
  lift: 0.06,
  label: { w: 1024, h: 400 },
  // plan-r2 §7 U15: the mug's own hover glow strength; GLOW_K's red emissive on the red label reads pink.
  glow: 0.1,
}

/** The outer wall's radius at height `y` above the mug's base. */
export const mugRadiusAt = (y) => MUG.rBot + ((MUG.rTop - MUG.rBot) * y) / MUG.h

/** The handle's two arc ends in mug-local (x, y) once turned upright: the bottom one, then the top. */
export function handleEnds({ R, center, scaleY }) {
  return [
    [center[0], center[1] - R * scaleY],
    [center[0], center[1] + R * scaleY],
  ]
}

/** How far out in +x the handle's arc reaches. */
export const handleBulgeX = ({ R, center }) => center[0] + R

/** The rotation about y that turns an object's local +z from `from` toward `to` ({x, z}). */
export const faceAngle = (from, to) => Math.atan2(to.x - from.x, to.z - from.z)

/**
 * The floppy drive slot on the front face of the base, in base-local coordinates (the base group
 * sits at rig z 0.35, so its front face z 1.05 is rig z 1.4). `w`×`h` is the dark mouth, `frame`
 * the bezel around it; `eject` and `led` are the (x, y) of the eject button and the drive LED.
 */
export const SLOT = { x: 0.95, y: 0.085, z: 1.05, w: 0.56, h: 0.036, frame: [0.62, 0.06, 0.012], eject: [1.32, 0.085], led: [0.6, 0.085] }

/** How far the closed lid peeks open while it is hovered at the desk. */
export const PEEK = 7 * DEG

/**
 * Invisible hit boxes (plan-r2 §7 U16) that make the thin dog tags and floppies easy to hover and
 * click. Each is local to its hotspot group: `pos` is the box centre, `size` its [w, h, d]. The tags
 * box covers both plates, the chain and the ring, and stays in front of the wall; the floppy box is
 * a little larger than the 0.5 × 0.03 × 0.52 floppy, but thinner than the stack.
 */
export const HIT = {
  tags: { size: [0.42, 1.0, 0.1], pos: [0.02, -0.44, 0] },
  floppy: { size: [0.58, 0.07, 0.6], pos: [0, 0.015, 0] },
}
