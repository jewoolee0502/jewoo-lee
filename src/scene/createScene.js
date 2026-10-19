// The 3D room (initScene, L1057–1274) on three r128 plus CSS3D (D1). This is the only module
// that imports three (ESLint enforces it), and loadScene imports it lazily, so three ships in
// its own chunk. The shared stage ticker calls `frame(t, dt)` after `ctrl.update(dt)` (D6);
// the scene has no rAF or IntersectionObserver of its own. `dispose()` releases everything,
// and a throw while building disposes the partial work before rethrowing (B6, B7).
import * as THREE from 'three'
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { pinScroll } from '../stage/pinScroll.js'
import { OS_W, OS_H } from '../core/constants.js'
import {
  lidT as lidOf,
  hingeAngle,
  camE,
  lidBoot,
  widenSize,
  camFov,
  camDistance,
  cameraPose,
  stepKey,
  stepSnow,
  ledPower,
  ledDrive,
  screenLightTarget,
  tagAngle,
  createTweenList,
  dragYaw,
  stepParallax,
  widePose,
  fogFor,
  holderAlpha,
  vignetteAlpha,
  approach,
  wiggle,
  stepSteam,
  peekTarget,
  peekLatch,
  glowColor,
  STEAM_Y0,
  STEAM_Y1,
} from './sceneMath.js'
import { drawSky, drawNote, drawSticker, drawLogo, drawFloppyLabel, drawMirror, drawMugLabel, drawPuff } from './textures.js'
import { FLOPPIES, createFloppySequencer } from './floppy.js'
import { createHotspotActions, hotspotOf } from './hotspots.js'
import { POLAROID, MUG, SLOT, HIT, faceAngle } from './props.js'

/** The faces the canvas textures draw with; the font gate redraws them once these have loaded. */
export const CANVAS_FONTS = [
  '20px Silkscreen',
  '600 54px Caveat',
  '15px "JetBrains Mono"',
  '24px VT323',
  '42px Silkscreen',
  '500 64px "EB Garamond"',
]
// Per-second ease rates (approach) for the hover lift, the steam, the lamp and the lid peek.
const RATE = { lift: 12, steam: 4, lamp: 6, peek: 10, wiggle: 10 }
const STEAM_N = 18
const WIGGLE_AMP = 0.06
// The hover glow is the material's own colour at this strength, so a prop keeps its hue. A hotspot
// may carry its own strength (the mug, plan-r2 §7 U15).
export const GLOW_K = 0.2
const PORTRAIT = 'img/jay-px.png'
const PORTRAIT_FALLBACK = 'img/jay.jpg'
const POINTER_EVENTS = ['pointermove', 'pointerdown', 'pointerup', 'pointerleave']

/**
 * Subscribes the scene api to the app stores (section 3): OS state -> onOS (mirror), wallpaper ->
 * onOS(current state). Returns the unsubscribe function; if wiring throws midway, the
 * subscriptions made so far are removed.
 */
export function wireScene(api, app) {
  const offs = []
  const off = () => offs.splice(0).forEach((fn) => fn())
  try {
    wire(api, app, offs)
  } catch (e) {
    off()
    throw e
  }
  return off
}

function wire(api, app, offs) {
  let osState = app.os.store.get().state
  offs.push(
    app.os.store.subscribe((s) => {
      if (s.state === osState) return
      osState = s.state
      api.onOS(s.state)
    }),
  )

  let wp = app.wallpaper.store.get()
  offs.push(
    app.wallpaper.store.subscribe((s) => {
      if (s.mode === wp.mode && s.choice === wp.choice) return
      wp = s
      api.onOS(app.os.state)
    }),
  )
}

/**
 * createScene({mount, stage, holder, park, tipEl, app, reduce})
 * mount: `.scene-layer` (gets canvas.gl, then div.css3d); stage: sized element observed for
 * resizes; holder: the host's #os-holder (the CSS3DObject element); park: where the holder goes
 * back on dispose; tipEl: the hover tooltip; reduce: boolean or () => boolean.
 */
