// Round 4 Phase R4-2 TEST LIST: scene/laptopBuild.test.js. buildLaptop(T, ctx) and buildEnv(T, renderer)
// receive three by injection (T = { THREE, BufferGeometryUtils }, THREE holding only what they use), so this file
// drives them with the shared proxy fake in src/test/threeMock.js and no vi.mock.
// Assumed contracts (plan-r4 §1.2 M2, M6; see the R4-2 report):
//   ctx = { mk(geo, mat, x, y, z, parent) -> Mesh, hued(mat, hex) -> mat, canvasTex(w, h, draw) -> {t, redraw},
//           hitBox(parent, {size, pos}) -> Mesh, env, base }   (env: buildEnv's result or null)
//   buildLaptop returns { base, hinge, anchor, kbHot, pbtn, note, keys, leds, mats, envMats, texts, sheen, deckGlow }
//   buildEnv(T, renderer) returns { texture, target } (target is the PMREM render target) or null on failure.
import { describe, it, expect, vi } from 'vitest'
import { createThreeFake } from '../test/threeMock.js'
import * as LB from './laptopBuild.js'
import * as LP from './laptop.js'
import { LID } from './laptop.js'
import { HIT } from './props.js'

const isProxy = (m) => m.material?.__args?.[0]?.visible === false
const meshesUnder = (root) => {
  const out = []
  root.traverse((o) => {
    if (o.__kind === 'Mesh') out.push(o)
  })
  return out
}
const envOf = (m) => m.__args?.[0]?.envMap ?? Reflect.getOwnPropertyDescriptor(m, 'envMap')?.value
const optsOf = (m) => m.__args?.[0] ?? {}

/** A fresh three fake, the injected T, and a ctx that builds the way createScene does. */
function world({ env = null } = {}) {
  const fake = createThreeFake()
  const { three, jsm, state } = fake
  const T = { THREE: three, BufferGeometryUtils: jsm.BufferGeometryUtils }
  const base = new three.Group()
  const mk = vi.fn((geo, mat, x, y, z, parent) => {
    const m = new three.Mesh(geo, mat)
    m.position.set(x || 0, y || 0, z || 0)
    m.castShadow = true
    m.receiveShadow = true
    ;(parent || base).add(m)
    return m
  })
  const hued = (mt, hex) => {
    mt.userData.hue = hex
    return mt
  }
  const hitBox = vi.fn((parent, { size, pos }) => {
    const m = new three.Mesh(new three.BoxGeometry(...size), new three.MeshBasicMaterial({ visible: false }))
    m.position.set(...pos)
    m.castShadow = false
    m.receiveShadow = false
    parent.add(m)
    return m
  })
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const t = new three.CanvasTexture(c)
    const redraw = () => {
      const x = c.getContext('2d')
      if (x) draw(x, w, h)
      t.needsUpdate = true
    }
    redraw()
    return { t, redraw }
  }
  const ctx = { mk, hued, canvasTex, hitBox, env, base }
  return { fake, state, T, ctx, base, mk, hitBox, three }
}

const disposed = (state, id) => state.calls.some((c) => c.id === id && c.method === 'dispose')

