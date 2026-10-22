// The MacBook Air's meshes and its env map (plan-r4 M2–M23, D4, D5). ESLint keeps three/* imports
// in createScene.js (the lazy chunk), so three arrives by injection: T = { THREE, BufferGeometryUtils },
// where THREE holds only the classes and constants used here (passing the whole namespace as a value
// would defeat tree-shaking). That also lets laptopBuild.test.js drive this with a plain proxy fake.
// Every number comes from laptop.js; the textures are the painters in textures.js.
import {
  BASE,
  LID,
  HINGE,
  SCREEN,
  KEYBOARD,
  TRACKPAD,
  SLOT,
  PORTS,
  CABLE,
  DRIVE_LED,
  MATERIALS,
  ENV,
  J_PATH,
  J_EXTRUDE,
  extrudeSpec,
  keyboardLayout,
  keycapBuffers,
  capBuffers,
} from './laptop.js'
import { drawKeyAtlas, drawKeyGlow, drawTouchId, drawNote, drawSticker, drawContactShadow, drawSheen, drawDeckGlow } from './textures.js'
import { HIT } from './props.js'
import { SHEEN } from './sceneMath.js'

const PI = Math.PI

// How each env panel turns to face into the room (a plane faces +z).
const FACE = {
  '+x': (m) => (m.rotation.y = -PI / 2),
  '-x': (m) => (m.rotation.y = PI / 2),
  back: () => {},
  top: (m) => (m.rotation.x = PI / 2),
}

/**
 * The laptop-only env map (M6): ENV's room box and panels rendered once through PMREM (sigma 0.04).
 * The env scene and the generator are disposed at once; the caller owns `target` (dispose it with
 * the scene). Returns null if PMREM cannot be built (weak WebGL1 phones), so the metal falls back
 * to MATERIALS' no-env parameters.
 */
export function buildEnv({ THREE }, renderer) {
  const made = []
  let gen = null
  try {
    gen = new THREE.PMREMGenerator(renderer)
    const scene = new THREE.Scene()
    const add = (geo, color, k, side) => {
      const mat = new THREE.MeshBasicMaterial(side === undefined ? { color } : { color, side })
      made.push(geo, mat)
      if (k !== 1) mat.color.multiplyScalar(k)
      const m = new THREE.Mesh(geo, mat)
      scene.add(m)
      return m
    }
    add(new THREE.BoxGeometry(...ENV.box), ENV.wall, 1, THREE.BackSide)
    for (const p of ENV.panels) {
      const m = add(new THREE.PlaneGeometry(...p.size), p.color, p.k)
      m.position.set(...p.pos)
      FACE[p.side](m)
    }
    const target = gen.fromScene(scene, 0.04)
    return { texture: target.texture, target }
  } catch {
    return null
  } finally {
    for (const o of made) o.dispose()
    gen?.dispose()
  }
}

/**
 * One geometry from several (M23), for static parts that share a material: each source is made
 * non-indexed (ExtrudeGeometry already is), so all carry the same position, normal and uv, and is
 * disposed after the merge. Throws if three refuses the merge (it returns null on a mismatch).
 */
export function mergeParts(BufferGeometryUtils, parts) {
  const flat = parts.map((g) => {
    if (!g.index) return g
    const n = g.toNonIndexed()
    if (n !== g) g.dispose()
    return n
  })
  const out = BufferGeometryUtils.mergeBufferGeometries(flat)
  for (const g of flat) g.dispose()
  if (!out) throw new Error('mergeBufferGeometries failed: the parts do not share their attributes')
  return out
}

/** A w × h rounded rectangle of corner radius r centred on (cx, cy), drawn into a Shape or Path. */
function roundRect(path, w, h, r, cx = 0, cy = 0) {
  const x = cx - w / 2
  const y = cy - h / 2
  path.moveTo(x + r, y)
  path.lineTo(x + w - r, y)
  path.absarc(x + w - r, y + r, r, -PI / 2, 0, false)
  path.lineTo(x + w, y + h - r)
  path.absarc(x + w - r, y + h - r, r, 0, PI / 2, false)
  path.lineTo(x + r, y + h)
  path.absarc(x + r, y + h - r, r, PI / 2, PI, false)
  path.lineTo(x, y + r)
  path.absarc(x + r, y + r, r, PI, 1.5 * PI, false)
  return path
}

