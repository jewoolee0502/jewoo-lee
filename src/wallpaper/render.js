// Pixel-city drawing (L497–500, L521–573) and the hot-spot hit test (L590). Pure apart from
// the 2D context it paints and the state/layout objects it animates in place.
import { CITY_H, MODES, CROSS, RAC, RPAL, BOAT } from './modes.js'
import { own } from '../core/own.js'

const H = CITY_H

const mix = (a, b, t) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')'

/** The prototype's R / sprite / disc helpers bound to one context. Skips redundant fillStyle writes. */
function painter(g) {
  let last = null
  const R = (c, px, py, w, h) => {
    if (c !== last) {
      g.fillStyle = c
      last = c
    }
    g.fillRect(Math.round(px), Math.round(py), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
  }
  const sprite = (rows, px, py, pal, flip) => {
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j]
      for (let i = 0; i < r.length; i++) {
        const ch = r[flip ? r.length - 1 - i : i]
        if (ch !== '.') R(pal[ch], px + i, py + j, 1, 1)
      }
    }
  }
  const disc = (cx, cy, r, c, cut) => {
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r * 0.6 && !(cut && cut(i, j))) R(c, cx + i, cy + j, 1, 1)
  }
  return { R, sprite, disc }
}

const modeOf = (mode) => own(MODES, mode) ?? MODES.night

/** The static layer (L521–538): sky, sun disc, stadium, hill, trees, buildings, clock, bridge, water. */
export function drawStatic(g, L, mode, W) {
  const m = modeOf(mode)
  const { R, disc } = painter(g)
  for (let j = 0; j < 141; j++) {
    const t = j / 141
    R(t < 0.62 ? mix(m.sky[0], m.sky[1], t / 0.62) : mix(m.sky[1], m.sky[2], (t - 0.62) / 0.38), 0, j, W, 1)
  }
  if (mode === 'golden') {
    const sx = Math.round(W * 0.52)
    disc(sx, 126, 13, '#ffe08a')
    disc(sx, 126, 9, '#fff2c0')
  }
  const o = L.oly
  R(m.far, o - 16, 114, 34, 6)
  R(m.far, o - 12, 111, 26, 3)
  for (let k = 0; k < 38; k++) R(m.far, o + 8 - k * 0.5, 114 - k, 3, 1)
  R(m.dark, o - 11, 77, 5, 2)
  for (let i = 0; i < W; i++) R(m.hill, i, L.hill[i], 1, 141 - L.hill[i])
  for (const t of L.trees) R(m.tree, t.x, L.hill[t.x] + 1, 1, t.h)
  for (const b of L.blds) {
    R(m.bld, b.x, b.top, b.w, 140 - b.top)
    R(m.edge, b.x, b.top, 1, 140 - b.top)
    if (b.kind === 'pvm') {
      R(m.bld, b.x - 3, b.top + 12, b.w + 6, 128 - b.top)
      R(m.edge, b.x - 3, b.top + 12, 1, 128 - b.top)
    }
    if (b.kind === 'step') {
      R(m.bld, b.x + 1, b.top - 5, b.w - 2, 5)
      R(m.bld, b.x + 3, b.top - 9, b.w - 6, 4)
    }
    if (b.kind === 'pyr') for (let k = 0; k < b.w / 2; k++) R('#3f8a80', b.x + k, b.top - k - 1, b.w - 2 * k, 1)
  }
  const ck = L.clock
  R(m.dark, ck, 110, 5, 30)
  R(m.dark, ck + 1, 106, 3, 4)
  R(m.dark, ck + 2, 102, 1, 4)
  R(m.spark, ck + 2, 114, 1, 1)
  const B = L.bridge
  R(m.bridge, B.x0, 112, W - B.x0, 1)
  R(m.bridge, B.x0, 120, W - B.x0, 2)
  for (let xx = B.x0; xx < W; xx += 8)
    for (let k = 0; k < 8; k++) {
      R(m.bridge, xx + (k >> 1), 120 - k, 1, 1)
      R(m.bridge, xx + 7 - (k >> 1), 120 - k, 1, 1)
    }
  for (const t of [B.t1, B.t2]) {
    R(m.bridge, t, 98, 3, 44)
    R(m.bridge, t + 1, 93, 1, 5)
  }
  R(m.quay, 0, 140, B.x0 + 4, 3)
  for (let j = 143; j < H; j++) R(mix(m.water[0], m.water[1], (j - 143) / (H - 143)), 0, j, W, 1)
  if (mode === 'day') for (let i = 0; i < B.x0; i += 5) R('#c4d2e4', i, 142, 3, 1)
}