describe('scene/laptopBuild buildLaptop (R4-2)', () => {
  it('the laptop has at most LAPTOP.drawBudget visible meshes (proxies excluded), and at least one', () => {
    const w = world()
    LB.buildLaptop(w.T, w.ctx)
    const visible = meshesUnder(w.base).filter((m) => !isProxy(m))
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.length).toBeLessThanOrEqual(LP.LAPTOP.drawBudget)
  })

  it('the keyboard is one keycap mesh: a single BufferGeometry of 77 caps × 24 vertices, and nothing else in the Keyboard group', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    expect(out.kbHot.children).toHaveLength(1)
    const caps = out.kbHot.children[0]
    expect(caps.__kind).toBe('Mesh')
    const attr = caps.geometry.attributes.position
    expect(attr, 'a position attribute on the keycap geometry').toBeDefined()
    expect(attr.__args[0]).toBeInstanceOf(Float32Array)
    expect(attr.__args[0]).toHaveLength(77 * 24 * 3)
  })

  it('there is no round red power nub (a 0.035 cylinder) and no trackpad button bars (0.4 × 0.014 × 0.12 boxes)', () => {
    const w = world()
    LB.buildLaptop(w.T, w.ctx)
    const cyl = w.state.created.filter((o) => o.__kind === 'CylinderGeometry')
    expect(cyl.some((g) => g.__args[0] === 0.035)).toBe(false)
    expect(cyl.some((g) => g.__args[0] === 0.065)).toBe(false)
    const boxes = w.state.created.filter((o) => o.__kind === 'BoxGeometry')
    expect(boxes.some((g) => g.__args[0] === 0.4 && g.__args[1] === 0.014 && g.__args[2] === 0.12)).toBe(false)
  })

  it('only the two aluminium meshes (the body and the lid) cast shadows: their materials are exactly mats.aluBase and mats.aluLid', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    const casters = meshesUnder(w.base).filter((m) => m.castShadow === true)
    expect(casters, 'casting meshes').toHaveLength(2)
    expect(new Set(casters.map((m) => m.material))).toEqual(new Set([out.mats.aluBase, out.mats.aluLid]))
    expect(out.mats.aluBase).not.toBe(out.mats.aluLid)
    // world() builds with no env, where the aluminium takes its noEnv metalness, so it is told by its colour.
    for (const m of casters) expect(optsOf(m.material).color, 'a caster is aluminium').toBe(LP.MATERIALS.alu.color)
  })

  it('throws when a merge fails (mergeBufferGeometries returns null) instead of building a mesh with no geometry', () => {
    const w = world()
    const T = { ...w.T, BufferGeometryUtils: { mergeBufferGeometries: () => null } }
    expect(() => LB.buildLaptop(T, w.ctx)).toThrow(/merge/i)
  })

  it('returns no dispose(): everything it builds is in the scene graph or a ctx.canvasTex', () => {
    const w = world()
    expect(LB.buildLaptop(w.T, w.ctx)).not.toHaveProperty('dispose')
  })

  it('the trackpad glass sits at least 0.002 over the deck, clear of the seam under it', () => {
    const w = world()
    LB.buildLaptop(w.T, w.ctx)
    // The ShapeGeometries laid flat on the deck record their translate(x, y, z): the seam and the glass.
    const ys = w.state.calls
      .filter((c) => c.kind === 'ShapeGeometry' && c.method === 'translate' && Math.abs(c.args[2] - LP.TRACKPAD.z) < 1e-9)
      .map((c) => c.args[1])
      .sort((a, b) => a - b)
    expect(ys).toHaveLength(2)
    const [seam, glass] = ys
    expect(seam).toBeGreaterThan(LP.BASE.deckY)
    expect(glass).toBeGreaterThanOrEqual(LP.BASE.deckY + 0.002)
    expect(glass - seam).toBeGreaterThanOrEqual(0.001)
  })

  it('the power button is the Touch ID: the power group holds a Touch ID mesh (hue 0x9fb2c8) and the HIT.touchId hit box', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    const touch = out.pbtn.children.find((c) => c.__kind === 'Mesh' && !isProxy(c))
    expect(touch, 'a visible Touch ID mesh in the power group').toBeDefined()
    expect(touch.material.userData.hue).toBe(0x9fb2c8)
    const hit = w.hitBox.mock.calls.find(([parent]) => parent === out.pbtn)
    expect(hit, 'a hit box built in the power group').toBeDefined()
    expect(hit[1]).toEqual(HIT.touchId)
  })

  it('the sticky note is a descendant of the hinge (it lives on the lid now)', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    expect(out.note.__kind).toBe('Mesh')
    let inHinge = false
    out.hinge.traverse((o) => {
      if (o === out.note) inHinge = true
    })
    expect(inHinge).toBe(true)
  })

  it('the keycap material is flagged userData.ownEmissive, so the hover glow skips it', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    expect(out.kbHot.children[0].material.userData.ownEmissive).toBe(true)
  })

  it('the lid camera dot is a 0.012 circle in the top bezel, at y LID.h − LID.top/2, on the hinge', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    const dot = w.mk.mock.calls.find(([geo]) => geo.__kind === 'CircleGeometry' && geo.__args[0] === 0.012)
    expect(dot, 'camera dot mesh').toBeDefined()
    expect(dot[3]).toBeCloseTo(LID.h - LID.top / 2, 9)
    expect(dot[5]).toBe(out.hinge)
  })

  it('the J monogram is built from moveTo, lineTo and absarc', () => {
    const w = world()
    LB.buildLaptop(w.T, w.ctx)
    const ops = w.state.calls.filter((c) => c.kind === 'Shape' || c.kind === 'Path').map((c) => c.method)
    expect(ops).toEqual(expect.arrayContaining(['moveTo', 'lineTo', 'absarc']))
  })

  // R4-4: a flat J read faint from the desk. It is now a bevelled extrude: the hairline chamfer
  // round its edge mirrors another part of the room than its face, so the polished J has a crisp
  // edge instead of reading as a flat print, and it stays nearly flush (it is not a raised sticker).
  it('R4-4: the J is a bevelled ExtrudeGeometry on the hinge, in the J material, with a hairline chamfer that rises under 0.002 off the lid back', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    const call = w.mk.mock.calls.find(([, mat]) => mat === out.mats.j)
    expect(call, 'the J mesh').toBeDefined()
    const [geo, , , , z, parent] = call
    expect(parent).toBe(out.hinge)
    expect(geo.__kind).toBe('ExtrudeGeometry')
    const o = geo.__args[1]
    expect(o.bevelEnabled).toBe(true)
    expect(o.bevelSize).toBeGreaterThan(0)
    expect(o.bevelSize).toBeLessThanOrEqual(0.012)
    expect(o.bevelThickness).toBeGreaterThan(0)
    expect(o.bevelThickness).toBeLessThanOrEqual(0.002)
    // Turned (0, π, π), shape-local z becomes −z: the side wall (shape z 0…depth) sits at or inside
    // the lid back (−LID.t), and only the front chamfer and the cap stand out of it.
    const wall = z - o.depth
    const cap = z - o.depth - o.bevelThickness
    expect(wall).toBeGreaterThanOrEqual(-LID.t)
    expect(-LID.t - cap).toBeGreaterThan(0)
    expect(-LID.t - cap).toBeLessThan(0.002)
  })

  it('R4-4: the sheen sweeps outside the raised J, by more than 0.001, so the band passes over it', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    const [geo, , , , z] = w.mk.mock.calls.find(([, mat]) => mat === out.mats.j)
    const o = geo.__args[1]
    const cap = z - o.depth - o.bevelThickness
    const i = w.mk.mock.results.findIndex((r) => r.value === out.sheen)
    expect(i, 'the sheen mesh').toBeGreaterThanOrEqual(0)
    expect(w.mk.mock.calls[i][4]).toBeLessThan(cap - 0.001)
  })

  it('merged parts: every merge input is non-indexed (toNonIndexed first if it was indexed), carries position, normal and uv, and is disposed', () => {
    const w = world()
    LB.buildLaptop(w.T, w.ctx)
    const merges = w.state.calls.filter((c) => c.kind === 'BufferGeometryUtils' && c.method === 'mergeBufferGeometries')
    expect(merges.length).toBeGreaterThan(0)
    for (const m of merges) {
      for (const g of m.args[0]) {
        const nonIndexed = g.index === null || w.state.calls.some((c) => c.id === g.__id && c.method === 'toNonIndexed')
        expect(nonIndexed, `${g.__kind} #${g.__id} is non-indexed`).toBe(true)
        expect(Object.keys(g.attributes), `${g.__kind} #${g.__id} attributes`).toEqual(expect.arrayContaining(['position', 'normal', 'uv']))
        expect(disposed(w.state, g.__id), `${g.__kind} #${g.__id} disposed after the merge`).toBe(true)
      }
    }
  })

  it('with no env, the aluminium uses the no-env parameters (metalness 0.35, roughness 0.45) and has no envMap', () => {
    const w = world({ env: null })
    LB.buildLaptop(w.T, w.ctx)
    const mats = w.state.created.filter((o) => o.__kind === 'MeshStandardMaterial')
    const noEnv = LP.MATERIALS.alu.noEnv
    const alu = mats.find((m) => optsOf(m).metalness === noEnv.metalness && optsOf(m).roughness === noEnv.roughness)
    expect(alu, 'aluminium with the no-env parameters').toBeDefined()
    expect(envOf(alu)).toBeUndefined()
    expect(mats.some((m) => optsOf(m).metalness === LP.MATERIALS.alu.metalness)).toBe(false)
  })

  it('with an env, the aluminium is metal 0.9 with roughness 0.42 and its envMap is the PMREM texture', () => {
    const w = world()
    const env = LB.buildEnv(w.T, new w.three.WebGLRenderer())
    expect(env).not.toBeNull()
    w.ctx.env = env
    LB.buildLaptop(w.T, w.ctx)
    const mats = w.state.created.filter((o) => o.__kind === 'MeshStandardMaterial')
    const alu = mats.filter((m) => optsOf(m).metalness === LP.MATERIALS.alu.metalness)
    expect(alu.length).toBeGreaterThanOrEqual(2)
    for (const m of alu) {
      expect(optsOf(m).roughness).toBeCloseTo(LP.MATERIALS.alu.roughness, 9)
      expect(envOf(m)).toBe(env.texture)
    }
  })
})