/**
 * buildLaptop(T, ctx) builds the Air into `ctx.base` (the base group, already in the rig):
 * ctx = { mk, hued, canvasTex, hitBox, env, base } are createScene's helpers, and `env` is
 * buildEnv's result or null. Only the two aluminium bodies cast shadows; the static small parts are
 * merged into one shade and one dark mesh, the 77 caps are one mesh (M8), and the hover-glow hues
 * follow M22. The braided cable and the contact shadow are in rig coordinates, so they are built
 * with no parent: mk's default, the rig. Returns the groups and meshes the scene drives: { base,
 * hinge, anchor, kbHot, pbtn, note, keys, leds: {drive, magsafe}, mats, envMats, texts, sheen,
 * deckGlow, cable, contact }; the sheen and the deck glow are built hidden (the frame shows them). It needs no dispose of its own: all it
 * builds is in the scene graph or a ctx.canvasTex, which createScene releases. The mirror and the
 * screen light stay in createScene, which owns the OS state they show.
 */
export function buildLaptop(T, ctx) {
  const { THREE, BufferGeometryUtils } = T
  const { mk, hued, canvasTex, hitBox, env, base } = ctx

  // Materials. With an env, the metals get it (and their envMapIntensity follows the lamp through
  // envMats); without one, their `noEnv` parameters.
  const envMats = []
  const std = (spec, extra) => {
    const { color, metalness, roughness } = spec
    const p = env ? { color, metalness, roughness } : { color, metalness, roughness, ...spec.noEnv }
    if (env) Object.assign(p, { envMap: env.texture, envMapIntensity: spec.envMapIntensity ?? 1 })
    const m = new THREE.MeshStandardMaterial({ ...p, ...extra })
    if (env) {
      m.userData.env0 = p.envMapIntensity
      envMats.push(m)
    }
    return spec.hue === undefined ? m : hued(m, spec.hue)
  }
  // The base and the lid get their own aluminium, so the lid hotspot's glow stays on the lid.
  const aluBase = std(MATERIALS.alu)
  const aluLid = std(MATERIALS.alu)
  const shade = std(MATERIALS.shade)
  const dark = new THREE.MeshStandardMaterial({ ...MATERIALS.dark })
  const glass = std(MATERIALS.glass)
  const bezel = std(MATERIALS.bezel)
  const jMat = std(MATERIALS.j)

  // A part that does not cast a shadow (all but the two aluminium bodies, M21).
  const part = (geo, mat, x, y, z, parent) => {
    const m = mk(geo, mat, x, y, z, parent)
    m.castShadow = false
    return m
  }
  const merged = (parts) => mergeParts(BufferGeometryUtils, parts)
  const flatDown = (geo, x, y, z) => geo.rotateX(-PI / 2).translate(x, y, z)

  // ---------- the base: an extruded rounded slab with the keyboard well cut through it (M4) ----------
  const { well } = KEYBOARD
  const bs = extrudeSpec(BASE.w, BASE.d, BASE.h, BASE.r, BASE.bevel)
  const baseShape = roundRect(new THREE.Shape(), bs.w, bs.d, bs.r)
  // Bevels shrink holes, so the hole is the well plus a bevel each side (the shape's y is −z).
  baseShape.holes.push(roundRect(new THREE.Path(), well.w + 2 * BASE.bevel, well.d + 2 * BASE.bevel, 0.03 + BASE.bevel, 0, -well.z))
  const extrude = (shape, depth, bevel) =>
    new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 })
  const baseGeo = extrude(baseShape, bs.depth, BASE.bevel)
    .rotateX(-PI / 2)
    .translate(0, BASE.lift + BASE.bevel, 0)
  // The MagSafe plug (M18): a small rounded aluminium block standing out of the left face, merged
  // into the base body (the same material, one draw).
  const { magsafe } = PORTS.left
  const PLUG_BEVEL = 0.006
  const ps = extrudeSpec(magsafe.out, magsafe.len, magsafe.h, 0.012, PLUG_BEVEL)
  const plugGeo = extrude(roundRect(new THREE.Shape(), ps.w, ps.d, ps.r), ps.depth, PLUG_BEVEL)
    .rotateX(-PI / 2)
    .translate(-BASE.w / 2 - magsafe.out / 2, PORTS.y - magsafe.h / 2 + PLUG_BEVEL, magsafe.z)
  mk(merged([baseGeo, plugGeo]), aluBase, 0, 0, 0, base)

  // The side faces (M18, M20): a part on the right face (+x) or the left (−x), centred at (y, z),
  // stands `proud` off it so it never z-fights the face.
  const onRight = (geo, y, z, proud) => geo.rotateY(PI / 2).translate(BASE.w / 2 + proud, y, z)
  const onLeft = (geo, y, z, proud) => geo.rotateY(-PI / 2).translate(-BASE.w / 2 - proud, y, z)

  // The dark parts: the well floor, the trackpad seam, the four rubber feet (M21), the floppy mouth
  // inside its lip on the right face (M20), the headphone jack behind it, and the two USB-C mouths
  // on the left (M18). Side-face parts stand 1.2–2 mm (0.0012–0.002) proud of the face.
  const front = BASE.d / 2
  const { jack } = PORTS.right
  const darkParts = [
    flatDown(new THREE.PlaneGeometry(well.w + 2 * BASE.bevel, well.d + 2 * BASE.bevel), 0, well.floor, well.z),
    flatDown(roundShapeGeo(THREE, TRACKPAD.w + 0.008, TRACKPAD.d + 0.008, TRACKPAD.r + 0.004), TRACKPAD.x, BASE.deckY + 0.0008, TRACKPAD.z),
    onRight(roundShapeGeo(THREE, SLOT.len, SLOT.h, 0.008), SLOT.y, SLOT.z, 0.002),
    onRight(new THREE.CircleGeometry(jack.r, 16), PORTS.y, jack.z, 0.0012),
    ...PORTS.left.usbc.map((u) => onLeft(roundShapeGeo(THREE, u.len, u.h, u.h / 2 - 0.002), PORTS.y, u.z, 0.0012)),
  ]
  for (const [fx, fz] of [[-1.25, -0.85], [1.25, -0.85], [-1.25, 0.85], [1.25, 0.85]])
    darkParts.push(new THREE.CylinderGeometry(0.07, 0.07, BASE.lift, 16).translate(fx, BASE.lift / 2, fz))
  part(merged(darkParts), dark, 0, 0, 0, base)

  // The shade parts: the hinge barrel (M16), the thumb scoop under the front edge (M17), and the
  // floppy slot's lip, SLOT.lip larger than the mouth all round (M20).
  const { barrel } = HINGE
  const scoop = new THREE.CircleGeometry(0.18, 24, PI, PI).scale(1, 0.024 / 0.18, 1)
  const shadeParts = [
    new THREE.CylinderGeometry(barrel.r, barrel.r, barrel.length, 20).rotateZ(PI / 2).translate(...barrel.pos),
    scoop.translate(0, BASE.deckY - BASE.bevel, front + 0.0015),
    onRight(roundShapeGeo(THREE, SLOT.len + 2 * SLOT.lip, SLOT.h + 2 * SLOT.lip, 0.014), SLOT.y, SLOT.z, 0.0012),
  ]
  part(merged(shadeParts), shade, 0, 0, 0, base)

  // The drive LED on the front face (M19) and the MagSafe LED on the plug's top outer end (M18).
  // The drive LED's emissive is the frame's (ownEmissive, M22); the MagSafe LED is unlit
  // (toneMapped off, so it stays lit in a dark room) and the frame writes its colour (D6).
  const ledM = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, emissive: 0x000000 })
  ledM.userData.ownEmissive = true
  const driveLED = part(roundShapeGeo(THREE, 0.05, 0.012, 0.006), ledM, DRIVE_LED.x, DRIVE_LED.y, front + 0.0015, base)
  const magM = new THREE.MeshBasicMaterial({ color: 0x3a2406, toneMapped: false })
  const magsafeLED = part(flatDown(roundShapeGeo(THREE, 0.024, 0.05, 0.008), 0, 0, 0), magM, -BASE.w / 2 - magsafe.out + 0.03, PORTS.y + magsafe.h / 2 + 0.0008, magsafe.z, base)

  // The Force Touch trackpad: one glass plane over the dark seam (M12), 2 mm over the deck and 1.2 mm
  // over the seam, which keeps them apart in the depth buffer from the far phone camera too.
  part(flatDown(roundShapeGeo(THREE, TRACKPAD.w, TRACKPAD.d, TRACKPAD.r), TRACKPAD.x, BASE.deckY + 0.002, TRACKPAD.z), glass, 0, 0, 0, base)

  // ---------- the keyboard: 77 caps in one mesh, legends from the atlas, the backlight from the glow map ----------
  const layout = keyboardLayout()
  const kb = keycapBuffers(layout)
  const capGeo = (buf) => {
    const g = new THREE.BufferGeometry()
    const pos = new THREE.BufferAttribute(buf.position, 3)
    g.setAttribute('position', pos)
    g.setAttribute('normal', new THREE.BufferAttribute(buf.normal, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(buf.uv, 2))
    g.setIndex(new THREE.BufferAttribute(buf.index, 1))
    return { g, pos }
  }
  const caps = capGeo(kb)
  const atlas = canvasTex(1024, 424, (x, w, h) => drawKeyAtlas(x, w, h, layout))
  const glowMap = canvasTex(512, 212, (x, w, h) => drawKeyGlow(x, w, h, layout))
  const keyM = new THREE.MeshStandardMaterial({
    color: MATERIALS.keys.color,
    metalness: MATERIALS.keys.metalness,
    roughness: MATERIALS.keys.roughness,
    map: atlas.t,
    emissiveMap: glowMap.t,
    emissive: 0x000000,
  })
  keyM.userData.ownEmissive = true
  // All caps sit in one group so the keyboard is a single hotspot.
  const kbHot = new THREE.Group()
  base.add(kbHot)
  part(caps.g, keyM, 0, 0, 0, kbHot)

  // Touch ID (M11): the power button, top right of the fn row. Its group sits on the cell at the cap
  // top and holds the cap (UVs over the cell, for the ring texture) and the HIT.touchId box.
  const cell = layout.find((k) => k.touchId)
  const pbtn = new THREE.Group()
  pbtn.position.set(cell.x, KEYBOARD.top, cell.z)
  base.add(pbtn)
  const touch = capGeo(capBuffers([{ ...cell, x: 0, z: 0 }], (x, z) => [x / cell.w + 0.5, 0.5 - z / cell.d]))
  const ring = canvasTex(64, 64, drawTouchId)
  part(touch.g, std(MATERIALS.touchId, { map: ring.t }), 0, -KEYBOARD.top, 0, pbtn)
  hitBox(pbtn, HIT.touchId)

  // ---------- the lid on its hinge: extruded behind the pivot (local z −t…0), screen side +z ----------
  const hinge = new THREE.Group()
  hinge.position.set(0, HINGE.y, HINGE.z)
  base.add(hinge)
  const ls = extrudeSpec(LID.w, LID.h, LID.t, LID.r, LID.bevel)
  const lidGeo = extrude(roundRect(new THREE.Shape(), ls.w, ls.d, ls.r), ls.depth, LID.bevel).translate(0, LID.h / 2, -(LID.t - LID.bevel))
  mk(lidGeo, aluLid, 0, 0, 0, hinge)
  // Black glass over the front, inset 0.02 so a thin silver rim shows, and the camera in the top bezel (M13).
  part(roundShapeGeo(THREE, LID.w - 0.04, LID.h - 0.04, LID.r - 0.02), bezel, 0, LID.h / 2, 0.001, hinge)
  const camM = new THREE.MeshStandardMaterial({ color: 0x0c1220, roughness: 0.2, metalness: 0 })
  part(new THREE.CircleGeometry(0.012, 16), camM, 0, LID.h - LID.top / 2, 0.0015, hinge)
  // The camera dives to the anchor, and the CSS3D screen sits on it.
  const anchor = new THREE.Object3D()
  anchor.position.set(0, SCREEN.cy, 0.003)
  hinge.add(anchor)

  // The lid back: the polished J in the centre (M14), the sticky note front right and the JAY-OS
  // sticker back left (M15). Turned (0, π, π), so they read upright from the desk with the lid shut.
  const jShape = new THREE.Shape()
  for (const [op, ...args] of J_PATH) jShape[op](...args)
  const back = -LID.t
  // R4-4: a bevelled extrude, so its hairline chamfer mirrors another part of the room than its
  // face and the J has a crisp polished edge. Turned (0, π, π), shape z becomes −z: the side wall
  // (shape z 0…depth) is buried 0.0001 inside the lid back, and only the chamfer and the cap stand
  // out of it, by bevelThickness − 0.0001.
  const jGeo = new THREE.ExtrudeGeometry(jShape, { ...J_EXTRUDE, bevelEnabled: true, bevelSegments: 1, curveSegments: 12 })
  part(jGeo, jMat, 0, LID.h / 2, back + 0.0001 + J_EXTRUDE.depth, hinge).rotation.set(0, PI, PI)
  const note = canvasTex(256, 256, drawNote)
  // Hued with their paper colours, so the lid's hover glow tints them instead of washing them out.
  const noteMat = hued(new THREE.MeshStandardMaterial({ map: note.t, roughness: 0.85 }), 0xffe36e)
  const noteM = part(new THREE.PlaneGeometry(0.42, 0.42), noteMat, 0.95, 1.7, back - 0.001, hinge)
  noteM.rotation.set(0, PI, PI + 0.2)
  const sticker = canvasTex(256, 64, drawSticker)
  const stickerMat = hued(new THREE.MeshStandardMaterial({ map: sticker.t, roughness: 0.6 }), 0x122030)
  const stickerM = part(new THREE.PlaneGeometry(0.5, 0.125), stickerMat, -0.85, 0.42, back - 0.001, hinge)
  stickerM.rotation.set(0, PI, PI - 0.06)

  // Purely decorative meshes are never pick targets: three r128's Raycaster still tests meshes with
  // visible = false, so the hidden sheen (just outside the lid back) took the sticky note's hits and
  // the hidden deck glow (above the cap tops) took the keyboard's and Touch ID's.
  const noPick = (m) => {
    m.raycast = () => {}
    return m
  }

  // Effects, built hidden: the frame shows them only while they are lit (D4, D5), so a resting frame
  // draws neither. Both are additive, unlit and do not write depth.
  const fx = (map, extra) => {
    const m = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...extra })
    m.map = map
    return m
  }
  // The lid sheen (D5): a band swept across the lid back by its texture offset. The shape's UVs are
  // its own coordinates (0…w, 0…h), so repeat scales them to 0…1 and the offset slides the clamped
  // band (transparent at its edges) from one side to the other. It covers the lid back inside the
  // bevel, 0.003 out: clear of the raised J (R4-4), so the band passes over it.
  const sw = LID.w - 2 * LID.bevel
  const sh = LID.h - 2 * LID.bevel
  const band = canvasTex(256, 64, drawSheen)
  band.t.wrapS = band.t.wrapT = THREE.ClampToEdgeWrapping
  band.t.repeat.set(1 / sw, 1 / sh)
  const sheenGeo = new THREE.ShapeGeometry(roundRect(new THREE.Shape(), sw, sh, LID.r - LID.bevel, sw / 2, sh / 2), 6).translate(-sw / 2, -sh / 2, 0)
  const sheen = part(sheenGeo, fx(band.t, { opacity: SHEEN.opacity }), 0, LID.h / 2, back - 0.003, hinge)
  sheen.rotation.set(0, PI, PI)
  sheen.visible = false
  noPick(sheen)
  // The screen's glow on the deck (D4), in front of the hinge over the keyboard, tinted the screen
  // light's colour; the frame sets its opacity.
  const glowTex = canvasTex(512, 180, drawDeckGlow)
  const deckGlow = part(flatDown(new THREE.PlaneGeometry(2.8, 1), 0, 0, 0), fx(glowTex.t, { color: 0x7cc4ff, opacity: 0 }), 0, BASE.deckY + 0.004, -0.55, base)
  deckGlow.visible = false
  noPick(deckGlow)

  // ---------- in the rig: the braided MagSafe cable (M18) and the contact shadow (M21) ----------
  const cableM = new THREE.MeshStandardMaterial({ color: MATERIALS.cable.color, roughness: MATERIALS.cable.roughness, metalness: 0 })
  const curve = new THREE.CatmullRomCurve3(CABLE.points.map((p) => new THREE.Vector3(...p)))
  const cable = mk(new THREE.TubeGeometry(curve, 64, CABLE.r, 6, false), cableM, 0, 0, 0)
  cable.castShadow = false
  noPick(cable)
  const shadowTex = canvasTex(256, 192, drawContactShadow)
  const contact = mk(
    flatDown(new THREE.PlaneGeometry(3.4, 2.5), 0, 0, 0),
    new THREE.MeshBasicMaterial({ map: shadowTex.t, transparent: true, depthWrite: false, opacity: 0.5 }),
    BASE.pos[0],
    0.0015,
    BASE.pos[2],
  )
  contact.castShadow = contact.receiveShadow = false
  noPick(contact)

  return {
    base,
    hinge,
    anchor,
    kbHot,
    pbtn,
    note: noteM,
    keys: { attr: caps.pos, position: kb.position, ids: kb.ids, ranges: kb.ranges, mat: keyM },
    leds: { drive: driveLED, magsafe: magsafeLED },
    mats: { aluBase, aluLid, shade, dark, glass, bezel, j: jMat, keys: keyM },
    envMats,
    // The canvases drawn in web fonts, for the scene's font gate.
    texts: [note, sticker],
    sheen,
    deckGlow,
    cable,
    contact,
  }
}

/** A flat rounded-rect ShapeGeometry in the xy plane. */
function roundShapeGeo(THREE, w, h, r) {
  return new THREE.ShapeGeometry(roundRect(new THREE.Shape(), w, h, r), 6)
}
