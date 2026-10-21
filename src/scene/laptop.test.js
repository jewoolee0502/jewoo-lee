// Round 4 Phase R4-1 and R4-2 TEST LIST: scene/laptop.test.js. laptop.js is pure data and helpers (no three),
// so the MacBook Air proportions and the 20:13 screen are checked as numbers, as props.test does.
// The contracts (plan-r4 §1.1): SCREEN {unit, w, h, cy, mirror: [w, h], cornerPx}, with lid-local cy;
// LID {w, h, t, r, bevel, chin, top, side}; BASE {pos (rig), w, d, h, lift, r, bevel, deckY};
// HINGE {y, z, barrel: {r, length, pos}}, base-local; lidOpenTop() is the open lid's top y;
// extrudeSpec(w, d, h, r, bevel) is the rounded-rect shape {w, d, depth, r} whose bevelled extrude
// is exactly w × d × h.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OS_W, OS_H } from '../core/constants.js'
import { SCREEN, LID, BASE, HINGE, lidOpenTop, extrudeSpec } from './laptop.js'
// R4-2 names are read through the namespace, so a missing export fails only the test that uses it.
import * as LP from './laptop.js'
import { widePose } from './sceneMath.js'
import { PEEK } from './props.js'

const DEG = Math.PI / 180