describe('scene/laptopBuild buildEnv (R4-2, M6)', () => {
  it('builds one PMREM from a scene with sigma 0.04, returns its target and texture, and disposes the generator', () => {
    const w = world()
    const renderer = new w.three.WebGLRenderer()
    const env = LB.buildEnv(w.T, renderer)
    expect(env).toBeTruthy()
    const gen = w.state.created.find((o) => o.__kind === 'PMREMGenerator')
    expect(gen.__args[0]).toBe(renderer)
    const from = w.state.calls.filter((c) => c.kind === 'PMREMGenerator' && c.method === 'fromScene')
    expect(from).toHaveLength(1)
    expect(from[0].args[0].__kind).toBe('Scene')
    expect(from[0].args[1]).toBe(0.04)
    expect(w.state.calls.filter((c) => c.kind === 'PMREMGenerator' && c.method === 'dispose')).toHaveLength(1)
    expect(env.target.__kind).toBe('WebGLRenderTarget')
    expect(env.texture).toBe(env.target.texture)
  })

  it('disposes every geometry and material it made for the env scene, and the env box is drawn from the inside (BackSide)', () => {
    const w = world()
    const before = w.state.created.length
    LB.buildEnv(w.T, new w.three.WebGLRenderer())
    const made = w.state.created.slice(before)
    const resources = made.filter((o) => ['BoxGeometry', 'PlaneGeometry', 'SphereGeometry', 'MeshBasicMaterial', 'MeshStandardMaterial'].includes(o.__kind))
    expect(resources.length).toBeGreaterThan(0)
    for (const o of resources) expect(disposed(w.state, o.__id), `${o.__kind} #${o.__id}`).toBe(true)
    const wall = made.find((o) => o.__kind === 'MeshBasicMaterial' && optsOf(o).side === w.three.BackSide)
    expect(wall, 'the navy wall is a BackSide material').toBeDefined()
  })

  it('returns null when PMREM cannot be built, so the laptop falls back to the no-env metal (no throw)', () => {
    const w = world()
    w.state.failOn = 'PMREMGenerator'
    expect(LB.buildEnv(w.T, new w.three.WebGLRenderer())).toBeNull()
  })
})

