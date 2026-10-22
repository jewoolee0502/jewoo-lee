// The pixel-city layout (L502–519), with one seeded Park–Miller stream per feature (fix B4).
// The prototype reseeded a single stream on every build, so any width change reshuffled the
// whole city. Here every feature draws from its own stream, so the same W always gives the same
// layout and a different W replays the same random sequences: the skyline grows or shrinks
// instead of re-rolling.
import { CITY_H } from './modes.js'

export const SEEDS = { trees: 11, blds: 12, wins: 13, stars: 14, flakes: 15, cars: 16, clouds: 17 }

/** Park–Miller minimal standard generator in [0, 1). */
export function rng(seed) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** Pure layout for a canvas W px wide and 180 tall. Moving parts (cars, clouds, flakes, window
 *  lights) start here and are then animated in place by drawFrame. */
export function buildLayout(W) {
  const H = CITY_H
  const L = {}

  L.hill = []
  for (let i = 0; i < W; i++) {
    const u = i / W
    L.hill.push(Math.round(140 - 60 * Math.exp(-(((u - 0.3) / 0.19) ** 2)) - 12 * Math.exp(-(((u - 0.56) / 0.14) ** 2))))
  }
  L.peakX = Math.round(W * 0.3)
  L.peakY = L.hill[L.peakX]

  const rt = rng(SEEDS.trees)
  L.trees = []
  for (let x = 0; x < W * 0.62; ) {
    // Same draw order as L505: the tree height, then the gap to the next tree.
    L.trees.push({ x, h: 2 + ((rt() * 3) | 0) })
    x += 2 + ((rt() * 3) | 0)
  }

  const rb = rng(SEEDS.blds)
  L.blds = []
  let bx = Math.round(W * 0.36)
  const end = Math.round(W * 0.7)
  while (bx < end) {
    const u = (bx - W * 0.36) / (W * 0.34)
    const w = 6 + ((rb() * 7) | 0)
    const rh = (rb() * 26) | 0
    const h = 24 + rh + Math.round(Math.sin(u * Math.PI) * 24)
    L.blds.push({ x: bx, w, rh, h, kind: '' })
    bx += w + 1
  }
  const pick = (f) => L.blds[Math.min(L.blds.length - 1, Math.floor(L.blds.length * f))]
  Object.assign(pick(0.5), { kind: 'pvm', h: 78, w: 10 })
  Object.assign(pick(0.75), { kind: 'pyr', h: 70 })
  Object.assign(pick(0.25), { kind: 'step', h: 66 })

  const rw = rng(SEEDS.wins)
  for (const b of L.blds) {
    b.top = 140 - b.h
    b.wins = []
    for (let yy = b.top + 3; yy < 137; yy += 4)
      for (let xx = b.x + 1; xx < b.x + b.w - 1; xx += 3) b.wins.push({ x: xx, y: yy, v: rw() })
  }

  L.wheel = { x: Math.round(Math.max(40, W * 0.25)), y: 112, r: 22 }
  L.clock = Math.round(Math.max(4, W * 0.035))
  L.bridge = { x0: Math.round(W * 0.72), t1: Math.round(W * 0.78), t2: Math.round(W * 0.94) }
  L.oly = Math.round(W * 0.86)

  const rs = rng(SEEDS.stars)
  L.stars = []
  for (let i = 0; i < 55; i++) L.stars.push({ x: (rs() * W) | 0, y: (rs() * 92) | 0, p: rs() * 9 })

  const rf = rng(SEEDS.flakes)
  L.flakes = []
  for (let i = 0; i < 60; i++) L.flakes.push({ x: rf() * W, y: rf() * H, v: 6 + rf() * 9, d: rf() * 6 })

  const rc = rng(SEEDS.cars)
  L.cars = []
  for (let i = 0; i < 6; i++)
    L.cars.push({ x: L.bridge.x0 + rc() * (W - L.bridge.x0), v: (i % 2 ? -1 : 1) * (9 + rc() * 7), c: i % 3 })

  const rcl = rng(SEEDS.clouds)
  L.clouds = []
  for (let i = 0; i < 4; i++) L.clouds.push({ x: rcl() * W, y: 12 + rcl() * 34, w: 14 + ((rcl() * 14) | 0), v: 1.2 + rcl() * 1.8 })

  return L
}

/** L519: a walking raccoon past the new bridge start is moved back to x 20 after a rebuild. */
export function fitRaccoon(state, L) {
  if (state.rac.x > L.bridge.x0 - 14) state.rac.x = 20
}

/** The per-session animation state `S` (L495), minus the secret tracker and hot list. */
export function createWallState() {
  return {
    wheelA: 0,
    wheelV: 0.35,
    cross: 0,
    bagel: false,
    shades: false,
    boatX: 30,
    boatV: 5,
    rac: { x: 40, dir: 1, run: false, away: 0 },
    off: {},
    flick: 0,
  }
}
