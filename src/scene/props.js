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