describe('scene/laptop (R4-1 geometry module)', () => {
  it('(a) imports nothing from three: it reads like props.js, as pure data', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/scene/laptop.js'), 'utf8')
    expect(src).not.toMatch(/from\s+['"]three/)
    expect(src).not.toMatch(/require\(\s*['"]three/)
  })

  it('(b) the OS logical size is 1040 × 676, the 2560 × 1664 Air panel at 20:13', () => {
    expect(OS_W).toBe(1040)
    expect(OS_H).toBe(676)
    expect(OS_W / OS_H).toBeCloseTo(2560 / 1664, 12)
  })

  it('(c) SCREEN is 2.86 × 1.859 scene units at 0.00275 per OS px, with the OS aspect', () => {
    expect(SCREEN.unit).toBeCloseTo(0.00275, 12)
    expect(SCREEN.w).toBeCloseTo(OS_W * SCREEN.unit, 12)
    expect(SCREEN.h).toBeCloseTo(OS_H * SCREEN.unit, 12)
    expect(SCREEN.w).toBeCloseTo(2.86, 9)
    expect(SCREEN.h).toBeCloseTo(1.859, 9)
    expect(SCREEN.w / SCREEN.h).toBeCloseTo(OS_W / OS_H, 12)
  })

  it('(d) the mirror canvas is 640 × 416 with the OS aspect, and the top corners round 10 OS px', () => {
    expect(SCREEN.mirror[0] / SCREEN.mirror[1]).toBeCloseTo(OS_W / OS_H, 12)
    expect(SCREEN.mirror).toEqual([640, 416])
    expect(SCREEN.cornerPx).toBe(10)
  })

  it('(e) LID.h = chin + SCREEN.h + top; the side bezels are 0.05 to 0.1; the top bezel is no taller than the chin', () => {
    expect(LID.h).toBeCloseTo(LID.chin + SCREEN.h + LID.top, 9)
    expect(LID.h).toBeCloseTo(2.09, 9)
    const side = (LID.w - SCREEN.w) / 2
    expect(side).toBeGreaterThanOrEqual(0.05)
    expect(side).toBeLessThanOrEqual(0.1)
    expect(LID.top).toBeLessThanOrEqual(LID.chin)
  })

  it('(f) BASE is 3.0 × 2.1 at [0, 0, 0.35] and 0.09 to 0.10 thick; LID is 0.04 to 0.05 thick; the closed height is at most 0.16', () => {
    expect(BASE.w).toBe(3)
    expect(BASE.d).toBe(2.1)
    expect(BASE.pos).toEqual([0, 0, 0.35])
    expect(BASE.h).toBeGreaterThanOrEqual(0.09)
    expect(BASE.h).toBeLessThanOrEqual(0.1)
    expect(LID.t).toBeGreaterThanOrEqual(0.04)
    expect(LID.t).toBeLessThanOrEqual(0.05)
    const closed = HINGE.y + LID.t
    expect(closed).toBeLessThanOrEqual(0.16)
    expect(closed).toBeCloseTo(0.152, 3)
  })

  it('(f2) the deck top sits on the feet: BASE.deckY = BASE.lift + BASE.h (0.101)', () => {
    expect(BASE.deckY).toBeCloseTo(BASE.lift + BASE.h, 12)
    expect(BASE.deckY).toBeCloseTo(0.101, 12)
  })

  it('(g) the closed lid front is flush with the base front: HINGE.z + LID.h is within 0.02 of BASE.d/2', () => {
    const front = HINGE.z + LID.h
    expect(front).toBeGreaterThanOrEqual(BASE.d / 2 - 0.02)
    expect(front).toBeLessThanOrEqual(BASE.d / 2)
  })

  it('(h) the hinge barrel top is below the pivot: barrel.pos.y + barrel.r < HINGE.y', () => {
    const top = HINGE.barrel.pos[1] + HINGE.barrel.r
    expect(top).toBeLessThan(HINGE.y)
    expect(HINGE.barrel.r).toBeCloseTo(0.028, 9)
    expect(HINGE.barrel.length).toBeCloseTo(2.5, 9)
  })

  it('(i) lidOpenTop() = HINGE.y + LID.h·cos 10° + LID.t·sin 10°, about 2.173, and below 2.3', () => {
    const formula = HINGE.y + LID.h * Math.cos(10 * DEG) + LID.t * Math.sin(10 * DEG)
    expect(lidOpenTop()).toBeCloseTo(formula, 9)
    expect(lidOpenTop()).toBeCloseTo(2.173, 3)
    expect(lidOpenTop()).toBeLessThan(2.3)
  })

  it('(j) SCREEN.cy = LID.chin + SCREEN.h/2, about 1.0955', () => {
    expect(SCREEN.cy).toBeCloseTo(LID.chin + SCREEN.h / 2, 12)
    expect(SCREEN.cy).toBeCloseTo(1.0955, 9)
  })

  it('(k) extrudeSpec(3, 2.1, 0.095, 0.12, 0.014) gives an outer size of exactly (3, 2.1, 0.095)', () => {
    const b = 0.014
    const s = extrudeSpec(3, 2.1, 0.095, 0.12, b)
    // The shape is inset by the bevel on every side, so the bevel adds it back to give the outer size.
    expect(s.w + 2 * b).toBeCloseTo(3, 12)
    expect(s.d + 2 * b).toBeCloseTo(2.1, 12)
    expect(s.depth + 2 * b).toBeCloseTo(0.095, 12)
    expect(s.r).toBeCloseTo(0.12 - b, 12)
  })
})

// ---------- R4-2: the keyboard, key ids, keycap buffers, J, materials, env and trackpad ----------
// The contracts (plan-r4 §1.2 M4–M14, M8, M10): KEYBOARD {width, u, gap, top, travel, well:{w, d, z, floor}}
// in base-local scene units; keyboardLayout() → 78 entries {id, label, row, x, z, w, d, touchId?}
// (77 caps and the Touch ID cell, which has touchId: true); keycapBuffers(layout) skips touchId and
// returns {position, normal, uv, index, ranges, ids} (24 vertices per cap, ranges[i] = [24i, 24i+24),
// ids[i] the cap id in layout order); offsetKeyVerts(position, baseY, range, dy) moves one range's y;
// J_PATH is [op, ...args] with moveTo/lineTo [x, y], absarc [cx, cy, r, start, end, clockwise] and
// closePath; MATERIALS, ENV, LAPTOP, TRACKPAD as in the tests below.

const ids = (layout) => layout.map((k) => k.id)
const layoutOf = () => LP.keyboardLayout()
const capsOf = () => layoutOf().filter((k) => !k.touchId)
const edgeGapOk = (a, b, gap) => {
  const hgap = Math.abs(a.x - b.x) - (a.w + b.w) / 2
  const vgap = Math.abs(a.z - b.z) - (a.d + b.d) / 2
  return Math.max(hgap, vgap) >= gap - 1e-9
}

describe('scene/laptop keyboard layout (R4-2, M8)', () => {
  it('has 77 caps and one Touch ID cell (78 entries) in six rows, 0 (fn row, back) to 5 (bottom, front)', () => {
    const all = layoutOf()
    expect(all).toHaveLength(78)
    expect(all.filter((k) => k.touchId)).toHaveLength(1)
    expect(capsOf()).toHaveLength(77)
    expect([...new Set(all.map((k) => k.row))].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('KEYBOARD.width is 14.5 u, and every row spans the keyboard width to within the gap', () => {
    expect(LP.KEYBOARD.width).toBeCloseTo(14.5 * LP.KEYBOARD.u, 4)
    expect(LP.KEYBOARD.u).toBeCloseTo(0.18069, 5)
    for (let r = 0; r < 6; r++) {
      const ks = layoutOf().filter((k) => k.row === r)
      const left = Math.min(...ks.map((k) => k.x - k.w / 2))
      const right = Math.max(...ks.map((k) => k.x + k.w / 2))
      expect(Math.abs(right - left - LP.KEYBOARD.width), `row ${r} span`).toBeLessThanOrEqual(LP.KEYBOARD.gap)
    }
  })

  it('no two cells overlap: every pair is separated by at least KEYBOARD.gap on one axis', () => {
    const all = layoutOf()
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(edgeGapOk(all[i], all[j], LP.KEYBOARD.gap), `${all[i].id} vs ${all[j].id}`).toBe(true)
      }
    }
  })

  it('every cell lies inside the well: 2.68 × 1.12 centred at z −0.38', () => {
    const well = LP.KEYBOARD.well
    expect(well.w).toBeCloseTo(2.68, 9)
    expect(well.d).toBeCloseTo(1.12, 9)
    expect(well.z).toBeCloseTo(-0.38, 9)
    expect(well.floor).toBeCloseTo(0.095, 9)
    for (const k of layoutOf()) {
      expect(Math.abs(k.x) + k.w / 2, k.id).toBeLessThanOrEqual(well.w / 2 + 1e-9)
      expect(k.z - k.d / 2, k.id).toBeGreaterThanOrEqual(well.z - well.d / 2 - 1e-9)
      expect(k.z + k.d / 2, k.id).toBeLessThanOrEqual(well.z + well.d / 2 + 1e-9)
    }
  })

  it('ids are unique and the layout has every named key, with the right-hand duplicates and FN', () => {
    const all = ids(layoutOf())
    expect(new Set(all).size).toBe(all.length)
    const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
    const digits = [...'0123456789']
    const punct = ['`', '-', '=', '[', ']', '\\', ';', "'", ',', '.', '/']
    const fns = Array.from({ length: 12 }, (_, i) => `F${i + 1}`)
    const named = ['ENTER', 'BACKSPACE', 'ESCAPE', 'TAB', 'CAPSLOCK', 'SHIFT', 'CONTROL', 'ALT', 'META', 'ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT']
    const extra = ['SHIFT_R', 'META_R', 'ALT_R', 'FN', ' ']
    for (const id of [...letters, ...digits, ...punct, ...fns, ...named, ...extra]) {
      expect(all, `has ${JSON.stringify(id)}`).toContain(id)
    }
  })

  it('Touch ID is the top-right cell: fn row, the largest x and the smallest z of the layout', () => {
    const all = layoutOf()
    const touch = all.find((k) => k.touchId)
    expect(touch.row).toBe(0)
    expect(touch.x).toBeCloseTo(1.2197, 3)
    expect(touch.z).toBeCloseTo(-0.8317, 3)
    expect(touch.x).toBe(Math.max(...all.map((k) => k.x)))
    expect(touch.z).toBe(Math.min(...all.map((k) => k.z)))
  })

  it('the space bar is the widest cap and sits on the bottom row', () => {
    const caps = capsOf()
    const space = caps.find((k) => k.id === ' ')
    expect(space.row).toBe(5)
    expect(space.w).toBeCloseTo(5 * LP.KEYBOARD.u - LP.KEYBOARD.gap, 3)
    for (const k of caps) if (k.id !== ' ') expect(k.w).toBeLessThan(space.w)
  })

  it('the inverted T: up and down share one x slot, each half height; left and right are full height, one either side', () => {
    const at = (id) => layoutOf().find((k) => k.id === id)
    const up = at('ARROWUP')
    const down = at('ARROWDOWN')
    const left = at('ARROWLEFT')
    const right = at('ARROWRIGHT')
    const space = at(' ')
    expect(up.x).toBeCloseTo(down.x, 9)
    expect(left.x).toBeLessThan(up.x)
    expect(right.x).toBeGreaterThan(up.x)
    expect(up.z).toBeLessThan(down.z)
    expect(left.z).toBeCloseTo(right.z, 9)
    expect(left.z).toBeCloseTo(space.z, 9)
    expect(left.d).toBeCloseTo(space.d, 9)
    expect(Math.abs(up.d - left.d / 2)).toBeLessThanOrEqual(LP.KEYBOARD.gap)
    expect(Math.abs(down.d - left.d / 2)).toBeLessThanOrEqual(LP.KEYBOARD.gap)
    expect(up.w).toBeCloseTo(left.w, 9)
  })

  it('the trackpad is centred, sits at least 0.06 behind the well and keeps at least 0.05 in front of the base', () => {
    const pad = LP.TRACKPAD
    expect(pad.x).toBe(0)
    expect(pad.w).toBeCloseTo(1.2, 9)
    expect(pad.d).toBeCloseTo(0.72, 9)
    expect(pad.z).toBeCloseTo(0.62, 9)
    expect(pad.r).toBeCloseTo(0.06, 9)
    const wellFront = LP.KEYBOARD.well.z + LP.KEYBOARD.well.d / 2
    const padBack = pad.z - pad.d / 2
    expect(padBack - wellFront).toBeGreaterThanOrEqual(0.06)
    const padFront = pad.z + pad.d / 2
    expect(BASE.d / 2 - padFront).toBeGreaterThanOrEqual(0.05)
  })
})

describe('scene/laptop keyIdOf (R4-2, M10)', () => {
  it('maps lower and upper case letters to the upper-case id', () => {
    expect(LP.keyIdOf('a')).toBe('A')
    expect(LP.keyIdOf('Q')).toBe('Q')
  })

  it('maps shifted symbols to the key that carries them', () => {
    expect(LP.keyIdOf('!')).toBe('1')
    expect(LP.keyIdOf('?')).toBe('/')
    expect(LP.keyIdOf('{')).toBe('[')
    expect(LP.keyIdOf('_')).toBe('-')
  })

  it('keeps the space and the named keys, with e.key upper-cased', () => {
    expect(LP.keyIdOf(' ')).toBe(' ')
    expect(LP.keyIdOf('Enter')).toBe('ENTER')
    expect(LP.keyIdOf('ArrowUp')).toBe('ARROWUP')
    expect(LP.keyIdOf('Meta')).toBe('META')
    expect(LP.keyIdOf('Escape')).toBe('ESCAPE')
    expect(LP.keyIdOf('F5')).toBe('F5')
  })

  it('"Dead" is not a layout id, so pressing it does nothing', () => {
    expect(ids(capsOf())).not.toContain(LP.keyIdOf('Dead'))
  })

  it('the right-hand duplicates and FN are never produced by a key press', () => {
    for (const k of ['Shift', 'Alt', 'Meta', 'Fn']) expect(['SHIFT_R', 'ALT_R', 'META_R', 'FN']).not.toContain(LP.keyIdOf(k))
  })
})

describe('scene/laptop keycapBuffers (R4-2, M8 and M9)', () => {
  const buf = () => LP.keycapBuffers(layoutOf())

  it('has 24 vertices and 36 indices per cap, contiguous ranges, and one id per cap in layout order', () => {
    const out = buf()
    expect(out.ranges).toHaveLength(77)
    expect(out.ids).toEqual(capsOf().map((k) => k.id))
    out.ranges.forEach((r, i) => expect(r).toEqual([24 * i, 24 * i + 24]))
    expect(out.position).toHaveLength(77 * 24 * 3)
    expect(out.normal).toHaveLength(77 * 24 * 3)
    expect(out.uv).toHaveLength(77 * 24 * 2)
    expect(out.index).toHaveLength(77 * 36)
  })

  it('normals are unit length', () => {
    const { normal } = buf()
    for (let v = 0; v < normal.length / 3; v++) {
      const len = Math.hypot(normal[3 * v], normal[3 * v + 1], normal[3 * v + 2])
      expect(len, `vertex ${v}`).toBeCloseTo(1, 5)
    }
  })

  it('every cap top is at KEYBOARD.top (0.104), below HINGE.y − 0.002, and every cap bottom is at or above the well floor', () => {
    const out = buf()
    expect(LP.KEYBOARD.top).toBeCloseTo(0.104, 9)
    expect(LP.KEYBOARD.top).toBeLessThan(HINGE.y - 0.002)
    out.ranges.forEach(([s, e], i) => {
      let top = -Infinity
      let bottom = Infinity
      for (let v = s; v < e; v++) {
        top = Math.max(top, out.position[3 * v + 1])
        bottom = Math.min(bottom, out.position[3 * v + 1])
      }
      expect(top, `cap ${out.ids[i]} top`).toBeCloseTo(LP.KEYBOARD.top, 6)
      expect(bottom, `cap ${out.ids[i]} bottom`).toBeGreaterThanOrEqual(LP.KEYBOARD.well.floor - 1e-9)
    })
  })

  it('each top face has four vertices at the cap top, and their u lies inside the key footprint in the keyboard rectangle', () => {
    const out = buf()
    const layout = capsOf()
    const left = Math.min(...layoutOf().map((k) => k.x - k.w / 2))
    out.ranges.forEach(([s, e], i) => {
      const k = layout[i]
      const topVerts = []
      for (let v = s; v < e; v++) if (Math.abs(out.position[3 * v + 1] - LP.KEYBOARD.top) < 1e-6) topVerts.push(v)
      expect(topVerts, `cap ${k.id} top verts`).toHaveLength(4)
      const centre = (k.x - left) / LP.KEYBOARD.width
      const half = k.w / 2 / LP.KEYBOARD.width
      for (const v of topVerts) {
        const u = out.uv[2 * v]
        expect(u, `cap ${k.id} u`).toBeGreaterThanOrEqual(centre - half - 1e-6)
        expect(u, `cap ${k.id} u`).toBeLessThanOrEqual(centre + half + 1e-6)
        expect(out.uv[2 * v + 1]).toBeGreaterThanOrEqual(-1e-6)
        expect(out.uv[2 * v + 1]).toBeLessThanOrEqual(1 + 1e-6)
      }
    })
  })

  it('the cap top normal points up (+y)', () => {
    const out = buf()
    const [s, e] = out.ranges[0]
    for (let v = s; v < e; v++) {
      if (Math.abs(out.position[3 * v + 1] - LP.KEYBOARD.top) < 1e-6) expect(out.normal[3 * v + 1]).toBeCloseTo(1, 5)
    }
  })
})

describe('scene/laptop offsetKeyVerts (R4-2, D8)', () => {
  it('moves only the given range, rigidly, so its top ends at baseY + dy and x and z are untouched', () => {
    const out = LP.keycapBuffers(layoutOf())
    const pos = Float32Array.from(out.position)
    const before = Float32Array.from(pos)
    const range = out.ranges[5]
    const [s, e] = range
    LP.offsetKeyVerts(pos, LP.KEYBOARD.top, range, -0.003)
    const n = pos.length / 3
    for (let v = 0; v < n; v++) {
      if (v >= s && v < e) {
        expect(pos[3 * v + 1] - before[3 * v + 1]).toBeCloseTo(-0.003, 6)
      } else {
        expect(pos[3 * v + 1], `vertex ${v} outside the range`).toBe(before[3 * v + 1])
      }
      expect(pos[3 * v]).toBe(before[3 * v])
      expect(pos[3 * v + 2]).toBe(before[3 * v + 2])
    }
    let top = -Infinity
    for (let v = s; v < e; v++) top = Math.max(top, pos[3 * v + 1])
    expect(top).toBeCloseTo(LP.KEYBOARD.top - 0.003, 6)
  })

  it('dy 0 leaves the buffer exactly as it was', () => {
    const out = LP.keycapBuffers(layoutOf())
    const pos = Float32Array.from(out.position)
    const before = Float32Array.from(pos)
    LP.offsetKeyVerts(pos, LP.KEYBOARD.top, out.ranges[0], 0)
    expect(pos).toEqual(before)
  })
})

describe('scene/laptop J_PATH (R4-2, M14)', () => {
  // The path's points: the move and line points, and samples along each absarc.
  const pointsOf = (path) => {
    const pts = []
    for (const op of path) {
      if (op[0] === 'moveTo' || op[0] === 'lineTo') pts.push([op[1], op[2]])
      if (op[0] === 'absarc') {
        const [, cx, cy, r, a0, a1] = op
        for (let i = 0; i <= 64; i++) {
          const a = a0 + ((a1 - a0) * i) / 64
          pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
        }
      }
    }
    return pts
  }
  const box = (pts) => {
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
  }

  it('is closed, and uses only moveTo, lineTo, absarc and closePath', () => {
    const path = LP.J_PATH
    expect(path[0][0]).toBe('moveTo')
    expect(path.at(-1)[0]).toBe('closePath')
    for (const op of path) expect(['moveTo', 'lineTo', 'absarc', 'closePath']).toContain(op[0])
  })

  it('is 0.3 to 0.4 tall, centred within 0.02 of the origin, and fits the lid back with a 0.3 margin', () => {
    const b = box(pointsOf(LP.J_PATH))
    const height = b.maxY - b.minY
    const width = b.maxX - b.minX
    expect(height).toBeGreaterThanOrEqual(0.3)
    expect(height).toBeLessThanOrEqual(0.4)
    expect(Math.abs((b.minX + b.maxX) / 2)).toBeLessThanOrEqual(0.02)
    expect(Math.abs((b.minY + b.maxY) / 2)).toBeLessThanOrEqual(0.02)
    expect(width).toBeLessThanOrEqual(LID.w - 0.6)
    expect(height).toBeLessThanOrEqual(LID.h - 0.6)
  })
})

describe('scene/laptop MATERIALS and ENV (R4-2, M5 and M6)', () => {
  const hexLum = (hex) => (((hex >> 16) & 255) * 0.2126 + ((hex >> 8) & 255) * 0.7152 + (hex & 255) * 0.0722) / 255

  it('aluminium is metal (0.9) with roughness 0.42, and its no-env fallback is 0.35 / 0.45 with metalness at most 0.5', () => {
    const m = LP.MATERIALS
    expect(m.alu.metalness).toBeCloseTo(0.9, 9)
    expect(m.alu.roughness).toBeCloseTo(0.42, 9)
    expect(m.alu.noEnv.metalness).toBeCloseTo(0.35, 9)
    expect(m.alu.noEnv.metalness).toBeLessThanOrEqual(0.5)
    expect(m.alu.noEnv.roughness).toBeCloseTo(0.45, 9)
  })

  it('shade is a lighter matt metal (0.5), dark parts are very dark matt (0.7), and the bezel is glossy and black', () => {
    const m = LP.MATERIALS
    expect(m.shade.roughness).toBeCloseTo(0.5, 9)
    expect(m.dark.roughness).toBeCloseTo(0.7, 9)
    expect(hexLum(m.dark.color)).toBeLessThan(0.1)
    expect(m.bezel.roughness).toBeCloseTo(0.12, 9)
    expect(hexLum(m.bezel.color)).toBeLessThan(0.1)
  })

  it('the trackpad glass is a 0.3 metal, roughness 0.22', () => {
    expect(LP.MATERIALS.glass.metalness).toBeCloseTo(0.3, 9)
    expect(LP.MATERIALS.glass.roughness).toBeCloseTo(0.22, 9)
  })

  it('the env wall is dark navy, with a warm panel on +x (the lamp) and cool panels on −x and at the back (the window)', () => {
    const env = LP.ENV
    expect(env.min).toBeCloseTo(0.55, 9)
    expect(hexLum(env.wall)).toBeLessThan(0.2)
    const panel = (side) => env.panels.find((p) => p.side === side)
    const warm = panel('+x')
    const cool = panel('-x')
    expect(warm, 'panel on +x').toBeDefined()
    expect(cool, 'panel on -x').toBeDefined()
    const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]
    const [wr, , wb] = rgb(warm.color)
    const [cr, , cb] = rgb(cool.color)
    expect(wr, 'warm panel is red-heavy').toBeGreaterThan(wb)
    expect(cb, 'cool panel is blue-heavy').toBeGreaterThan(cr)
  })
})

// R4-4: from the desk camera the polished J (roughness 0.06) mirrors one direction of the env, which
// used to land on the dim back wall, so it read faint. A soft warm-white glint panel now sits there.
describe('scene/laptop the J mirrors a bright env panel at the desk (R4-4, M14)', () => {
  const hexLum = (hex) => (((hex >> 16) & 255) * 0.2126 + ((hex >> 8) & 255) * 0.7152 + (hex & 255) * 0.0722) / 255
  /**
   * The env panel the lid centre mirrors from the camera at `wp`, with the lid closed and peeking
   * open by `peek` rad (the hinge turns to π/2 − peek), or null (the wall).
   */
  const mirrored = (wp, peek = 0) => {
    // The lid-local centre of the lid back (0, h/2, −t) and its normal (0, 0, −1), turned about x by
    // the hinge (rig coordinates; the rig sits at the origin).
    const a = Math.PI / 2 - peek
    const [c, s] = [Math.cos(a), Math.sin(a)]
    const [ly, lz] = [LID.h / 2, -LID.t]
    const j = [BASE.pos[0], HINGE.y + ly * c - lz * s, BASE.pos[2] + HINGE.z + ly * s + lz * c]
    const nrm = [0, s, -c]
    const d0 = j.map((v, i) => v - wp[i])
    const d = d0.map((v) => v / Math.hypot(...d0))
    const dn = d[0] * nrm[0] + d[1] * nrm[1] + d[2] * nrm[2]
    const r = d.map((v, i) => v - 2 * dn * nrm[i])
    // The env map is looked up by direction only, as seen from the env scene's origin.
    let best = null
    for (const p of LP.ENV.panels.filter((q) => q.side === 'back')) {
      const t = p.pos[2] / r[2]
      if (!(t > 0)) continue
      const [x, y] = [r[0] * t, r[1] * t]
      if (Math.abs(x - p.pos[0]) > p.size[0] / 2 || Math.abs(y - p.pos[1]) > p.size[1] / 2) continue
      if (!best || t < best.t) best = { t, p }
    }
    return best?.p ?? null
  }

  it.each([
    ['1440 × 900', 1440 / 900],
    ['1280 × 720', 1280 / 720],
    ['844 × 390', 844 / 390],
    ['390 × 844', 390 / 844],
  ])('at %s the J mirrors a panel at least 0.75 bright (luminance × k), brighter than the wall', (_, aspect) => {
    const p = mirrored(widePose(aspect).wp)
    expect(p, 'a back panel').not.toBeNull()
    expect(hexLum(p.color) * p.k).toBeGreaterThanOrEqual(0.75)
    expect(hexLum(p.color) * p.k).toBeGreaterThan(hexLum(LP.ENV.wall))
  })

  it.each([
    ['1440 × 900', 1440 / 900],
    ['390 × 844', 390 / 844],
  ])('at %s the J still mirrors a panel at least 0.75 bright with the lid peeking open by PEEK, so the hover does not turn it faint', (_, aspect) => {
    const p = mirrored(widePose(aspect).wp, PEEK)
    expect(p, 'a back panel').not.toBeNull()
    expect(hexLum(p.color) * p.k).toBeGreaterThanOrEqual(0.75)
  })

  // With no env map (PMREM failed) a metal J reflects nothing and read as a faint grey ghost on the
  // silver lid; its fallback is a near-dielectric gloss, so its light colour shows under the lamp.
  it('the J no-env fallback keeps it readable: metalness at most 0.2 (less than the aluminium fallback) and still glossy (roughness at most 0.3)', () => {
    const { j, alu } = LP.MATERIALS
    expect(j.noEnv.metalness).toBeLessThanOrEqual(0.2)
    expect(j.noEnv.metalness).toBeLessThan(alu.noEnv.metalness)
    expect(j.noEnv.roughness).toBeLessThanOrEqual(0.3)
  })

  it('the glint panel is warm white and stays in range: k at most 1, so the J does not clip past white', () => {
    const p = mirrored(widePose(1440 / 900).wp)
    const [r, , b] = [(p.color >> 16) & 255, (p.color >> 8) & 255, p.color & 255]
    expect(r).toBeGreaterThanOrEqual(b)
    expect(p.k).toBeLessThanOrEqual(1)
  })
})

describe('scene/laptop open lid clears the hinge barrel (R4-2, M16)', () => {
  it('at −10° every point of the lid bottom face (lid-local y 0, z −t…0) is farther than barrel.r from the barrel axis', () => {
    const a = -10 * DEG
    const { barrel } = HINGE
    for (let i = 0; i <= 40; i++) {
      const z = -LID.t * (i / 40)
      // The hinge turns lid-local (y, z) about x, then sits at (HINGE.y, HINGE.z).
      const y = HINGE.y - z * Math.sin(a)
      const zz = HINGE.z + z * Math.cos(a)
      const d = Math.hypot(y - barrel.pos[1], zz - barrel.pos[2])
      expect(d, `lid bottom at local z ${z.toFixed(4)}`).toBeGreaterThan(barrel.r)
    }
  })
})

describe('scene/laptop LAPTOP constants (R4-2, M22 and M23)', () => {
  it('the laptop hover glow is 0.12 and the draw budget is 20 meshes', () => {
    expect(LP.LAPTOP.glow).toBeCloseTo(0.12, 9)
    expect(LP.LAPTOP.drawBudget).toBe(20)
  })
})

// Round 4 Phase R4-3 TEST LIST (plan-r4 M18, M19, M20, §4). Assumed contracts, base-local unless
// marked rig (see the R4-3 report): SLOT {x (the right face plane), y, z (mouth centre), len (along
// z), h (along y)}; PORTS {left: {magsafe: {z, len, h}, usbc: [{z, len, h}, …]}, right: {jack: {z, r}}};
// CABLE {r, points: [[x, y, z] …] in rig coordinates, the first at the MagSafe plug end}.
describe('scene/laptop side floppy slot (R4-3, M20)', () => {
  const FLAT = BASE.d / 2 - BASE.r
  const span = (c, len) => [c - len / 2, c + len / 2]

  it('the slot sits on the right face: its plane is BASE.w/2 (x 1.5) and its mouth is in the slab (y 0.0535)', () => {
    expect(LP.SLOT.x).toBeCloseTo(BASE.w / 2, 9)
    expect(LP.SLOT.y).toBeCloseTo(0.0535, 9)
  })

  it('the mouth has at least 0.02 of aluminium above and below (0.029 each, within the slab from its feet to its deck)', () => {
    const bottom = LP.SLOT.y - LP.SLOT.h / 2
    const top = LP.SLOT.y + LP.SLOT.h / 2
    expect(bottom - BASE.lift).toBeGreaterThanOrEqual(0.029 - 1e-9)
    expect(BASE.deckY - top).toBeGreaterThanOrEqual(0.029 - 1e-9)
  })

  it('the mouth is 0.56 long along z (at least a 0.52 floppy plus room) and 0.036 high, and taller than a 0.03 floppy', () => {
    expect(LP.SLOT.len).toBeGreaterThanOrEqual(0.56 - 1e-9)
    expect(LP.SLOT.h).toBeCloseTo(0.036, 9)
    expect(LP.SLOT.h).toBeGreaterThan(0.03)
  })

  it('the mouth z range lies on the flat part of the right face, clear of the plan corners (r 0.12)', () => {
    const [z0, z1] = span(LP.SLOT.z, LP.SLOT.len)
    expect(z0).toBeGreaterThanOrEqual(-FLAT)
    expect(z1).toBeLessThanOrEqual(FLAT)
  })

  it('the mouth is clear of the headphone jack on the same face, with room to spare', () => {
    const [z0, z1] = span(LP.SLOT.z, LP.SLOT.len)
    const jack = LP.PORTS.right.jack
    expect(z1 < jack.z - jack.r || z0 > jack.z + jack.r).toBe(true)
  })

  it('a seated floppy (rig z −0.1 ± 0.26) lies behind the floppy pile (nearest z 0.43), clear by at least 0.2', () => {
    const rigZ = BASE.pos[2] + LP.SLOT.z
    expect(rigZ + 0.26).toBeLessThan(0.43 - 0.2)
  })
})

describe('scene/laptop ports (R4-3, M18)', () => {
  it('the MagSafe plug and the two USB-C mouths are on the left face, and the headphone jack is on the right', () => {
    expect(Object.keys(LP.PORTS.left).sort()).toEqual(['magsafe', 'usbc'])
    expect(LP.PORTS.left.usbc).toHaveLength(2)
    expect(Object.keys(LP.PORTS.right)).toEqual(['jack'])
  })

  it('the MagSafe plug is at z −0.78 and 0.16 long; the USB-C mouths are at z −0.50 and −0.32, 0.09 long and 0.028 high', () => {
    const { magsafe, usbc } = LP.PORTS.left
    expect(magsafe.z).toBeCloseTo(-0.78, 9)
    expect(magsafe.len).toBeCloseTo(0.16, 9)
    expect(usbc.map((u) => u.z)).toEqual([-0.5, -0.32].map((v) => expect.closeTo(v, 9)))
    for (const u of usbc) {
      expect(u.len).toBeCloseTo(0.09, 9)
      expect(u.h).toBeCloseTo(0.028, 9)
    }
  })

  it('the jack is at z −0.90 with radius 0.018, behind the floppy slot', () => {
    expect(LP.PORTS.right.jack.z).toBeCloseTo(-0.9, 9)
    expect(LP.PORTS.right.jack.r).toBeCloseTo(0.018, 9)
    expect(LP.PORTS.right.jack.z).toBeLessThan(LP.SLOT.z)
  })

  it('no two left-face ports overlap in z, and every port is on the flat part of the face', () => {
    const FLAT = BASE.d / 2 - BASE.r
    const zs = [
      [LP.PORTS.left.magsafe.z, LP.PORTS.left.magsafe.len],
      ...LP.PORTS.left.usbc.map((u) => [u.z, u.len]),
    ].map(([c, len]) => [c - len / 2, c + len / 2])
    for (let i = 0; i < zs.length; i++) {
      expect(zs[i][0]).toBeGreaterThanOrEqual(-FLAT)
      expect(zs[i][1]).toBeLessThanOrEqual(FLAT)
      for (let j = i + 1; j < zs.length; j++) expect(zs[i][1] <= zs[j][0] || zs[j][1] <= zs[i][0]).toBe(true)
    }
  })
})

describe('scene/laptop braided cable (R4-3, M18)', () => {
  const FOOT = { x0: -BASE.w / 2, x1: BASE.w / 2, z0: BASE.pos[2] - BASE.d / 2, z1: BASE.pos[2] + BASE.d / 2 }
  const inFoot = ([x, , z]) => x > FOOT.x0 && x < FOOT.x1 && z > FOOT.z0 && z < FOOT.z1
  const PLANT = { x: -2.4, z: -1.2, r: 0.18 }
  const MUG_AT = { x: -2.3, z: 0.85 }

  it('has the seven control points from the plan, with a radius of 0.014', () => {
    expect(LP.CABLE.r).toBeCloseTo(0.014, 9)
    expect(LP.CABLE.points).toHaveLength(7)
    expect(LP.CABLE.points[0]).toEqual([-1.63, 0.054, -0.43].map((v) => expect.closeTo(v, 2)))
    expect(LP.CABLE.points[6][1]).toBeLessThan(-0.5)
  })

  it('the first point is at the MagSafe plug end: rig z of the plug, just outside the left face', () => {
    const [x, , z] = LP.CABLE.points[0]
    expect(z).toBeCloseTo(BASE.pos[2] + LP.PORTS.left.magsafe.z, 2)
    expect(x).toBeLessThan(-BASE.w / 2)
    expect(x).toBeGreaterThan(-BASE.w / 2 - 0.2)
  })

  it('every point lies outside the base footprint', () => {
    for (const p of LP.CABLE.points) expect(inFoot(p), JSON.stringify(p)).toBe(false)
  })

  it('on the desk (|x| ≤ 3.5, z ≥ −1.6, y ≥ 0) until the drop: the first five points', () => {
    for (const [x, y, z] of LP.CABLE.points.slice(0, 5)) {
      expect(Math.abs(x)).toBeLessThanOrEqual(3.5)
      expect(z).toBeGreaterThanOrEqual(-1.6)
      expect(y).toBeGreaterThanOrEqual(0)
    }
  })

  it('stays at least 0.2 from the plant pot (its edge, centre distance minus r 0.18) and clear of the mug', () => {
    for (const [x, , z] of LP.CABLE.points) {
      expect(Math.hypot(x - PLANT.x, z - PLANT.z) - PLANT.r).toBeGreaterThanOrEqual(0.2)
      expect(Math.hypot(x - MUG_AT.x, z - MUG_AT.z)).toBeGreaterThan(0.5)
    }
  })

  it('the last point is below y −0.5 (it has dropped off the back edge of the desk)', () => {
    expect(LP.CABLE.points.at(-1)[1]).toBeLessThan(-0.5)
  })
})

// R4-3 review: the tube runs on three's centripetal Catmull-Rom through CABLE.points, which bends
// between the points, so the tube itself (not just its control points) is checked. catmullRomPoint
// is the pure port of CatmullRomCurve3.getPoint (defaults: open, centripetal).
describe('scene/laptop cable tube clearance (R4-3 review, M18)', () => {
  const N = 2000
  const samples = () => Array.from({ length: N + 1 }, (_, i) => LP.catmullRomPoint(LP.CABLE.points, i / N))
  const EDGE = { z: -1.6, y: 0 } // the desk's back top edge

  it('catmullRomPoint passes through every control point at its knot, and runs from the first to the last', () => {
    const pts = LP.CABLE.points
    pts.forEach((p, i) => {
      const q = LP.catmullRomPoint(pts, i / (pts.length - 1))
      q.forEach((v, k) => expect(v).toBeCloseTo(p[k], 12))
    })
  })

  it('catmullRomPoint is the centripetal spline: on a straight, evenly spaced line it stays on the line', () => {
    const line = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]]
    for (let i = 0; i <= 30; i++) {
      const [x, y, z] = LP.catmullRomPoint(line, i / 30)
      expect(x).toBeCloseTo((3 * i) / 30, 9)
      expect(y).toBeCloseTo(0, 12)
      expect(z).toBeCloseTo(0, 12)
    }
  })

  it('over the desk (z ≥ −1.6) the tube centre is at least CABLE.r above the desk top, so the tube never dips into it', () => {
    for (const [x, y, z] of samples()) {
      if (z >= EDGE.z) expect(y, `at ${[x, y, z].map((v) => v.toFixed(3))}`).toBeGreaterThanOrEqual(LP.CABLE.r)
    }
  })

  it('past the back edge the tube clears the edge and the desk’s back face by CABLE.r: it only falls behind the desk', () => {
    for (const [x, y, z] of samples()) {
      if (z < EDGE.z) expect(Math.hypot(z - EDGE.z, y - EDGE.y), `at ${[x, y, z].map((v) => v.toFixed(3))}`).toBeGreaterThanOrEqual(LP.CABLE.r)
      if (y < 0) expect(z, `below the desk top at ${[x, y, z].map((v) => v.toFixed(3))}`).toBeLessThanOrEqual(EDGE.z - LP.CABLE.r)
    }
  })

  it('the whole tube stays at least 0.2 from the plant pot and 0.5 from the mug', () => {
    for (const [x, , z] of samples()) {
      expect(Math.hypot(x + 2.4, z + 1.2) - 0.18).toBeGreaterThanOrEqual(0.2)
      expect(Math.hypot(x + 2.3, z - 0.85)).toBeGreaterThan(0.5)
    }
  })
})