// Round 4 Phase R4-3 TEST LIST (plan-r4 M18, M19, D4, D5): the LED placements, the sheen and the deck
// glow as built (hidden at rest), and the side ports. Positions are read from the recorded
// position.set calls of mk (base-local), so the fake needs no geometry maths.
describe('scene/laptopBuild R4-3 LEDs, sheen and deck glow', () => {
  const posOf = (state, m) => state.calls.filter((c) => c.kind === 'Mesh' && c.id === m.__id && c.method === 'set').at(-1)?.args
  const isHidden = (m) => m.visible === false

  it('the drive LED is on the front face at x 1.2 (base-local z at BASE.d/2), so a desk viewer sees it blink', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    const [x, , z] = posOf(w.state, out.leds.drive)
    expect(x).toBeCloseTo(1.2, 2)
    expect(z).toBeCloseTo(LP.BASE.d / 2, 2)
  })

  it('the MagSafe LED is a separate mesh on the left side, at the outer end of the plug (x past the left face)', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    expect(out.leds.magsafe).toBeDefined()
    expect(out.leds.magsafe).not.toBe(out.leds.drive)
    const [x, y, z] = posOf(w.state, out.leds.magsafe)
    expect(x).toBeLessThan(-LP.BASE.w / 2)
    expect(x).toBeGreaterThan(-LP.BASE.w / 2 - 0.15)
    expect(y).toBeGreaterThan(0.04)
    expect(y).toBeLessThan(LP.BASE.deckY)
    expect(Math.abs(z - LP.PORTS.left.magsafe.z)).toBeLessThanOrEqual(LP.PORTS.left.magsafe.len / 2)
  })

  it('the MagSafe LED is toneMapped off (it stays lit in a dark room, D6)', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    expect(optsOf(out.leds.magsafe.material).toneMapped).toBe(false)
  })

  it('the sheen is a hidden additive plane on the lid: its texture is the 256 × 64 band and it is not visible at rest', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    expect(out.sheen.__kind).toBe('Mesh')
    expect(isHidden(out.sheen)).toBe(true)
    expect(out.sheen.material.map.__args[0].width).toBe(256)
    expect(out.sheen.material.map.__args[0].height).toBe(64)
    let inHinge = false
    out.hinge.traverse((o) => {
      if (o === out.sheen) inHinge = true
    })
    expect(inHinge).toBe(true)
  })

  it('the deck glow is a hidden additive plane of 2.8 × 1.0 scene units (D4), not visible at rest', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    expect(out.deckGlow.__kind).toBe('Mesh')
    expect(isHidden(out.deckGlow)).toBe(true)
    expect(out.deckGlow.geometry.__args.slice(0, 2)).toEqual([2.8, 1])
  })

  it('the sheen and the deck glow are not in the resting draw count: they build hidden, so a rest frame shows neither', () => {
    const w = world()
    const out = LB.buildLaptop(w.T, w.ctx)
    const visible = meshesUnder(out.base).filter((m) => !isProxy(m) && !isHidden(m))
    expect(visible).not.toContain(out.sheen)
    expect(visible).not.toContain(out.deckGlow)
  })
})