export function createScene({ mount, stage, holder, park, tipEl, app, reduce }) {
  const isReduced =
    typeof reduce === 'function'
      ? () => Boolean(reduce())
      : reduce === undefined
        ? () => Boolean(app.motion?.reduce?.())
        : () => Boolean(reduce)

  let disposed = false
  let renderer = null
  let canvas = null
  let css = null
  let cssScene = null
  let cssObj = null
  let scene = null
  let ro = null
  let photoTex = null
  const textures = []
  const listeners = []
  const offs = []

  function dispose() {
    if (disposed) return
    disposed = true
    for (const [target, type, fn] of listeners.splice(0)) target?.removeEventListener(type, fn)
    ro?.disconnect()
    offs.splice(0).forEach((off) => off())
    // r128's CSS3DObject `removed` handler detaches the holder from the CSS3D layer.
    if (cssScene && cssObj) cssScene.remove(cssObj)
    if (holder) {
      holder.style.visibility = ''
      holder.style.opacity = ''
      holder.style.removeProperty('--vig')
      // The widened size goes back to the host's 900×675, unless the OS is flat (sized by its fit).
      if (!app.os?.store?.get?.().flat) app.os?.setSize?.(OS_W, OS_H)
      holder.style.willChange = ''
      holder.style.transform = ''
      if (park) park.appendChild(holder)
    }
    scene?.traverse((o) => {
      if (!o.isMesh && !o.isPoints) return
      o.geometry?.dispose?.()
      for (const m of [].concat(o.material ?? [])) {
        m.map?.dispose?.()
        m.dispose?.()
      }
    })
    for (const t of textures.splice(0)) t.dispose()
    photoTex?.dispose()
    if (renderer) {
      renderer.dispose()
      renderer.forceContextLoss()
    }
    canvas?.remove()
    css?.domElement?.remove()
    if (tipEl) tipEl.hidden = true
  }

  try {
    return build()
  } catch (e) {
    dispose()
    throw e
  }

  function build() {
    const DEG = Math.PI / 180
    const { os, ctrl } = app

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5))
    renderer.outputEncoding = THREE.sRGBEncoding
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    canvas = renderer.domElement
    canvas.className = 'gl'
    mount.prepend(canvas)
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x141c2e)
    scene.fog = new THREE.Fog(0x141c2e, 16, 34)
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 80)
    try {
      css = new CSS3DRenderer()
      css.domElement.className = 'css3d'
      canvas.after(css.domElement)
      // Bug J: focus inside the OS must not scroll the CSS3D layers (overflow:hidden) away.
      offs.push(pinScroll(css.domElement))
      if (css.domElement.firstElementChild) offs.push(pinScroll(css.domElement.firstElementChild))
      cssScene = new THREE.Scene()
      cssObj = new CSS3DObject(holder)
      cssScene.add(cssObj)
    } catch {
      css?.domElement?.remove()
      css = cssScene = cssObj = null
    }
    const rig = new THREE.Group()
    scene.add(rig)

    // `userData.hue` is the colour the hover glow is made from (glowColor).
    const hued = (mt, hex) => {
      mt.userData.hue = hex
      return mt
    }
    const M = (c, o) => hued(new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o }), c)
    const mk = (geo, mat, x, y, z, parent) => {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x || 0, y || 0, z || 0)
      m.castShadow = m.receiveShadow = true
      ;(parent || rig).add(m)
      return m
    }
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d)
    // plan-r2 §7 U16: invisible hit boxes. Hidden through the material, not mesh.visible: the
    // raycaster still tests them, the renderer skips them, and glow() skips them (no emissive).
    const hitM = new THREE.MeshBasicMaterial({ visible: false })
    const hitBox = (parent, { size, pos }) => {
      const m = new THREE.Mesh(B(...size), hitM)
      m.position.set(...pos)
      m.castShadow = m.receiveShadow = false
      parent.add(m)
      return m
    }
    const canvasTex = (w, h, draw) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const t = new THREE.CanvasTexture(c)
      t.encoding = THREE.sRGBEncoding
      t.anisotropy = 4
      textures.push(t)
      const redraw = () => {
        if (disposed) return
        const x = c.getContext('2d')
        if (x) draw(x, w, h)
        t.needsUpdate = true
      }
      redraw()
      return { t, redraw }
    }
    const flat = (tex, w, h, x, y, z, parent, basic) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        basic
          ? new THREE.MeshBasicMaterial({ map: tex.t, toneMapped: false })
          : new THREE.MeshStandardMaterial({ map: tex.t, roughness: 0.85 }),
      )
      m.position.set(x, y, z)
      ;(parent || rig).add(m)
      return m
    }

    // ---------- lights (L1075–1077) ----------
    const hemi = new THREE.HemisphereLight(0xb8ccff, 0x2a1e14, 0.55)
    scene.add(hemi)
    const moon = new THREE.DirectionalLight(0xa9c1ff, 0.42)
    moon.position.set(-6, 8, 5)
    moon.castShadow = true
    moon.shadow.mapSize.set(1024, 1024)
    Object.assign(moon.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 })
    moon.shadow.bias = -0.0006
    scene.add(moon)

    // ---------- room and window (L1080–1095) ----------
    mk(new THREE.PlaneGeometry(40, 20), M(0x1f2b45, { roughness: 0.95 }), 0, 4, -3, scene).castShadow = false
    mk(new THREE.PlaneGeometry(40, 40), M(0x161e30, { roughness: 1 }), 0, -2.5, 0, scene).rotation.x = -Math.PI / 2
    const sky = canvasTex(512, 420, drawSky)
    const skyM = flat(sky, 2.4, 2.0, -3.5, 2.7, -2.99, scene, true)
    const frameM = M(0xe9edf2)
    ;[[0, 1.05, 2.6, 0.12], [0, -1.05, 2.6, 0.12], [-1.25, 0, 0.12, 2.2], [1.25, 0, 0.12, 2.2], [0, 0, 0.06, 2.0], [0, 0, 2.4, 0.06]].forEach(
      ([fx, fy, fw, fh]) => mk(B(fw, fh, 0.08), frameM, -3.5 + fx, 2.7 + fy, -2.95, scene),
    )
    mk(B(2.9, 0.1, 0.3), frameM, -3.5, 1.6, -2.86, scene)
    const SN = 280
    const snowPos = new Float32Array(SN * 3)
    const snowV = new Float32Array(SN)
    for (let i = 0; i < SN; i++) {
      snowPos[i * 3] = -4.65 + Math.random() * 2.3
      snowPos[i * 3 + 1] = 1.75 + Math.random() * 1.9
      snowPos[i * 3 + 2] = -2.93
      snowV[i] = 0.25 + Math.random() * 0.35
    }
    const snowG = new THREE.BufferGeometry()
    const snowAttr = new THREE.BufferAttribute(snowPos, 3)
    snowG.setAttribute('position', snowAttr)
    scene.add(new THREE.Points(snowG, new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.9 })))
    let snowBoost = 0

    // ---------- polaroid, taped alone to the wall (L1107–1113, R13) ----------
    const pol = new THREE.Group()
    pol.position.set(...POLAROID.pos)
    pol.rotation.z = POLAROID.rotZ
    pol.scale.setScalar(POLAROID.scale)
    scene.add(pol)
    mk(B(...POLAROID.card), M(0xf7f7f2, { roughness: 0.9 }), 0, 0, 0, pol)
    const photoM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(...POLAROID.photo), photoM)
    photo.position.set(0, POLAROID.photoY, 0.008)
    pol.add(photo)
    // The dithered portrait; if it fails, the plain photo (L1111's fallback); if that fails too,
    // the polaroid stays a blank white print.
    const usePhoto = (t) => {
      if (disposed) return t.dispose()
      t.encoding = THREE.sRGBEncoding
      t.magFilter = THREE.NearestFilter
      t.minFilter = THREE.NearestFilter
      t.generateMipmaps = false
      photoTex = t
      photoM.map = t
      photoM.needsUpdate = true
    }
    const imgBase = import.meta.env?.BASE_URL ?? '/'
    const loader = new THREE.TextureLoader()
    loader.load(imgBase + PORTRAIT, usePhoto, undefined, () => {
      if (!disposed) loader.load(imgBase + PORTRAIT_FALLBACK, usePhoto, undefined, () => {})
    })
    const { tape } = POLAROID
    const tapeM = new THREE.MeshStandardMaterial({ color: tape.color, transparent: true, opacity: tape.opacity, roughness: 0.9 })
    mk(B(...tape.size), tapeM, ...tape.pos, pol).rotation.z = tape.rotZ

    // ---------- dog tags (L1116–1121) ----------
    const tags = new THREE.Group()
    tags.position.set(-1.6, 3.05, -2.92)
    scene.add(tags)
    const metal = M(0xc3ccd5, { metalness: 0.85, roughness: 0.28 })
    mk(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10), M(0x8a96a3), 0, 0.03, -0.02, tags).rotation.x = Math.PI / 2
    mk(new THREE.CylinderGeometry(0.006, 0.006, 0.55, 6), metal, 0, -0.27, 0, tags)
    mk(B(0.17, 0.28, 0.012), metal, 0, -0.68, 0, tags)
    mk(B(0.17, 0.28, 0.012), metal, 0.04, -0.65, -0.014, tags).rotation.z = 0.15
    hitBox(tags, HIT.tags)
    let tagSwing = 0.05
    let tagT = 0

    // ---------- desk (L1124–1125) ----------
    mk(B(7, 0.22, 3.2), M(0x6e4a30, { roughness: 0.6 }), 0, -0.11, 0)
    ;[[-3.3, -1.45], [3.3, -1.45], [-3.3, 1.45], [3.3, 1.45]].forEach(([x, z]) => mk(B(0.16, 2.3, 0.16), M(0x3a2818), x, -1.37, z))

    // ---------- the laptop (L1128–1159) ----------
    const CASE = 0xcdd3da
    const ACC = 0x4aa6ee
    const base = new THREE.Group()
    base.position.set(0, 0, 0.35)
    rig.add(base)
    mk(B(3.0, 0.16, 2.1), M(CASE, { roughness: 0.55 }), 0, 0.08, 0, base)
    mk(B(2.76, 0.012, 0.98), M(0x9aa3ad), 0, 0.162, -0.48, base)
    // All keys sit in one group so the keyboard is a single hotspot (L1202).
    const kbHot = new THREE.Group()
    base.add(kbHot)
    const keyM = M(0xf3f5f8, { roughness: 0.5 })
    const keys = new Map()
    const keyList = []
    const addKey = (name, w, x, z, mat) => {
      const k = mk(B(w, 0.05, 0.16), mat || keyM, x, 0.19, z, kbHot)
      k.userData.base = 0.19
      k.userData.p = 0
      keys.set(name, k)
      keyList.push(k)
      return k
    }
    ;['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].forEach((row, r) => {
      ;[...row].forEach((ch, i) => addKey(ch, 0.19, -1.12 + r * 0.07 + i * 0.225, -0.86 + r * 0.19))
    })
    addKey(' ', 1.1, 0, -0.1)
    addKey('ENTER', 0.4, 1.15, -0.48, M(ACC, { roughness: 0.5 }))
    addKey('BACKSPACE', 0.4, 1.15, -0.86)
    mk(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), M(0xe8452e, { roughness: 0.9 }), 0.17, 0.2, -0.39, base)
    mk(B(0.84, 0.008, 0.52), M(0xb6bec7, { roughness: 0.4 }), 0, 0.164, 0.5, base)
    ;[-0.21, 0.21].forEach((bx) => mk(B(0.4, 0.014, 0.12), M(0x9aa3ad), bx, 0.166, 0.86, base))
    const pbtn = new THREE.Group()
    pbtn.position.set(1.28, 0.17, -0.97)
    base.add(pbtn)
    mk(new THREE.CylinderGeometry(0.065, 0.065, 0.03, 20), M(0xe8572a, { roughness: 0.4 }), 0, 0, 0, pbtn)
    const powerLED = mk(B(0.08, 0.025, 0.01), M(0x2a2a2a, { emissive: 0x000000 }), -1.1, 0.08, 1.052, base)
    // The floppy drive on the front face (R14): a bezel, the dark mouth the floppy slides into,
    // an eject button and the drive LED.
    mk(B(...SLOT.frame), M(0x9aa3ad), SLOT.x, SLOT.y, SLOT.z + 0.001, base)
    mk(B(SLOT.w, SLOT.h, 0.008), M(0x05070a, { roughness: 1 }), SLOT.x, SLOT.y, SLOT.z + 0.006, base)
    mk(B(0.06, 0.02, 0.01), M(0x6f7883), SLOT.eject[0], SLOT.eject[1], SLOT.z + 0.006, base)
    const driveLED = mk(B(0.06, 0.018, 0.008), M(0x2a2a2a, { emissive: 0x000000 }), SLOT.led[0], SLOT.led[1], SLOT.z + 0.006, base)
    const note = canvasTex(256, 256, drawNote)
    const noteM = flat(note, 0.42, 0.42, 1.0, 0.17, 0.55, base)
    noteM.rotation.set(-Math.PI / 2, 0, 0.2)
    const sticker = canvasTex(256, 64, drawSticker)
    flat(sticker, 0.5, 0.125, -1.0, 0.166, 0.75, base).rotation.x = -Math.PI / 2
    // lid on a hinge at the back edge
    const LH = 2.25
    const hinge = new THREE.Group()
    hinge.position.set(0, 0.235, -1.05)
    base.add(hinge)
    mk(B(3.0, LH, 0.1), M(CASE, { roughness: 0.55 }), 0, LH / 2, -0.05, hinge)
    mk(new THREE.PlaneGeometry(2.74, 2.08), M(0x0b0f14, { roughness: 0.3 }), 0, 1.12, 0.002, hinge)
    let osState = os.state
    // `mirrorSrc` is the wallpaper canvas the mirror last drew (null: the blue fallback), so
    // the frame loop can redraw once the engine mounts or gets a size.
    let mirrorSrc = null
    // Set while the OS is interactive (the mirror is hidden behind the flat OS and not redrawn),
    // so the first frame after leaving redraws it once.
    let mirrorStale = false
    const wallCanvas = () => {
      const c = app.wallpaperEngine?.canvas
      return c && c.width > 0 && c.height > 0 ? c : null
    }
    const mirror = canvasTex(512, 384, (x, w, h) => {
      mirrorSrc = osState === 'on' ? wallCanvas() : null
      drawMirror(x, w, h, osState, mirrorSrc ?? undefined)
    })
    flat(mirror, 2.6, 1.95, 0, 1.12, 0.004, hinge, true)
    const anchor = new THREE.Object3D()
    anchor.position.set(0, 1.12, 0.006)
    hinge.add(anchor)
    const logo = canvasTex(256, 128, drawLogo)
    const logoM = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.5),
      new THREE.MeshStandardMaterial({ map: logo.t, transparent: true, roughness: 0.4, emissive: 0x0b2a44 }),
    )
    logoM.position.set(0, LH / 2, -0.102)
    logoM.rotation.set(0, Math.PI, Math.PI)
    hinge.add(logoM)
    const screenL = new THREE.PointLight(0x7cc4ff, 0, 6, 2)
    screenL.position.set(0, 1.1, 1.0)
    hinge.add(screenL)
    let lidWasClosed = true
    hinge.rotation.x = Math.PI / 2

    // ---------- floppies, mug, lamp, plant (L1162–1179) ----------
    // Each floppy is a group (the insert tweens move it, and it carries the hotspot) holding its
    // mesh, which the hover wiggle turns, so the two never write the same rotation.
    const floppies = FLOPPIES.map((f) => {
      const lab = canvasTex(256, 256, (x, w, h) => drawFloppyLabel(x, w, h, f))
      const side = M(f.col, { roughness: 0.5 })
      const g = new THREE.Group()
      g.position.set(f.home[0], f.home[1], f.home[2])
      g.rotation.y = f.home[3]
      rig.add(g)
      const mesh = mk(B(0.5, 0.03, 0.52), [side, side, hued(new THREE.MeshStandardMaterial({ map: lab.t, roughness: 0.6 }), f.col), side, side, side], 0, 0, 0, g)
      hitBox(g, HIT.floppy) // on the group, not the mesh the wiggle turns
      return { ...f, m: g, mesh, lab, wamp: 0 }
    })
    let driveBusy = 0
    // The McGill mug (R16). The outer group stands at MUG.pos and the hop tween moves it; the
    // inner `mugBody` takes the hover lift, holds the steam and turns the wordmark to the wide
    // camera (faceMug: per aspect, as phones pull the camera somewhere else).
    const mug = new THREE.Group()
    mug.position.set(...MUG.pos)
    rig.add(mug)
    const mugBody = new THREE.Group()
    mug.add(mugBody)
    let mugAspect = NaN
    const faceMug = (aspect) => {
      if (aspect === mugAspect) return
      mugAspect = aspect
      const wp = widePose(aspect).wp
      mugBody.rotation.y = faceAngle({ x: MUG.pos[0], z: MUG.pos[2] }, { x: wp[0], z: wp[2] })
    }
    faceMug(16 / 9)
    const mugLabel = canvasTex(MUG.label.w, MUG.label.h, drawMugLabel)
    // An open wall from θ π: the label's centre (u 0.5) lands on local +z, unmirrored.
    mk(
      new THREE.CylinderGeometry(MUG.rTop, MUG.rBot, MUG.h, MUG.segs, 1, true, Math.PI, Math.PI * 2),
      hued(new THREE.MeshStandardMaterial({ map: mugLabel.t, color: 0xffffff, roughness: 0.35 }), MUG.color),
      0,
      MUG.h / 2,
      0,
      mugBody,
    )
    const { inner, handle } = MUG
    const mugRed = M(MUG.color, { roughness: 0.35 })
    mk(
      new THREE.CylinderGeometry(inner.rTop, inner.rBot, inner.h, MUG.segs, 1, true),
      // Double-sided: it is the inside face that shows over the rim.
      M(inner.color, { roughness: 0.4, side: THREE.DoubleSide }),
      0,
      MUG.h - inner.h / 2,
      0,
      mugBody,
    )
    // A rounded lip over the gap between the walls, and the base under them.
    const lipR = (MUG.rTop + inner.rTop) / 2
    mk(new THREE.TorusGeometry(lipR, (MUG.rTop - inner.rTop) / 2, 8, MUG.segs), mugRed, 0, MUG.h, 0, mugBody).rotation.x = -Math.PI / 2
    mk(new THREE.CylinderGeometry(MUG.rBot, MUG.rBot, 0.004, MUG.segs), mugRed, 0, 0.002, 0, mugBody)
    mk(new THREE.CylinderGeometry(inner.rTop - 0.003, inner.rTop - 0.003, 0.004, 32), M(0x3b2314, { roughness: 0.2 }), 0, MUG.coffeeY, 0, mugBody)
    // The C-handle: a half torus turned −π/2 about z so it bulges out to +x. After that turn the
    // geometry's x runs up the mug, so `scale.x` is what stretches it vertically.
    const handleM = mk(new THREE.TorusGeometry(handle.R, handle.tube, 12, 24, handle.arc), mugRed, ...handle.center, mugBody)
    handleM.rotation.z = handle.rotZ
    handleM.scale.x = handle.scaleY
    // Steam: soft puffs rising from the coffee, hidden until the mug is hovered or refilled.
    const steamPos = new Float32Array(STEAM_N * 3)
    const steamV = new Float32Array(STEAM_N)
    for (let i = 0; i < STEAM_N; i++) {
      steamPos[i * 3] = (Math.random() - 0.5) * 0.12
      steamPos[i * 3 + 1] = STEAM_Y0 + Math.random() * (STEAM_Y1 - STEAM_Y0)
      steamPos[i * 3 + 2] = (Math.random() - 0.5) * 0.12
      steamV[i] = 0.14 + Math.random() * 0.12
    }
    const steamG = new THREE.BufferGeometry()
    const steamAttr = new THREE.BufferAttribute(steamPos, 3)
    steamG.setAttribute('position', steamAttr)
    const puff = canvasTex(64, 64, drawPuff)
    const steamM = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, map: puff.t, transparent: true, opacity: 0, depthWrite: false })
    const steam = new THREE.Points(steamG, steamM)
    steam.visible = false
    // Not a hit target: a Points raycast would catch everything within a unit of a puff.
    steam.raycast = () => {}
    mugBody.add(steam)
    let mugLift = 0
    let steamLevel = 0
    let steamT = 0
    const lamp = new THREE.Group()
    lamp.position.set(3.0, 0, -1.3)
    rig.add(lamp)
    const lampMat = M(0xe8572a, { roughness: 0.45 })
    mk(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 24), lampMat, 0, 0.04, 0, lamp)
    mk(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 8), lampMat, -0.15, 0.7, 0, lamp).rotation.z = 0.25
    mk(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), lampMat, -0.62, 1.42, 0, lamp).rotation.z = 1.05
    mk(
      new THREE.ConeGeometry(0.3, 0.4, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe8572a, roughness: 0.45, side: THREE.DoubleSide }),
      -1.02,
      1.42,
      0,
      lamp,
    ).rotation.z = 0.6
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }))
    bulb.position.set(-1.07, 1.32, 0)
    lamp.add(bulb)
    const lampL = new THREE.PointLight(0xffc27a, 1.5, 9, 1.5)
    lampL.position.set(-1.15, 1.2, 0)
    lamp.add(lampL)
    let lampOn = true
    // 1 lit, 0 dark: the frame eases it toward lampOn (instantly with reduced motion).
    let lampLevel = 1
    const BULB_ON = new THREE.Color(0xffe2b0)
    const BULB_OFF = new THREE.Color(0x3a3328)
    const plant = new THREE.Group()
    plant.position.set(-2.4, 0, -1.2)
    rig.add(plant)
    mk(new THREE.CylinderGeometry(0.18, 0.14, 0.3, 16), M(0xc66b3d), 0, 0.15, 0, plant)
    ;[[0, 0.42, 0, 0.16], [0.1, 0.5, 0.05, 0.12], [-0.09, 0.48, -0.04, 0.12], [0.02, 0.6, -0.02, 0.1]].forEach(([x, y, z, r]) =>
      mk(new THREE.SphereGeometry(r, 10, 8), M(0x3b8f5a), x, y, z, plant),
    )

    // ---------- tweens (L1182–1189) ----------
    const tweens = createTweenList((dur) => (isReduced() ? 0.01 : dur))
    const { tween } = tweens
    const floppySeq = createFloppySequencer({
      tween,
      onSound: () => app.snd.floppy?.(),
      onInserted: (f) => {
        driveBusy = 1.2
        app.ach.unlock('floppy')
        ctrl.enter()
        os.openApp(f.app)
      },
      onReopen: (f) => {
        ctrl.enter()
        os.openApp(f.app)
      },
    })
    // The light, the room fill and the bulb follow lampLevel (applyLamp); the toggle itself (the
    // achievement and the click) fires at once.
    function applyLamp(lv) {
      lampL.intensity = 1.5 * lv
      hemi.intensity = 0.18 + (0.55 - 0.18) * lv
      bulb.material.color.copy(BULB_OFF).lerp(BULB_ON, lv)
    }
    function setLamp(v) {
      lampOn = v
      if (isReduced()) {
        lampLevel = v ? 1 : 0
        applyLamp(lampLevel)
      }
      if (!v) app.ach.unlock('lamp')
      app.snd.tone?.(v ? 1200 : 800, 0.04, 'square', 0.05)
      return v
    }

    // ---------- hotspots (L1192–1205) ----------
    const actions = createHotspotActions({
      app,
      local: {
        swingTags: () => {
          tagSwing = 0.7
          tagT = 0
        },
        insertFloppy: (i) => floppySeq.insert(floppies[i]),
        hopMug: () => {
          // One hop at a time: a click mid-hop would otherwise queue a second one.
          if (tweens.busy(mug)) return
          const [x, y, z] = MUG.pos
          tween(mug, { p: { x, y: y + 0.25, z } }, 0.15, () => tween(mug, { p: { x, y, z } }, 0.2))
        },
        steam: (s) => {
          steamT = Math.max(steamT, s)
        },
        toggleLamp: () => setLamp(!lampOn),
        boostSnow: (s) => {
          snowBoost = s
        },
      },
    })
    const hot = []
    const addHot = (obj, label, glow) => {
      obj.userData.hot = { label, fn: actions.get(label), obj, glow }
      hot.push(obj)
    }
    addHot(hinge, 'Laptop · open me')
    addHot(pbtn, 'Power button')
    floppies.forEach((f) => addHot(f.m, 'Floppy · ' + f.label))
    addHot(tags, 'Dog tags')
    addHot(mug, 'McGill mug', MUG.glow)
    addHot(lamp, 'Desk lamp')
    addHot(pol, 'Polaroid')
    addHot(noteM, 'Sticky note')
    addHot(kbHot, 'Keyboard')
    addHot(skyM, 'Window')

    // ---------- input (L1208–1220) ----------
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const pointer = { x: 0, y: 0 }
    const sp = { x: 0, y: 0 }
    let yaw = 0
    let yawT = 0
    let drag = null
    let hover = null
    // Whether the pointer is on any part of the laptop (base, keys, lid), for the peek latch.
    let overLaptop = false
    let peekLatched = false
    function aim(e) {
      const r = canvas.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
    }
    function pick(e) {
      aim(e)
      const h = ray.intersectObjects(hot, true)[0]
      return h ? (hotspotOf(h.object)?.obj ?? null) : null
    }
    const hueOf = (mt) => {
      const h = mt.userData.hue ?? mt.color?.getHex?.()
      return typeof h === 'number' ? h : 0x808080
    }
    function glow(o, on) {
      if (!o) return
      const k = o.userData.hot?.glow ?? GLOW_K
      o.traverse((m) => {
        if (!m.isMesh) return
        for (const mt of [].concat(m.material)) {
          if (!mt.emissive) continue
          if (!mt.userData.e0) mt.userData.e0 = mt.emissive.clone()
          if (on) mt.emissive.setRGB(...glowColor(hueOf(mt), k))
          else mt.emissive.copy(mt.userData.e0)
        }
      })
    }
    const hideTip = () => {
      if (tipEl) tipEl.hidden = true
    }
    function clearHover() {
      glow(hover, false)
      hover = null
      overLaptop = false
      hideTip()
    }
    const listen = (target, type, fn) => {
      target.addEventListener(type, fn)
      listeners.push([target, type, fn])
    }
    const on = (type, fn) => listen(canvas, type, fn)
    // The parallax target follows the cursor over the whole stage, the DOM screen included, so
    // crossing onto the screen no longer snaps the camera back to centre.
    listen(stage, 'pointermove', (e) => {
      const r = stage.getBoundingClientRect()
      if (!r.width || !r.height) return
      pointer.x = (e.clientX - r.left) / r.width - 0.5
      pointer.y = (e.clientY - r.top) / r.height - 0.5
    })
    listen(stage, 'pointerleave', () => {
      pointer.x = pointer.y = 0
    })
    on('pointermove', (e) => {
      const r = canvas.getBoundingClientRect()
      if (drag) {
        const dx = e.clientX - drag.x
        if (Math.abs(dx) > 5) drag.moved = true
        if (ctrl.z < 0.5) yawT = dragYaw(drag.yaw, dx)
        return
      }
      const o = ctrl.z < 0.9 ? pick(e) : null
      // Any laptop part counts (the base body too, which is not a hotspot), checked only at the
      // desk, where the lid can peek; `pick` has just aimed the ray.
      overLaptop = ctrl.z < 0.02 && ray.intersectObjects([base], true).length > 0
      if (o !== hover) {
        glow(hover, false)
        hover = o
        glow(hover, true)
      }
      canvas.style.cursor = hover ? 'pointer' : ctrl.z < 0.5 ? 'grab' : 'default'
      if (!tipEl) return
      if (hover) {
        tipEl.hidden = false
        tipEl.textContent = hover.userData.hot.label
        tipEl.style.transform = 'translate(' + (e.clientX - r.left + 14) + 'px,' + (e.clientY - r.top + 14) + 'px)'
      } else tipEl.hidden = true
    })
    on('pointerdown', (e) => {
      drag = { x: e.clientX, yaw: yawT, moved: false }
    })
    on('pointerup', (e) => {
      const d = drag
      drag = null
      if (d && !d.moved && ctrl.z < 0.9) {
        const o = pick(e)
        if (o) {
          o.userData.hot.fn()
          hideTip()
        }
      }
    })
    on('pointerleave', () => {
      drag = null
      clearHover()
    })

    // ---------- mirror and the font gate (L1223–1232, D17) ----------
    function onOS(s) {
      osState = s
      mirror.redraw()
    }
    const redrawText = () => [mirror, note, sticker, logo, mugLabel, ...floppies.map((f) => f.lab)].forEach((t) => t.redraw())
    // One redraw once every face has loaded (a face that fails to load is skipped) and the font
    // set is ready, so a late face does not leave a label in its fallback.
    const fonts = globalThis.document?.fonts
    if (fonts) {
      const loads = typeof fonts.load === 'function' ? CANVAS_FONTS.map((f) => Promise.resolve(fonts.load(f)).catch(() => null)) : []
      Promise.all(loads)
        .then(() => fonts.ready)
        .then(redrawText, () => {})
    }

    // ---------- resize (L1235; narrow mode is the stage's job) ----------
    function resize() {
      const w = stage.clientWidth
      const h = stage.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      css?.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    ro = new ResizeObserver(resize)
    ro.observe(stage)
    resize()

    // ---------- frame (L1239–1266), driven by the shared ticker ----------
    const tmpS = new THREE.Vector3()
    const tmpQ = new THREE.Quaternion()
    const look = new THREE.Vector3()
    const aPos = new THREE.Vector3()
    const aN = new THREE.Vector3()
    let discoT = 0
    let peek = 0

    // Hover play (R16): the mug lifts and steams, a floppy wiggles, the lamp eases. With reduced
    // motion every target is applied at once and the lift, steam and wiggle stay at rest.
    function stepProps(t, dt, reduced) {
      const ease = (cur, target, rate) => (reduced ? target : approach(cur, target, dt, rate))
      const mugHot = hover === mug
      mugLift = ease(mugLift, mugHot && !reduced ? MUG.lift : 0, RATE.lift)
      mugBody.position.y = mugLift
      steamT = Math.max(0, steamT - dt)
      steamLevel = ease(steamLevel, !reduced && (mugHot || steamT > 0) ? 1 : 0, RATE.steam)
      if (steamLevel < 0.01 && !(mugHot || steamT > 0)) steamLevel = 0
      steam.visible = steamLevel > 0.01
      steamM.opacity = 0.35 * steamLevel
      if (steam.visible) {
        for (let i = 0; i < STEAM_N; i++) {
          const y0 = steamPos[i * 3 + 1]
          const y = stepSteam(y0, steamV[i], dt)
          steamPos[i * 3 + 1] = y
          steamPos[i * 3] += Math.sin(t / 500 + i * 1.7) * 0.0008
          if (y < y0) {
            steamPos[i * 3] = (Math.random() - 0.5) * 0.12
            steamPos[i * 3 + 2] = (Math.random() - 0.5) * 0.12
          }
        }
        steamAttr.needsUpdate = true
      }
      for (const f of floppies) {
        const wiggles = !reduced && hover === f.m && floppySeq.inDrive !== f && !tweens.busy(f.m)
        f.wamp = ease(f.wamp, wiggles ? WIGGLE_AMP : 0, RATE.wiggle)
        if (f.wamp < 1e-4 && !wiggles) f.wamp = 0
        // About y, not z: a roll would dip the edge of a stacked floppy into the one below.
        f.mesh.rotation.y = f.wamp ? wiggle(t, f.wamp) : 0
      }
      const lt = lampOn ? 1 : 0
      if (lampLevel !== lt) {
        lampLevel = ease(lampLevel, lt, RATE.lamp)
        if (Math.abs(lampLevel - lt) < 0.002) lampLevel = lt
        applyLamp(lampLevel)
      }
    }
    // Style writes only on change, so a resting frame does not invalidate the holder's style.
    function setHolderStyle(prop, v) {
      if (holder.style[prop] !== v) holder.style[prop] = v
    }

    function frame(t, dt) {
      if (disposed) return
      const z = ctrl.z
      const w = stage.clientWidth
      const h = stage.clientHeight
      if (!w || !h) return
      const e = camE(z)
      const aspect = w / h
      // lid: the timeline opens it, then the camera dollies in
      const le = lidOf(z)
      const reduced = isReduced()
      // R16: the closed lid peeks open while hovered at the desk; the timeline (lidBoot, the
      // holder fade) keeps using `le` alone.
      // The dive clears the hover: no glow, tooltip or hover play once the camera is going in.
      if (z >= 0.9 && hover) clearHover()
      peekLatched = peekLatch(peekLatched, hover === hinge, overLaptop)
      const pt = peekTarget({ hovered: peekLatched, z, reduce: reduced })
      peek = reduced ? pt : approach(peek, pt, dt, RATE.peek)
      hinge.rotation.x = hingeAngle(le) - peek
      const lb = lidBoot(le, lidWasClosed, os.state)
      lidWasClosed = lb.wasClosed
      if (lb.boot) os.boot()
      // The DOM screen fades in over the drawn mirror while the lid opens, instead of a hard cut.
      const a = holderAlpha(le)
      setHolderStyle('opacity', a === 1 ? '' : String(Math.round(a * 1000) / 1000))
      setHolderStyle('visibility', a > 0 ? '' : 'hidden')
      // Inside, the OS is flat in the flat host (R4): no 3D pass, and no size writes that would
      // fight its 2D fit. The cheap state below (LEDs, keys, snow, tweens) keeps running.
      const flatInside = ctrl.store.get().interactive
      if (!flatInside) {
        if (!ctrl.store.get().narrow) {
          // R12: the screen grows out of the bezel to the full view late in the dive.
          const s = widenSize(z, w, h)
          os.setSize(s.w, s.h)
        }
        const vig = vignetteAlpha(z)
        const v = vig === 1 ? '' : String(Math.round(vig * 1000) / 1000)
        if (holder.style.getPropertyValue('--vig') !== v) holder.style.setProperty('--vig', v)
      }
      const fog = fogFor(widePose(aspect).k)
      faceMug(aspect)
      if (scene.fog.near !== fog.near || scene.fog.far !== fog.far) {
        scene.fog.near = fog.near
        scene.fog.far = fog.far
      }
      const fov = camFov(aspect)
      if (camera.fov !== fov) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
      const d = camDistance(fov, aspect)
      sp.x = stepParallax(sp.x, pointer.x)
      sp.y = stepParallax(sp.y, pointer.y)
      yaw += (yawT - yaw) * 0.1
      rig.rotation.y = yaw * (1 - e)
      rig.updateMatrixWorld(true)
      anchor.getWorldPosition(aPos)
      anchor.getWorldQuaternion(tmpQ)
      aN.set(0, 0, 1).applyQuaternion(tmpQ)
      const pose = cameraPose({ e, aspect, sp, aPos, aN, d, reduce: reduced })
      camera.position.set(pose.pos.x, pose.pos.y, pose.pos.z)
      look.set(pose.look.x, pose.look.y, pose.look.z)
      camera.lookAt(look)
      tweens.step(dt)
      stepProps(t, dt, reduced)
      tagT += dt
      tagSwing *= Math.pow(0.6, dt)
      tags.rotation.z = tagAngle(tagT, tagSwing, reduced)
      for (const k of keyList) {
        if (k.userData.p > 0) {
          const s = stepKey(k.userData.p, dt, k.userData.base)
          k.userData.p = s.p
          k.position.y = s.y
        }
      }
      const sb = snowBoost > 0 ? 3.5 : 1
      snowBoost = Math.max(0, snowBoost - dt)
      for (let i = 0; i < SN; i++) {
        const y0 = snowPos[i * 3 + 1]
        const y = stepSnow(y0, snowV[i], dt, sb)
        snowPos[i * 3 + 1] = y
        snowPos[i * 3] += Math.sin(t / 900 + i) * 0.0015
        if (y > y0) snowPos[i * 3] = -4.65 + Math.random() * 2.3
      }
      snowAttr.needsUpdate = true
      powerLED.material.emissive.setHex(ledPower(osState, t))
      driveBusy = Math.max(0, driveBusy - dt)
      driveLED.material.emissive.setHex(ledDrive(driveBusy, osState, t))
      if (flatInside) mirrorStale = true
      else if (mirrorStale || (osState === 'on' && wallCanvas() !== mirrorSrc)) {
        mirrorStale = false
        mirror.redraw()
      }
      screenL.intensity += (screenLightTarget(osState, le) - screenL.intensity) * 0.08
      if (discoT > 0) {
        discoT -= dt
        lampL.color.setHSL((t / 700) % 1, 0.85, 0.6)
        if (discoT <= 0) lampL.color.setHex(0xffc27a)
      }
      if (flatInside) return
      renderer.render(scene, camera)
      if (css) {
        anchor.matrixWorld.decompose(cssObj.position, cssObj.quaternion, tmpS)
        cssObj.scale.setScalar(2.6 / OS_W)
        css.render(cssScene, camera)
      }
    }

    const api = {
      css: Boolean(css),
      frame,
      onOS,
      pressKey(k) {
        const m = keys.get(String(k).toUpperCase())
        if (m) m.userData.p = 1
      },
      openLid: () => ctrl.enter(),
      drive(s) {
        driveBusy = Math.max(driveBusy, s)
      },
      disco(s) {
        discoT = s
      },
      snow(s) {
        snowBoost = s
      },
      lamp: () => setLamp(!lampOn),
      dispose,
    }
    offs.push(wireScene(api, app))
    return api
  }
}