const BAGEL_DOTS = [
  [-3, -3],
  [2, -4],
  [4, 1],
  [-4, 2],
  [0, 4],
]
const CAR_DAY = ['#e8452e', '#4aa6ee', '#ffd15c']

/**
 * One animated frame over an already drawn static layer (L541–573), in the prototype's draw
 * order. Advances `state` and the layout's moving parts by `dt` seconds; `T` is the scene clock.
 * Returns the hot spots in push order (later entries win in hitTest).
 */
export function drawFrame(g, state, L, mode, W, dt, T, rand = Math.random) {
  const m = modeOf(mode)
  const { R, sprite, disc } = painter(g)
  const hot = []

  if (mode === 'night') for (const s of L.stars) if (Math.floor(T * 1.5 + s.p) % 9) R('#ffffff', s.x, s.y, 1, 1)

  const mx = Math.round(W * 0.74)
  const my = 24
  if (mode === 'night') {
    if (state.bagel) {
      disc(mx, my, 6, '#d9a066', (i, j) => i * i + j * j < 5)
      for (const [a, b] of BAGEL_DOTS) R('#fff6e0', mx + a, my + b, 1, 1)
    } else disc(mx, my, 6, '#f4f1d8', (i, j) => (i - 3) * (i - 3) + (j + 2) * (j + 2) < 22)
    hot.push({ k: 'moon', x: mx - 8, y: my - 8, w: 17, h: 17 })
  }
  if (mode === 'day') {
    disc(mx, my, 7, '#ffe9a0')
    if (state.shades) {
      R('#122030', mx - 6, my - 2, 5, 3)
      R('#122030', mx + 1, my - 2, 5, 3)
      R('#122030', mx - 1, my - 2, 2, 1)
    }
    hot.push({ k: 'sun', x: mx - 9, y: my - 9, w: 19, h: 19 })
  }
  if (mode !== 'night') {
    const col = mode === 'day' ? '#ffffff' : '#ffc9b0'
    for (const c of L.clouds) {
      c.x += c.v * dt
      if (c.x > W + 20) c.x = -c.w - 10
      R(col, c.x, c.y, c.w, 3)
      R(col, c.x + 3, c.y - 2, c.w - 7, 2)
      R(col, c.x + 6, c.y - 4, c.w - 13, 2)
    }
  }

  const px = L.peakX
  const py = L.peakY - 13
  const cc = mode === 'day' && state.cross === 0 ? '#f2f5fb' : CROSS[state.cross]
  if (mode === 'night') {
    const hc = 'rgba(210,228,255,.35)'
    R(hc, px - 1, py - 1, 3, 1)
    R(hc, px - 4, py + 2, 9, 1)
    R(hc, px - 4, py + 4, 9, 1)
    R(hc, px - 1, py + 12, 3, 1)
  }
  R(cc, px, py, 1, 12)
  R(cc, px - 3, py + 3, 7, 1)
  hot.push({ k: 'cross', x: px - 6, y: py - 3, w: 13, h: 17 })

  state.flick -= dt
  if (mode === 'night' && state.flick <= 0 && dt > 0 && L.blds.length) {
    state.flick = 0.5
    const b = L.blds[(rand() * L.blds.length) | 0]
    const w = b.wins[(rand() * b.wins.length) | 0]
    if (w) w.v = 1 - w.v
  }
  for (let i = 0; i < L.blds.length; i++) {
    const b = L.blds[i]
    if (!state.off[i]) for (const w of b.wins) if (w.v < m.lit) R(m.win, w.x, w.y, 1, 2)
    if (b.kind) {
      const dy = b.kind === 'pyr' ? b.w / 2 + 2 : b.kind === 'step' ? 11 : 2
      R(((T * 2) | 0) % 2 ? '#ff4a4a' : '#7a1a1a', b.x + (b.w >> 1), b.top - dy, 1, 1)
    }
    if (mode !== 'day') hot.push({ k: 'bld', i, x: b.x - 1, y: b.top - 2, w: b.w + 2, h: 140 - b.top })
  }

  state.wheelV += (0.35 - state.wheelV) * Math.min(1, dt * 0.6)
  state.wheelA += state.wheelV * dt
  const WH = L.wheel
  for (const s of [-1, 1]) for (let k = 0; k < 28; k++) R(m.dark, WH.x + s * k * 0.42, WH.y + k, 1, 1)
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2
    R(m.rim, WH.x + Math.cos(a) * WH.r, WH.y + Math.sin(a) * WH.r, 1, 1)
  }
  for (let s = 0; s < 8; s++) {
    const a = state.wheelA + (s * Math.PI) / 4
    for (let r = 2; r < WH.r; r += 2) R(m.rim, WH.x + Math.cos(a) * r, WH.y + Math.sin(a) * r, 1, 1)
  }
  for (let s = 0; s < 12; s++) {
    const a = state.wheelA + (s * Math.PI) / 6
    R(s % 3 ? m.gond : '#4aa6ee', WH.x + Math.cos(a) * WH.r - 1, WH.y + Math.sin(a) * WH.r, 2, 2)
  }
  R(m.dark, WH.x - 1, WH.y - 1, 3, 3)
  hot.push({ k: 'wheel', x: WH.x - WH.r - 2, y: WH.y - WH.r - 2, w: WH.r * 2 + 4, h: WH.r * 2 + 4 })

  const B = L.bridge
  for (const c of L.cars) {
    c.x += c.v * dt
    if (c.x > W) c.x = B.x0
    if (c.x < B.x0) c.x = W - 1
    if (mode === 'day') R(CAR_DAY[c.c], c.x, 118, 3, 2)
    else R(c.v > 0 ? '#ffe7a0' : '#ff5a5a', c.x, 119, 2, 1)
  }

  state.boatV += (5 - state.boatV) * Math.min(1, dt * 0.4)
  state.boatX += state.boatV * dt
  if (state.boatX > W + 16) state.boatX = -18
  if (state.boatX > -14) {
    R('rgba(255,255,255,.45)', state.boatX - 5, 155, 5, 1)
    sprite(BOAT, state.boatX, 150, { W: mode === 'night' ? '#ffd98a' : '#f4f6fa', R: '#e8452e', K: '#26304a' })
  }
  hot.push({ k: 'boat', x: state.boatX - 2, y: 147, w: 18, h: 10 })

  if (dt > 0) for (let i = 0; i < 4; i++) R(m.spark, rand() * W, 146 + rand() * 32, 1, 1)
  if (mode === 'golden') for (let j = 146; j < H; j += 3) R('#ffe2a0', W * 0.52 - 6 + rand() * 10, j, 2 + rand() * 3, 1)

  const rc = state.rac
  if (rc.away > 0) {
    rc.away -= dt
    if (rc.away <= 0) {
      rc.x = -10
      rc.dir = 1
      rc.run = false
    }
  } else {
    rc.x += rc.dir * (rc.run ? 42 : 5) * dt
    if (rc.run) {
      if (rc.x < -14 || rc.x > W + 4) rc.away = 14
    } else {
      if (rc.x > B.x0 - 14) rc.dir = -1
      if (rc.x < 2 && rc.dir < 0) rc.dir = 1
    }
    sprite(RAC[Math.floor(T * (rc.run ? 12 : 4)) % 2], rc.x, 135, RPAL, rc.dir < 0)
    if (!rc.run) hot.push({ k: 'raccoon', x: rc.x - 3, y: 131, w: 16, h: 11 })
  }

  for (const f of L.flakes) {
    f.y += f.v * dt * m.snow
    f.x += Math.sin(T + f.d) * 0.12
    if (f.y > H) {
      f.y = -2
      f.x = rand() * W
    }
    if (m.snow > 0.3 || f.d < 2) R('#ffffff', f.x, f.y, 1, 1)
  }

  return hot
}

/** L590: the last pushed hot spot that contains p, or undefined. */
export function hitTest(hot, p) {
  for (let i = hot.length - 1; i >= 0; i--) {
    const h = hot[i]
    if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h
  }
  return undefined
}
