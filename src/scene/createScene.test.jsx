// Phase 7 TEST LIST: scene/createScene.test.js (lifecycle). `three` and its CSS3D addon are
// mocked. Every constructed object is a recording proxy, so the test can check which resources
// were created and which were disposed, and whether the DOM was cleaned up.
// jsdom has no WebGL: nothing here renders. Assumed signature (see the report):
// createScene({ mount, stage, holder, park, tipEl, app, reduce }).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode, useRef } from 'react'
import { render, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp } from '../app/createApp.js'
import { AppProvider } from '../app/AppContext.jsx'
import SceneMount from '../stage/SceneMount.jsx'

// The three fake is shared with laptopBuild.test.js (src/test/threeMock.js). It is loaded through
// vi.hoisted so the vi.mock factories below can read it.
const T = await vi.hoisted(async () => {
  const { createThreeFake } = await import('../test/threeMock.js')
  return createThreeFake()
})

vi.mock('three', () => T.three)
vi.mock('three/examples/jsm/renderers/CSS3DRenderer.js', () => T.css3d)
vi.mock('three/examples/jsm/geometries/RoundedBoxGeometry.js', () => ({ RoundedBoxGeometry: T.jsm.RoundedBoxGeometry }))
vi.mock('three/examples/jsm/utils/BufferGeometryUtils.js', () => ({ BufferGeometryUtils: T.jsm.BufferGeometryUtils }))

import { createScene, CANVAS_FONTS, GLOW_K } from './createScene.js'
import { MUG, HIT } from './props.js'
import { FLOPPIES } from './floppy.js'
import { OS_W, OS_H } from '../core/constants.js'
import { glowColor, widePose } from './sceneMath.js'
import { ADDITIVE_BLENDING } from '../test/threeMock.js'

const { state } = T
// R4-2: the body, keycap, icon and merged geometries, and the PMREM render target, are resources too.
const RESOURCE_KINDS = new Set([
  'BoxGeometry',
  'PlaneGeometry',
  'CylinderGeometry',
  'SphereGeometry',
  'TorusGeometry',
  'ConeGeometry',
  'ExtrudeGeometry',
  'ShapeGeometry',
  'CircleGeometry',
  'RoundedBoxGeometry',
  'BufferGeometry',
  'MeshStandardMaterial',
  'MeshBasicMaterial',
  'PointsMaterial',
  'CanvasTexture',
  'WebGLRenderTarget',
])
const POINTER_EVENTS = ['pointermove', 'pointerdown', 'pointerup', 'pointerleave']

/** Recorded method calls; `kind` undefined matches every kind. */
function callsOn(kind, method, id) {
  return state.calls.filter(
    (c) => (kind === undefined || c.kind === kind) && c.method === method && (id === undefined || c.id === id),
  )
}
function createdOf(kind) {
  return state.created.filter((o) => o.__kind === kind)
}

/** Wraps a store's subscribe so the test can count live subscriptions. */
function trackSubs(store) {
  const live = new Set()
  const orig = store.subscribe
  store.subscribe = (fn) => {
    const off = orig(fn)
    live.add(off)
    return () => {
      live.delete(off)
      off()
    }
  }
  return live
}

function setup({ failOn = null } = {}) {
  const app = createApp()
  const subs = {
    os: trackSubs(app.os.store),
    wallpaper: trackSubs(app.wallpaper.store),
  }
  const mount = document.createElement('div')
  const stage = document.createElement('div')
  const tipEl = document.createElement('div')
  const park = document.createElement('div')
  document.body.append(mount, stage, park)
  const holder = app.host.holder
  state.failOn = failOn

  const addSpy = vi.spyOn(HTMLCanvasElement.prototype, 'addEventListener')
  const removeSpy = vi.spyOn(HTMLCanvasElement.prototype, 'removeEventListener')

  const observers = []
  class FakeResizeObserver {
    constructor() {
      this.disconnect = vi.fn()
      this.observe = vi.fn()
      observers.push(this)
    }
  }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  const intersectionCtor = vi.fn()
  class FakeIntersectionObserver {
    constructor() {
      intersectionCtor()
      this.disconnect = vi.fn()
      this.observe = vi.fn()
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)

  return {
    app,
    subs,
    mount,
    stage,
    tipEl,
    park,
    holder,
    addSpy,
    removeSpy,
    observers,
    intersectionCtor,
    build: (extra = {}) =>
      createScene({ mount, stage, holder, park, tipEl, app, reduce: false, ...extra }),
  }
}

describe('scene/createScene lifecycle', () => {
  beforeEach(() => {
    state.calls = []
    state.created = []
    state.failOn = null
    state.seq = 0
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('creates one WebGL renderer, appends the gl canvas to the mount, and parks a CSS3D element after it', () => {
    const env = setup()
    const api = env.build()
    expect(createdOf('WebGLRenderer')).toHaveLength(1)
    const canvas = env.mount.querySelector('canvas.gl')
    expect(canvas).not.toBeNull()
    expect(env.mount.querySelector('.css3d')).not.toBeNull()
    expect(env.mount.children[0]).toBe(canvas)
    expect(api).toBeTruthy()
    api.dispose()
  })

  it('creates no IntersectionObserver of its own (the ticker owns the loop)', () => {
    const env = setup()
    const api = env.build()
    expect(env.intersectionCtor).not.toHaveBeenCalled()
    api.dispose()
  })

  it('dispose() releases the renderer (dispose and forceContextLoss), and removes the canvas and CSS3D DOM', () => {
    const env = setup()
    const api = env.build()
    const renderer = createdOf('WebGLRenderer')[0]

    api.dispose()

    expect(callsOn('WebGLRenderer', 'dispose', renderer.__id)).toHaveLength(1)
    expect(callsOn('WebGLRenderer', 'forceContextLoss', renderer.__id)).toHaveLength(1)
    expect(env.mount.childNodes).toHaveLength(0)
    expect(env.tipEl.hidden).toBe(true)
  })

  it('dispose() returns the holder to the park and removes the CSS3D object from its scene', () => {
    const env = setup()
    const api = env.build()
    const css = createdOf('CSS3DRenderer')[0]
    expect(css).toBeDefined()
    expect(env.holder.parentNode).not.toBe(env.park)

    api.dispose()

    expect(env.park.contains(env.holder)).toBe(true)
    expect(createdOf('CSS3DObject')).toHaveLength(1)
    expect(callsOn('Scene', 'remove').length).toBeGreaterThan(0)
  })

  it('dispose() disposes every geometry, material and canvas texture that was created', () => {
    const env = setup()
    const api = env.build()
    const resources = state.created.filter((o) => RESOURCE_KINDS.has(o.__kind))
    expect(resources.length).toBeGreaterThan(0)

    api.dispose()

    const disposedIds = new Set(callsOn(undefined, 'dispose').map((c) => c.id))
    for (const r of resources) {
      expect(disposedIds.has(r.__id), `${r.__kind} #${r.__id} disposed`).toBe(true)
    }
  })

  it('dispose() removes every canvas pointer listener it added', () => {
    const env = setup()
    const api = env.build()
    const addedPairs = env.addSpy.mock.calls.filter(([type]) => POINTER_EVENTS.includes(type))
    expect(addedPairs.length).toBeGreaterThanOrEqual(4)

    api.dispose()
    const removedPairs = env.removeSpy.mock.calls.filter(([type]) => POINTER_EVENTS.includes(type))
    for (const [type, fn] of addedPairs) {
      expect(removedPairs.some(([t, f]) => t === type && f === fn), `removed ${type}`).toBe(true)
    }
  })

  it('the scene api has no setWall (the corkboard is gone) and the app has no wall store', () => {
    const env = setup()
    const api = env.build()
    expect(api).not.toHaveProperty('setWall')
    expect(env.app.wall).toBeUndefined()
    api.dispose()
  })

  // Round 2 Phase 2 TEST LIST item 11 (R4): while the OS is interactive it is flat, so the 3D pass is skipped.
  it('frame() skips the WebGL and CSS3D render while the OS is interactive, and renders again when it is not', () => {
    const env = setup()
    Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: 900 })
    const api = env.build()

    env.app.ctrl.store.set({ interactive: true })
    state.calls = []
    api.frame(0, 0.016)
    expect(callsOn('WebGLRenderer', 'render')).toHaveLength(0)
    expect(callsOn('CSS3DRenderer', 'render')).toHaveLength(0)

    env.app.ctrl.store.set({ interactive: false })
    state.calls = []
    api.frame(0, 0.016)
    expect(callsOn('WebGLRenderer', 'render').length).toBeGreaterThan(0)
    expect(callsOn('CSS3DRenderer', 'render').length).toBeGreaterThan(0)
    api.dispose()
  })

  // Round 2 Phase 2 TEST LIST item 11 (R4): inside, the OS is flat, so the mirror (the 3D laptop's
  // screen) is not redrawn either; the first frame after leaving redraws it once.
  it('frame() skips the mirror redraw while the OS is interactive, and redraws it once on the first frame after leaving', () => {
    const env = setup()
    Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: 900 })
    const api = env.build()
    env.app.os.store.set({ state: 'on' })
    // The wallpaper engine's canvas is the mirror's source; a sized canvas makes a redraw due.
    const wallCanvas = document.createElement('canvas')
    wallCanvas.width = 800
    wallCanvas.height = 600
    env.app.wallpaperEngine = { canvas: wallCanvas }
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    const mirrorDraws = () => getContext.mock.calls.filter(([type]) => type === '2d').length

    env.app.ctrl.store.set({ interactive: true })
    getContext.mockClear()
    api.frame(0, 0.016)
    api.frame(16, 0.016)
    expect(mirrorDraws()).toBe(0)

    env.app.ctrl.store.set({ interactive: false })
    getContext.mockClear()
    api.frame(32, 0.016)
    expect(mirrorDraws()).toBe(1)
    getContext.mockClear()
    api.frame(48, 0.016)
    expect(mirrorDraws()).toBe(0)

    getContext.mockRestore()
    api.dispose()
  })

  it('dispose() disconnects its ResizeObserver and unsubscribes from every store', () => {
    const env = setup()
    const api = env.build()
    expect(env.observers.length).toBeGreaterThanOrEqual(1)
    expect(env.subs.os.size + env.subs.wallpaper.size).toBeGreaterThan(0)

    api.dispose()

    for (const o of env.observers) expect(o.disconnect).toHaveBeenCalled()
    expect(env.subs.os.size).toBe(0)
    expect(env.subs.wallpaper.size).toBe(0)
  })

  // Round 2 Phase 3 TEST LIST 2 (R10/parallax): the parallax target is tracked on the stage, so it
  // keeps following the cursor over the DOM screen; the canvas keeps its own pick and hover listeners.
  it('the parallax pointer listeners (pointermove, pointerleave) are added to the stage element and removed by dispose()', () => {
    const env = setup()
    const stageAdd = vi.spyOn(env.stage, 'addEventListener')
    const stageRemove = vi.spyOn(env.stage, 'removeEventListener')
    const api = env.build()
    const added = stageAdd.mock.calls.map(([type, fn]) => [type, fn])
    for (const type of ['pointermove', 'pointerleave']) {
      expect(added.some(([t]) => t === type), `stage ${type} added`).toBe(true)
    }

    api.dispose()

    for (const [type, fn] of added.filter(([t]) => t === 'pointermove' || t === 'pointerleave')) {
      expect(
        stageRemove.mock.calls.some(([t, f]) => t === type && f === fn),
        `stage ${type} removed`,
      ).toBe(true)
    }
  })

  // Round 2 Phase 3 TEST LIST 2 (R11/R12, mirror crossfade): frame() writes the holder's opacity and clip,
  // and dispose() clears them with the visibility, so the holder is left as the host had it.
  it('after dispose(), holder.style.opacity, visibility and clipPath are "" (frame() had written them)', () => {
    const env = setup()
    Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: 900 })
    const api = env.build()

    // Mid-fade (le in (.42, .6)): the holder is partly transparent.
    env.app.ctrl.z = 0.25
    api.frame(0, 0.016)
    expect(env.holder.style.opacity, 'opacity while fading').not.toBe('')
    // Late widen (z in (.985, 1)): the holder grows out of the bezel and is never clipped.
    env.app.ctrl.z = 0.985
    api.frame(16, 0.016)
    expect(env.holder.style.clipPath, 'clip while widening').toBe('')

    api.dispose()

    expect(env.holder.style.opacity).toBe('')
    expect(env.holder.style.visibility).toBe('')
    expect(env.holder.style.clipPath).toBe('')
  })

  // Round 3 (R12 revised): the holder is never clipped, from the start of the widen to the full view.
  it('the holder is never clipped: clipPath stays "" across the whole widen (z .9 to 1)', () => {
    const env = setup()
    Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: 900 })
    const api = env.build()

    for (const z of [0.9, 0.97, 0.985, 0.99, 1]) {
      env.app.ctrl.z = z
      api.frame(0, 0.016)
      expect(env.holder.style.clipPath, `clip at z ${z}`).toBe('')
    }

    api.dispose()
  })

  // Round 3: dispose() puts the widened OS size back, so the holder is left at its host size.
  it('dispose() resets the widened OS size: holder width and height are "" (or OS_W px / OS_H px) after a late widen', () => {
    const env = setup()
    Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: 900 })
    const api = env.build()

    env.app.ctrl.z = 0.99
    api.frame(0, 0.016)
    expect(env.holder.style.width, 'widened width before dispose').not.toBe(OS_W + 'px')

    api.dispose()

    expect(['', OS_W + 'px']).toContain(env.holder.style.width)
    expect(['', OS_H + 'px']).toContain(env.holder.style.height)
  })

  // Round 4 R4-1 (plan §3 and §5 R4-1 item 7): the 20:13 screen is built from SCREEN in laptop.js.
  // SCREEN is loaded per test (not at the top), so a missing laptop.js fails only these R4-1 tests.
  it('the CSS3D screen is scaled by SCREEN.unit (0.00275 scene units per OS px), not 2.6 / OS_W', async () => {
    const { SCREEN } = await vi.importActual('./laptop.js')
    const env = setup()
    const api = env.build()
    api.frame(0, 0.016)
    const scaled = callsOn('CSS3DObject', 'setScalar')
    expect(scaled.length).toBeGreaterThan(0)
    expect(scaled.at(-1).args).toEqual([SCREEN.unit])
    expect(SCREEN.unit).toBeCloseTo(2.86 / OS_W, 12)
    // The scale is constant: frames that render (a sized stage, at the desk and in the dive) never
    // write it again, and every write there was is SCREEN.unit.
    Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: 900 })
    const before = callsOn('CSS3DObject', 'setScalar').length
    const renders = callsOn('CSS3DRenderer', 'render').length
    for (const [i, z] of [0, 0, 0.5, 0.9, 0.95].entries()) {
      env.app.ctrl.z = z
      api.frame(i * 16, 0.016)
    }
    expect(callsOn('CSS3DRenderer', 'render').length, 'the frames rendered the CSS3D pass').toBeGreaterThan(renders)
    expect(callsOn('CSS3DObject', 'setScalar')).toHaveLength(before)
    for (const c of callsOn('CSS3DObject', 'setScalar')) expect(c.args).toEqual([SCREEN.unit])
    api.dispose()
  })

  it('the lid mirror and bezel use a PlaneGeometry of SCREEN.w × SCREEN.h (2.86 × 1.859)', async () => {
    const { SCREEN } = await vi.importActual('./laptop.js')
    const env = setup()
    const api = env.build()
    const planes = createdOf('PlaneGeometry').filter((g) => g.__args[0] === SCREEN.w && g.__args[1] === SCREEN.h)
    expect(planes.length).toBeGreaterThan(0)
    expect(SCREEN.w).toBeCloseTo(2.86, 9)
    expect(SCREEN.h).toBeCloseTo(1.859, 9)
    api.dispose()
  })

  it('the camera anchor is an Object3D at (0, SCREEN.cy, 0.003) on the hinge', async () => {
    const { SCREEN } = await vi.importActual('./laptop.js')
    const env = setup()
    const api = env.build()
    const anchorSets = callsOn('Object3D', 'set')
    expect(
      anchorSets.some((c) => c.args[0] === 0 && Math.abs(c.args[1] - SCREEN.cy) < 1e-9 && Math.abs(c.args[2] - 0.003) < 1e-9),
    ).toBe(true)
    expect(SCREEN.cy).toBeCloseTo(1.0955, 9)
    api.dispose()
  })

  it('api.info() returns the renderer.info.render calls and triangles of the last frame', () => {
    const env = setup()
    const api = env.build()
    const renderer = createdOf('WebGLRenderer')[0]
    renderer.info = { render: { calls: 37, triangles: 1234 } }
    expect(api.info()).toEqual({ calls: 37, triangles: 1234 })
    api.dispose()
  })

  it('a failure while building disposes the partial work, removes the canvas, and rethrows (B7)', () => {
    const env = setup({ failOn: 'DirectionalLight' })
    expect(() => env.build()).toThrow('boom: DirectionalLight')

    expect(env.mount.querySelector('canvas.gl')).toBeNull()
    expect(env.mount.querySelector('.css3d')).toBeNull()
    const renderer = createdOf('WebGLRenderer')[0]
    expect(callsOn('WebGLRenderer', 'dispose', renderer.__id)).toHaveLength(1)
    expect(env.park.contains(env.holder)).toBe(true)
  })

  it('StrictMode double mount through SceneMount leaves exactly one live renderer, and unmount releases it', async () => {
    const env = setup()
    const app = createApp({
      loadScene: async () => ({
        // SceneMount passes createScene's own option shape; only the park comes from the test.
        createScene: (args) => {
          expect(args.holder).toBe(app.host.holder)
          return createScene({ ...args, park: env.park, reduce: false })
        },
      }),
    })
    function Harness() {
      const layer = useRef(null)
      const stage = useRef(null)
      const tip = useRef(null)
      return (
        <>
          <div ref={stage}>
            <div ref={layer} />
          </div>
          <div ref={tip} />
          <SceneMount sceneLayerRef={layer} stageRef={stage} tipRef={tip} />
        </>
      )
    }
    const { container, unmount } = render(
      <StrictMode>
        <AppProvider app={app}>
          <Harness />
        </AppProvider>
      </StrictMode>,
    )

    await waitFor(() => expect(app.scene.store.get().status).toBe('ready'))
    expect(container.querySelectorAll('canvas.gl')).toHaveLength(1)
    const renderers = createdOf('WebGLRenderer')
    expect(renderers).toHaveLength(1)
    expect(callsOn('WebGLRenderer', 'dispose', renderers[0].__id)).toHaveLength(0)

    unmount()

    expect(callsOn('WebGLRenderer', 'dispose', renderers[0].__id)).toHaveLength(1)
    expect(document.querySelectorAll('canvas.gl')).toHaveLength(0)
    app.dispose()
  })
})

// Round 2 Phase 4 TEST LIST 5 (R16): the McGill mug is an open cylinder with a half-torus handle,
// its label is a 1024 × 400 canvas texture, and the font gate loads EB Garamond for it.
describe('scene/createScene McGill mug and the font gate (round 2 phase 4)', () => {
  beforeEach(() => {
    state.calls = []
    state.created = []
    state.failOn = null
    state.seq = 0
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('CANVAS_FONTS includes the 500 64px "EB Garamond" face the mug label uses', () => {
    expect(CANVAS_FONTS).toContain('500 64px "EB Garamond"')
  })

  it('the font gate asks document.fonts to load that face', () => {
    const original = Object.getOwnPropertyDescriptor(document, 'fonts')
    const load = vi.fn(() => Promise.resolve([]))
    Object.defineProperty(document, 'fonts', { configurable: true, writable: true, value: { ready: Promise.resolve(), load } })
    try {
      const env = setup()
      const api = env.build()
      expect(load).toHaveBeenCalledWith('500 64px "EB Garamond"')
      api.dispose()
    } finally {
      if (original) Object.defineProperty(document, 'fonts', original)
    }
  })

  it('the mug label is redrawn once the fonts have loaded (it shows McGill twice: at build, then after the load)', async () => {
    const original = Object.getOwnPropertyDescriptor(document, 'fonts')
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      writable: true,
      value: { ready: Promise.resolve(), load: () => Promise.resolve([]) },
    })
    try {
      const env = setup()
      const api = env.build()
      const label = state.created.find((o) => o.__kind === 'CanvasTexture' && o.__args[0].width === 1024 && o.__args[0].height === 400)
      expect(label, 'mug label canvas texture').toBeDefined()
      const ctx = label.__args[0].getContext('2d')
      const mcGillDraws = () => ctx.calls.filter((c) => c[0] === 'fillText' && c[1] === 'McGill').length
      expect(mcGillDraws()).toBe(1)
      await new Promise((r) => setTimeout(r, 0))
      expect(mcGillDraws()).toBe(2)
      api.dispose()
    } finally {
      if (original) Object.defineProperty(document, 'fonts', original)
    }
  })

  it('the mug outer wall is an open-ended cylinder (openEnded, thetaStart π) with rTop 0.19 and rBot 0.17', () => {
    const env = setup()
    const api = env.build()
    const outer = state.created.filter((o) => o.__kind === 'CylinderGeometry' && o.__args[0] === 0.19 && o.__args[1] === 0.17)
    expect(outer.length).toBeGreaterThanOrEqual(1)
    expect(outer.some((o) => o.__args[5] === true && o.__args[6] === Math.PI)).toBe(true)
    api.dispose()
  })

  it('the mug handle is a half torus (TorusGeometry with arc π as its 5th argument)', () => {
    const env = setup()
    const api = env.build()
    expect(state.created.some((o) => o.__kind === 'TorusGeometry' && o.__args[4] === Math.PI)).toBe(true)
    api.dispose()
  })

  it('the mug label texture is disposed by dispose() like every other canvas texture', () => {
    const env = setup()
    const api = env.build()
    const label = state.created.find((o) => o.__kind === 'CanvasTexture' && o.__args[0].width === 1024 && o.__args[0].height === 400)
    expect(label).toBeDefined()
    api.dispose()
    expect(callsOn(undefined, 'dispose').some((c) => c.id === label.__id)).toBe(true)
  })
})

// Round 2 Phase 4 decisions: hover glow keeps each part's hue, the dive clears the hover, the lid
// peek latches while the pointer is on the laptop, and a mug click during its hop is not queued.
// Picks are driven by `state.hits` (what the raycaster returns) and pointer events on the canvas.
describe('scene/createScene hover, dive, peek latch and mug hop (round 2 phase 4 decisions)', () => {
  beforeEach(() => {
    state.calls = []
    state.created = []
    state.failOn = null
    state.seq = 0
    state.hits = []
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  const WRITE_METHODS = new Set(['copy', 'set', 'setRGB', 'setHex', 'setStyle'])
  const RED = 0xed1b2f
  const REST_LID = Math.PI / 2
  const PEEK = 7 * (Math.PI / 180)

  /** The hotspot group carrying `label` (addHot sets userData.hot on it). */
  const hotOf = (label) => state.created.find((o) => o.__kind === 'Group' && o.userData?.hot?.label === label)
  const canvasOf = (env) => env.mount.querySelector('canvas.gl')
  const pointer = (el, type, x = 10) => el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 10 }))
  /** Points the pointer at `label`: the next pointermove picks that hotspot. */
  const hoverOn = (env, label) => {
    state.hits = [{ object: hotOf(label) }]
    pointer(canvasOf(env), 'pointermove')
  }
  const sized = (env) => {
    Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: 900 })
  }
  /** Emissive writes recorded on one material (the mock records each call with its arguments). */
  const emissiveWrites = (mat) => state.calls.filter((c) => c.kind === 'MeshStandardMaterial' && c.id === mat.__id && WRITE_METHODS.has(c.method))
  /** The [r, g, b] a recorded write set, if it can be read: setRGB(r,g,b), setHex(n), or a Color(...) argument. */
  function rgbOf(args) {
    if (args.length === 3 && args.every((v) => typeof v === 'number')) return args
    if (args.length === 1 && typeof args[0] === 'number') return [(args[0] >> 16) & 255, (args[0] >> 8) & 255, args[0] & 255].map((v) => v / 255)
    if (args.length === 1 && Array.isArray(args[0]?.__args) && args[0].__kind === 'Color') return rgbOf(args[0].__args)
    return null
  }

  it('hovering the red mug glows with its own hue: the emissive write has r > g and r > b (not the fixed bluish 0x2e4d6b)', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    const mat = state.created.find((o) => o.__kind === 'MeshStandardMaterial' && o.__args[0]?.color === RED)
    expect(mat, 'mug red material').toBeDefined()

    hoverOn(env, 'McGill mug')

    const writes = emissiveWrites(mat)
    expect(writes.length, 'emissive written on hover').toBeGreaterThan(0)
    const rgb = rgbOf(writes.at(-1).args)
    expect(rgb, 'hover emissive is readable').not.toBeNull()
    const [r, g, b] = rgb
    expect(r).toBeGreaterThan(g)
    expect(r).toBeGreaterThan(b)
    api.dispose()
  })

  it('un-hovering restores the original emissive: the last write is a new value, not the glow', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    const mat = state.created.find((o) => o.__kind === 'MeshStandardMaterial' && o.__args[0]?.color === RED)

    hoverOn(env, 'McGill mug')
    const glowWrite = emissiveWrites(mat).at(-1)
    const before = emissiveWrites(mat).length
    pointer(canvasOf(env), 'pointerleave')

    const after = emissiveWrites(mat)
    expect(after.length, 'a restore write on un-hover').toBeGreaterThan(before)
    const restore = after.at(-1)
    expect(restore.args[0]).not.toBe(glowWrite.args[0])
    const rgb = rgbOf(restore.args)
    if (rgb) expect(rgb[0] > rgb[1] && rgb[0] > rgb[2]).toBe(false)
    api.dispose()
  })

  it('the dive clears the hover: at z 0.9 the lift settles to rest, the glow is restored and the tooltip is hidden', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    const mat = state.created.find((o) => o.__kind === 'MeshStandardMaterial' && o.__args[0]?.color === RED)
    const mugGroup = hotOf('McGill mug')
    const mugBody = mugGroup.children.find((c) => c.__kind === 'Group')

    env.app.ctrl.z = 0.5
    hoverOn(env, 'McGill mug')
    api.frame(0, 1)
    expect(mugBody.position.y, 'lifted while hovered at the desk').toBeGreaterThan(0.05)

    const before = emissiveWrites(mat).length
    env.app.ctrl.z = 0.9
    api.frame(16, 1)

    expect(mugBody.position.y, 'lift target is rest once the dive starts').toBeLessThan(1e-3)
    expect(emissiveWrites(mat).length, 'glow restored by the dive').toBeGreaterThan(before)
    expect(env.tipEl.hidden).toBe(true)
    api.dispose()
  })

  it('the lid peek latches: a lid hover opens it, a move onto the keyboard keeps it open, leaving the laptop eases it back', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    const hinge = hotOf('Laptop · open me')
    env.app.ctrl.z = 0

    hoverOn(env, 'Laptop · open me')
    api.frame(0, 1)
    expect(hinge.rotation.x).toBeCloseTo(REST_LID - PEEK, 3)

    hoverOn(env, 'Keyboard')
    api.frame(16, 1)
    expect(hinge.rotation.x, 'still peeked over the keyboard').toBeCloseTo(REST_LID - PEEK, 3)

    pointer(canvasOf(env), 'pointerleave')
    api.frame(32, 1)
    expect(hinge.rotation.x, 'eased back once the pointer left the laptop').toBeCloseTo(REST_LID, 3)
    api.dispose()
  })

  it('a base pick with no lid hover before it does not peek the lid', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    const hinge = hotOf('Laptop · open me')
    env.app.ctrl.z = 0

    hoverOn(env, 'Keyboard')
    api.frame(0, 1)
    expect(hinge.rotation.x).toBeCloseTo(REST_LID, 3)
    api.dispose()
  })

  it('a second click on the mug while its hop is running does not queue another hop (the mug is back at rest 0.4 s after the first click)', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    env.app.ctrl.z = 0
    const mugGroup = hotOf('McGill mug')
    // The mock does not store construction-time transforms, so the tween's start pose is set here.
    Object.assign(mugGroup.position, { x: MUG.pos[0], y: 0, z: MUG.pos[2] })
    Object.assign(mugGroup.rotation, { x: 0, y: 0, z: 0 })
    state.hits = [{ object: mugGroup }]
    const canvas = canvasOf(env)
    const click = () => {
      pointer(canvas, 'pointerdown')
      pointer(canvas, 'pointerup')
    }

    // One hop is up 0.15 s then down 0.2 s, so it is at rest from 0.35 s. A queued second hop would
    // hold the top for 0.15 s more and only then come down, so it is still above rest at 0.4 s.
    let elapsed = 0
    click()
    for (let i = 0; i < 5; i++) {
      elapsed += 0.01
      api.frame(elapsed * 1000, 0.01)
    }
    click()
    const late = []
    for (let i = 0; i < 60; i++) {
      elapsed += 0.01
      api.frame(elapsed * 1000, 0.01)
      if (elapsed >= 0.4) late.push(mugGroup.position.y)
    }
    expect(late.length).toBeGreaterThan(0)
    for (const y of late) expect(Math.abs(y), 'mug at rest after 0.4 s').toBeLessThan(1e-3)
    api.dispose()
  })
})

// Round 2 §7 6C TEST LIST item 2 (U15, U16): GLOW_K 0.2, the mug's own glow strength, and one invisible
// hit box per dog-tag group and per floppy group (its material is hidden, the mesh is not).
describe('scene/createScene glow strength and hit proxies (round 2 §7 6C)', () => {
  beforeEach(() => {
    state.calls = []
    state.created = []
    state.failOn = null
    state.seq = 0
    state.hits = []
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  const RED = 0xed1b2f
  const METAL = 0xc3ccd5
  /** The hot label of a group, or '' (a bare mock member is not a string, so it is not compared). */
  const labelOf = (o) => {
    const l = o.userData?.hot?.label
    return typeof l === 'string' ? l : ''
  }
  const hotOf = (label) => state.created.find((o) => o.__kind === 'Group' && labelOf(o) === label)
  /** The children of a hotspot group whose material is hidden: the hit boxes. */
  const hitMeshes = (group) => group.children.filter((c) => c.__kind === 'Mesh' && c.material?.__args?.[0]?.visible === false)
  const canvasOf = (env) => env.mount.querySelector('canvas.gl')
  const pointer = (el, type, x = 10) => el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 10 }))
  const sized = (env) => {
    Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: 900 })
  }
  const hoverOn = (env, label) => {
    state.hits = [{ object: hotOf(label) }]
    pointer(canvasOf(env), 'pointermove')
  }
  const emissiveWrites = (mat) =>
    state.calls.filter((c) => c.kind === 'MeshStandardMaterial' && c.id === mat.__id && (c.method === 'setRGB' || c.method === 'copy'))

  it('GLOW_K is 0.2', () => {
    expect(GLOW_K).toBe(0.2)
  })

  it('the mug hotspot carries its own glow strength, MUG.glow', () => {
    const env = setup()
    const api = env.build()
    expect(hotOf('McGill mug').userData.hot.glow).toBe(MUG.glow)
    api.dispose()
  })

  it('hovering the mug writes the glow at MUG.glow (the red at 0.1), not at GLOW_K', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    const mat = state.created.find((o) => o.__kind === 'MeshStandardMaterial' && o.__args[0]?.color === RED)
    expect(mat, 'mug red material').toBeDefined()

    hoverOn(env, 'McGill mug')

    const last = emissiveWrites(mat).at(-1)
    expect(last, 'emissive written on hover').toBeDefined()
    const want = glowColor(RED, MUG.glow)
    expect(last.args).toHaveLength(3)
    last.args.forEach((v, i) => expect(v).toBeCloseTo(want[i], 5))
    api.dispose()
  })

  it('a hotspot without its own strength glows at GLOW_K (dog tags: the metal at 0.2)', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    const metal = state.created.find((o) => o.__kind === 'MeshStandardMaterial' && o.__args[0]?.color === METAL)
    expect(metal, 'dog tag metal material').toBeDefined()

    hoverOn(env, 'Dog tags')

    const last = emissiveWrites(metal).at(-1)
    expect(last, 'emissive written on hover').toBeDefined()
    const want = glowColor(METAL, GLOW_K)
    last.args.forEach((v, i) => expect(v).toBeCloseTo(want[i], 5))
    api.dispose()
  })

  it('the dog tags group has exactly one hit box: hidden through its material, HIT.tags size, no shadow', () => {
    const env = setup()
    const api = env.build()
    const tags = hotOf('Dog tags')
    expect(tags).toBeDefined()

    const hits = hitMeshes(tags)
    expect(hits).toHaveLength(1)
    expect(hits[0].geometry.__args).toEqual(HIT.tags.size)
    expect(hits[0].castShadow).toBe(false)
    expect(hits[0].receiveShadow).toBe(false)
    expect(hits[0].visible).not.toBe(false)
    api.dispose()
  })

  it('each floppy group has one hit box of HIT.floppy size with no shadow', () => {
    const env = setup()
    const api = env.build()
    const floppies = state.created.filter((o) => o.__kind === 'Group' && labelOf(o).startsWith('Floppy · '))
    expect(floppies.length).toBeGreaterThan(0)

    for (const f of floppies) {
      const hits = hitMeshes(f)
      expect(hits, labelOf(f)).toHaveLength(1)
      expect(hits[0].geometry.__args, labelOf(f)).toEqual(HIT.floppy.size)
      expect(hits[0].castShadow, labelOf(f)).toBe(false)
      expect(hits[0].receiveShadow, labelOf(f)).toBe(false)
    }
    api.dispose()
  })

  // Phones pull the wide shot back by k (widePose(aspect).k), so the floppies sit smaller in view
  // and their invisible hit boxes grow with it in x only: scale.x follows k, scale.z stays 1 (a deeper
  // box would reach across the pile into the floppy in front), scale.y is untouched.
  describe('floppy hit boxes follow the phone pull-back k', () => {
    const PHONE = { w: 390, h: 844 }
    const DESKTOP = { w: 1440, h: 900 }
    const sizeStage = (env, { w, h }) => {
      Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: w })
      Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: h })
    }
    const floppyHits = () =>
      state.created
        .filter((o) => o.__kind === 'Group' && labelOf(o).startsWith('Floppy · '))
        .map((f) => {
          const hits = hitMeshes(f)
          expect(hits).toHaveLength(1)
          return hits[0]
        })

    it('on a phone, each floppy hit box scales x by widePose(aspect).k, and z stays 1, and k is above 1', () => {
      const env = setup()
      sizeStage(env, PHONE)
      const api = env.build()
      const k = widePose(PHONE.w / PHONE.h).k
      expect(k).toBeGreaterThan(1)
      const hits = floppyHits()
      expect(hits.length).toBeGreaterThan(0)
      for (const h of hits) {
        expect(h.scale.x).toBe(k)
        expect(h.scale.z).toBe(1)
        expect(h.scale.y).not.toBe(k)
      }
      api.dispose()
    })

    // Geometric check, pure math on the phone pose. Each floppy's hit box is HIT.floppy (centre at
    // its home plus HIT.floppy.pos, yawed by home[3] with the group, as the rig is unrotated at rest),
    // scaled by the hit's scale. A floppy's own centre must lie in its own box, and must not lie in
    // the box of any other floppy that is nearer the phone camera (widePose(aspect).wp).
    it('on a phone, no floppy centre lies in a nearer floppy hit box (z not stretched, yaw applied)', () => {
      const env = setup()
      sizeStage(env, PHONE)
      const api = env.build()
      const aspect = PHONE.w / PHONE.h
      const { wp } = widePose(aspect)
      const boxes = FLOPPIES.map((f) => {
        const hit = hitMeshes(hotOf('Floppy · ' + f.label))[0]
        const [hx0, hy0, hz0] = HIT.floppy.size
        const [px, py, pz] = HIT.floppy.pos
        const [x, y, z, yaw] = f.home
        const c = Math.cos(yaw)
        const s = Math.sin(yaw)
        return {
          label: f.label,
          // The world centre of the box, and its yaw about y.
          centre: [x + c * px + s * pz, y + py, z - s * px + c * pz],
          yaw,
          half: [(hx0 / 2) * hit.scale.x, (hy0 / 2) * hit.scale.y, (hz0 / 2) * hit.scale.z],
          scaleZ: hit.scale.z,
          home: [x, y, z],
        }
      })
      // Whether point p (world) lies in box b: move it into the box's own axes, then compare.
      const inside = (p, b) => {
        const dx = p[0] - b.centre[0]
        const dy = p[1] - b.centre[1]
        const dz = p[2] - b.centre[2]
        const c = Math.cos(b.yaw)
        const s = Math.sin(b.yaw)
        const lx = c * dx - s * dz
        const lz = s * dx + c * dz
        return Math.abs(lx) <= b.half[0] && Math.abs(dy) <= b.half[1] && Math.abs(lz) <= b.half[2]
      }
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

      let nearerPairs = 0
      for (const b of boxes) {
        expect(b.scaleZ, b.label).toBe(1)
        // Half depth stays inside the spacing (0.33) plus the margin (0.15).
        expect(b.half[2], b.label).toBeLessThanOrEqual(0.33 + 0.15)
        // Its own centre (the group origin) is in its own box.
        expect(inside(b.home, b), b.label).toBe(true)
      }
      for (const a of boxes) {
        for (const b of boxes) {
          if (a === b) continue
          if (dist(b.centre, wp) >= dist(a.centre, wp)) continue
          nearerPairs += 1
          expect(inside(a.home, b), `${a.label} centre in nearer ${b.label} box`).toBe(false)
        }
      }
      // The pile has floppies one behind another, so the check is not vacuous.
      expect(nearerPairs).toBeGreaterThan(0)
      api.dispose()
    })

    it('on desktop k is 1, so the floppy hit boxes keep their scale', () => {
      const env = setup()
      sizeStage(env, DESKTOP)
      const api = env.build()
      expect(widePose(DESKTOP.w / DESKTOP.h).k).toBe(1)
      for (const h of floppyHits()) {
        expect(h.scale.x).toBe(1)
        expect(h.scale.z).toBe(1)
      }
      api.dispose()
    })

    it('when the aspect changes (desktop to phone), the next frame rescales the floppy hit boxes', () => {
      const env = setup()
      sizeStage(env, DESKTOP)
      const api = env.build()
      sizeStage(env, PHONE)
      api.frame(0, 0.016)
      const k = widePose(PHONE.w / PHONE.h).k
      expect(k).toBeGreaterThan(1)
      for (const h of floppyHits()) {
        expect(h.scale.x).toBe(k)
        expect(h.scale.z).toBe(1)
      }
      api.dispose()
    })
  })
})

// A visible mesh is a real hit and beats a hit proxy (the invisible hitBox) even when the proxy is
// nearer. Among proxies alone the nearest one wins. The raycaster mock returns `state.hits` in the
// order given, so the array order is the distance order.
describe('scene/createScene pick: a real mesh beats a hit proxy', () => {
  beforeEach(() => {
    state.calls = []
    state.created = []
    state.failOn = null
    state.seq = 0
    state.hits = []
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  const labelOf = (o) => {
    const l = o.userData?.hot?.label
    return typeof l === 'string' ? l : ''
  }
  const hotOf = (label) => state.created.find((o) => o.__kind === 'Group' && labelOf(o) === label)
  const isProxy = (m) => m.material?.__args?.[0]?.visible === false
  const canvasOf = (env) => env.mount.querySelector('canvas.gl')
  const pointer = (el, type, x = 10) => el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 10 }))
  const sized = (env) => {
    Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: 900 })
  }
  /** The invisible hit box the code built into a hotspot group. */
  const proxyOf = (group) => {
    const m = group.children.find((c) => c.__kind === 'Mesh' && isProxy(c))
    expect(m, labelOf(group) + ' hit proxy').toBeDefined()
    // A real three material carries `visible`; the mock keeps only constructor args, so set it here.
    m.material.visible = false
    // The mock's add() does not set parent, and hotspotOf walks parent up to the hot group.
    m.parent = group
    m.userData = {}
    return m
  }
  /** A visible mesh that belongs to a hotspot group (the floppy's own mesh, or a prop's mesh). */
  const realMeshOf = (group) => {
    const m = group.children.find((c) => c.__kind === 'Mesh' && !isProxy(c))
    expect(m, labelOf(group) + ' real mesh').toBeDefined()
    m.material.visible = true
    m.parent = group
    m.userData = {}
    return m
  }
  /** Moves the pointer over the stage with the raycaster returning `hits`, then reads the tooltip. */
  const pickWith = (env, hits) => {
    state.hits = hits.map((object) => ({ object }))
    pointer(canvasOf(env), 'pointermove')
    return env.tipEl.hidden ? null : env.tipEl.textContent
  }

  it('a visible floppy mesh (GAMES, farther) beats the nearer invisible RESUME hit proxy', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    env.app.ctrl.z = 0
    const resume = hotOf('Floppy · RESUME')
    const games = hotOf('Floppy · GAMES')
    expect(resume, 'RESUME floppy group').toBeDefined()
    expect(games, 'GAMES floppy group').toBeDefined()

    const picked = pickWith(env, [proxyOf(resume), realMeshOf(games)])

    expect(picked).toBe(labelOf(games))
    api.dispose()
  })

  it('when the only hits are proxies, the nearest proxy wins (RESUME proxy before GAMES proxy gives RESUME)', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    env.app.ctrl.z = 0
    const resume = hotOf('Floppy · RESUME')
    const games = hotOf('Floppy · GAMES')

    const picked = pickWith(env, [proxyOf(resume), proxyOf(games)])

    expect(picked).toBe(labelOf(resume))
    api.dispose()
  })

  it('a visible prop mesh (McGill mug, farther) beats the nearer invisible dog-tags hit proxy', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    env.app.ctrl.z = 0
    const tags = hotOf('Dog tags')
    const mug = hotOf('McGill mug')
    expect(tags, 'dog tags group').toBeDefined()
    expect(mug, 'mug group').toBeDefined()
    // The mug has no visible mesh of its own in the mock's scene graph list, so one is built under it.
    const mugMesh = new T.three.Mesh(new T.three.BoxGeometry(0.2, 0.2, 0.2), new T.three.MeshStandardMaterial({ color: 0xed1b2f }))
    mug.add(mugMesh)

    const picked = pickWith(env, [proxyOf(tags), realMeshOf(mug)])

    expect(picked).toBe(labelOf(mug))
    api.dispose()
  })
})

// Round 4 Phase R4-2 TEST LIST (plan-r4 §5 R4-2 item 8): the MacBook body, the keycap mesh, the PMREM env
// (laptop only, with the no-env fallback), the key presses, the backlight, the laptop glow and the textures.
// The laptop library is read with vi.importActual inside each test, so a missing export fails only that test.
describe('scene/createScene laptop body, keyboard, env and backlight (round 4 R4-2)', () => {
  beforeEach(() => {
    state.calls = []
    state.created = []
    state.failOn = null
    state.seq = 0
    state.hits = []
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  const WRITE = new Set(['copy', 'set', 'setRGB', 'setHex', 'setStyle'])
  const CAPS = 77
  const hotOf = (label) => state.created.find((o) => o.__kind === 'Group' && o.userData?.hot?.label === label)
  const canvasOf = (env) => env.mount.querySelector('canvas.gl')
  const pointer = (el, type, x = 10) => el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 10 }))
  const hoverOn = (env, label) => {
    state.hits = [{ object: hotOf(label) }]
    pointer(canvasOf(env), 'pointermove')
  }
  const sized = (env) => {
    Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: 900 })
  }
  const emissiveWrites = (mat) => state.calls.filter((c) => c.kind === 'MeshStandardMaterial' && c.id === mat.__id && WRITE.has(c.method))
  const optsOf = (m) => m.__args?.[0] ?? {}
  const envOf = (m) => optsOf(m).envMap ?? Reflect.getOwnPropertyDescriptor(m, 'envMap')?.value
  /** The [r, g, b] a recorded write set: setRGB(r,g,b), setHex(n), or copy(Color). Null if unreadable. */
  function rgbOf(args) {
    if (args.length === 3 && args.every((v) => typeof v === 'number')) return args
    if (args.length === 1 && typeof args[0] === 'number') return [(args[0] >> 16) & 255, (args[0] >> 8) & 255, args[0] & 255].map((v) => v / 255)
    if (args.length === 1 && Array.isArray(args[0]?.__args) && args[0].__kind === 'Color') return rgbOf(args[0].__args)
    return null
  }
  const lastRgb = (mat) => {
    const w = emissiveWrites(mat).at(-1)
    return w ? rgbOf(w.args) ?? [NaN, NaN, NaN] : [0, 0, 0]
  }
  const close = (a, b, eps = 1e-6) => Array.isArray(a) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < eps)
  /** The keycap buffer: the Float32Array behind the one 77-cap position attribute. */
  const capsAttr = () => state.created.find((o) => o.__kind === 'BufferAttribute' && o.__args[0] instanceof Float32Array && o.__args[0].length === CAPS * 24 * 3)
  const capsMesh = () => state.created.find((o) => o.__kind === 'Mesh' && o.geometry?.attributes?.position === capsAttr())
  /** The top-most y of one cap's vertex range in the keycap buffer. */
  const topOf = (pos, [s, e]) => {
    let top = -Infinity
    for (let v = s; v < e; v++) top = Math.max(top, pos[3 * v + 1])
    return top
  }
  const rangeOf = (layout, id) => {
    const caps = layout.filter((k) => !k.touchId)
    const i = caps.findIndex((k) => k.id === id)
    expect(i, `cap ${id}`).toBeGreaterThanOrEqual(0)
    return [24 * i, 24 * i + 24]
  }
  /** Every vertex outside `range` keeps its y. */
  const outsideUnchanged = (pos, before, [s, e]) => {
    for (let v = 0; v < pos.length / 3; v++) if (v < s || v >= e) if (pos[3 * v + 1] !== before[3 * v + 1]) return false
    return true
  }

  it('the body is extruded: two ExtrudeGeometry bodies (base and lid), and the old boxes (3.0 × 0.16 × 2.1, LID.w × LID.h × 0.1) are gone', async () => {
    const LP = await vi.importActual('./laptop.js')
    const env = setup()
    const api = env.build()
    expect(createdOf('ExtrudeGeometry').length).toBeGreaterThanOrEqual(2)
    const boxes = createdOf('BoxGeometry').map((g) => g.__args)
    expect(boxes).not.toContainEqual([3, 0.16, 2.1])
    expect(boxes).not.toContainEqual([LP.LID.w, LP.LID.h, 0.1])
    api.dispose()
  })

  it('the keyboard is one keycap mesh of 77 caps (1,848 vertices), and it is the only child of the Keyboard group', () => {
    const env = setup()
    const api = env.build()
    expect(capsAttr(), 'the keycap position attribute').toBeDefined()
    const kb = hotOf('Keyboard')
    const meshes = kb.children.filter((c) => c.__kind === 'Mesh')
    expect(meshes).toHaveLength(1)
    expect(meshes[0].geometry.attributes.position).toBe(capsAttr())
    api.dispose()
  })

  it('the env is one PMREM built from a scene with sigma 0.04, and its generator is disposed during the build', () => {
    const env = setup()
    const api = env.build()
    const from = callsOn('PMREMGenerator', 'fromScene')
    expect(from).toHaveLength(1)
    expect(from[0].args[1]).toBe(0.04)
    expect(callsOn('PMREMGenerator', 'dispose')).toHaveLength(1)
    api.dispose()
  })

  it('dispose() releases the PMREM render target, like every other GPU resource', () => {
    const env = setup()
    const api = env.build()
    const rt = createdOf('WebGLRenderTarget')[0]
    expect(rt, 'the env render target').toBeDefined()
    api.dispose()
    expect(callsOn(undefined, 'dispose').some((c) => c.id === rt.__id)).toBe(true)
  })

  it('a failure in PMREMGenerator still builds the scene: the aluminium takes the no-env parameters and no material has an envMap', async () => {
    const LP = await vi.importActual('./laptop.js')
    const env = setup({ failOn: 'PMREMGenerator' })
    let api = null
    expect(() => {
      api = env.build()
    }).not.toThrow()
    const noEnv = LP.MATERIALS.alu.noEnv
    const mats = createdOf('MeshStandardMaterial')
    expect(mats.some((m) => optsOf(m).metalness === noEnv.metalness && optsOf(m).roughness === noEnv.roughness)).toBe(true)
    expect(mats.some((m) => envOf(m) !== undefined)).toBe(false)
    expect(() => api.frame(0, 0.016)).not.toThrow()
    api.dispose()
  })

  it('the env map is set on the laptop aluminium only: never on scene.environment, and not on the desk wood', async () => {
    const LP = await vi.importActual('./laptop.js')
    const env = setup()
    const api = env.build()
    const rt = createdOf('WebGLRenderTarget')[0]
    expect(Reflect.getOwnPropertyDescriptor(createdOf('Scene')[0], 'environment')).toBeUndefined()
    const alu = createdOf('MeshStandardMaterial').filter((m) => optsOf(m).metalness === LP.MATERIALS.alu.metalness)
    expect(alu.length).toBeGreaterThan(0)
    for (const m of alu) expect(envOf(m)).toBe(rt.texture)
    const desk = createdOf('MeshStandardMaterial').filter((m) => optsOf(m).color === 0x6e4a30)
    expect(desk.length).toBeGreaterThan(0)
    for (const m of desk) expect(envOf(m)).toBeUndefined()
    api.dispose()
  })

  it('pressKey("a") lowers the A cap by KEYBOARD.travel in the next frame and sets needsUpdate; the other caps stay put', async () => {
    const LP = await vi.importActual('./laptop.js')
    const env = setup()
    sized(env)
    const api = env.build()
    env.app.ctrl.z = 0
    const pos = capsAttr().__args[0]
    const attr = capsAttr()
    const range = rangeOf(LP.keyboardLayout(), 'A')
    const restA = topOf(pos, range)
    const before = Float32Array.from(pos)
    api.pressKey('a')
    attr.needsUpdate = false
    api.frame(16, 0.016)
    expect(restA - topOf(pos, range)).toBeCloseTo(LP.KEYBOARD.travel, 6)
    expect(attr.needsUpdate).toBe(true)
    expect(outsideUnchanged(pos, before, range)).toBe(true)
    api.dispose()
  })

  it('pressKey("ArrowUp") and pressKey("Escape") lower their own caps (the inverted T and the fn row)', async () => {
    const LP = await vi.importActual('./laptop.js')
    const env = setup()
    sized(env)
    const api = env.build()
    env.app.ctrl.z = 0
    const pos = capsAttr().__args[0]
    const layout = LP.keyboardLayout()
    const up = rangeOf(layout, 'ARROWUP')
    const esc = rangeOf(layout, 'ESCAPE')
    const restUp = topOf(pos, up)
    const restEsc = topOf(pos, esc)
    api.pressKey('ArrowUp')
    api.pressKey('Escape')
    api.frame(16, 0.016)
    expect(restUp - topOf(pos, up)).toBeCloseTo(LP.KEYBOARD.travel, 6)
    expect(restEsc - topOf(pos, esc)).toBeCloseTo(LP.KEYBOARD.travel, 6)
    api.dispose()
  })

  it('pressKey("Dead") is a no-op: no vertex moves and nothing is flagged for upload', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    env.app.ctrl.z = 0
    const pos = capsAttr().__args[0]
    const attr = capsAttr()
    const before = Float32Array.from(pos)
    api.pressKey('Dead')
    attr.needsUpdate = false
    api.frame(16, 0.016)
    expect(pos).toEqual(before)
    expect(attr.needsUpdate).toBe(false)
    api.dispose()
  })

  it('a pressed key springs back to rest within a few frames, and a resting keyboard writes nothing on later frames', async () => {
    const LP = await vi.importActual('./laptop.js')
    const env = setup()
    sized(env)
    const api = env.build()
    env.app.ctrl.z = 0
    const pos = capsAttr().__args[0]
    const attr = capsAttr()
    const range = rangeOf(LP.keyboardLayout(), 'A')
    const rest = topOf(pos, range)
    api.pressKey('a')
    api.frame(16, 0.016)
    for (let i = 0; i < 12; i++) api.frame(32 + 16 * i, 0.016)
    expect(topOf(pos, range)).toBeCloseTo(rest, 6)
    attr.needsUpdate = false
    api.frame(400, 0.016)
    expect(attr.needsUpdate).toBe(false)
    api.dispose()
  })

  it('hovering the Keyboard makes no glow write on the keycap material (its own emissive is the backlight)', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    const keyMat = capsMesh().material
    const before = emissiveWrites(keyMat).length
    hoverOn(env, 'Keyboard')
    expect(emissiveWrites(keyMat).length).toBe(before)
    api.dispose()
  })

  it('the keyboard backlight is off with the lid shut, and warm white (0xfff4e0 at full level) with the lid open and the OS on', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    const keyMat = capsMesh().material
    env.app.os.store.set({ state: 'on' })
    env.app.ctrl.z = 0
    api.frame(0, 0.016)
    const dark = lastRgb(keyMat)
    expect(dark[0]).toBeLessThan(0.01)
    env.app.ctrl.z = 0.6
    // R4-3 (D2): the backlight's power fades in at RATE.power 3/s, so it settles over ~3 s, not 5 frames.
    for (let i = 1; i <= 60; i++) api.frame(50 * i, 0.05)
    const lit = lastRgb(keyMat)
    expect(lit[0]).toBeCloseTo(1, 2)
    expect(lit[1]).toBeCloseTo(0xf4 / 255, 2)
    expect(lit[2]).toBeCloseTo(0xe0 / 255, 2)
    api.dispose()
  })

  it('the laptop hotspot glows at LAPTOP.glow (0.12) and not at GLOW_K, so the silver does not go chalky', async () => {
    const LP = await vi.importActual('./laptop.js')
    const env = setup()
    sized(env)
    const api = env.build()
    const hued = state.created.filter((o) => o.__kind === 'MeshStandardMaterial' && typeof o.userData.hue === 'number')
    hoverOn(env, 'Laptop · open me')
    const atLaptop = hued.filter((m) => emissiveWrites(m).some((w) => close(rgbOf(w.args), glowColor(m.userData.hue, LP.LAPTOP.glow))))
    expect(atLaptop.length, 'laptop parts written at LAPTOP.glow').toBeGreaterThan(0)
    const atGlowK = atLaptop.filter((m) => emissiveWrites(m).some((w) => close(rgbOf(w.args), glowColor(m.userData.hue, GLOW_K))))
    expect(atGlowK).toHaveLength(0)
    api.dispose()
  })

  it('the lid has no 256 × 128 JAY logo canvas; the keyboard atlas is 1024 × 424, its glow 512 × 212, and the Touch ID ring 64 × 64', () => {
    const env = setup()
    const api = env.build()
    const sizes = createdOf('CanvasTexture').map((t) => [t.__args[0].width, t.__args[0].height])
    expect(sizes).not.toContainEqual([256, 128])
    expect(sizes).toContainEqual([1024, 424])
    expect(sizes).toContainEqual([512, 212])
    expect(sizes).toContainEqual([64, 64])
    api.dispose()
  })

  it('the Power button is Touch ID: its group holds one hit box of HIT.touchId size', () => {
    const env = setup()
    const api = env.build()
    const pb = hotOf('Power button')
    expect(pb).toBeDefined()
    const hits = pb.children.filter((c) => c.__kind === 'Mesh' && c.material?.__args?.[0]?.visible === false)
    expect(hits).toHaveLength(1)
    expect(hits[0].geometry.__args).toEqual(HIT.touchId.size)
    api.dispose()
  })
})

// Round 4 R4-2 review follow-ups: the lamp drives the laptop's env intensity, the static room parts
// are merged (window frame, desk legs), and the three namespace is never passed as a value (so the
// lazy chunk keeps tree-shaking three).
describe('scene/createScene R4-2 follow-ups: lamp env intensity, merged room parts, tree-shaking', () => {
  beforeEach(() => {
    state.calls = []
    state.created = []
    state.failOn = null
    state.seq = 0
    state.hits = []
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  const optsOf = (m) => m.__args?.[0] ?? {}
  const envMats = () => createdOf('MeshStandardMaterial').filter((m) => optsOf(m).envMap !== undefined)
  const intensityOf = (m) => Reflect.getOwnPropertyDescriptor(m, 'envMapIntensity')?.value
  const sized = (env) => {
    Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: 900 })
  }

  it('every env material starts at its own env0 (the constructor intensity), and the desk wood never gets one', () => {
    const env = setup()
    const api = env.build()
    const mats = envMats()
    expect(mats.length).toBeGreaterThan(0)
    for (const m of mats) expect(m.userData.env0).toBe(optsOf(m).envMapIntensity)
    api.lamp()
    const desk = createdOf('MeshStandardMaterial').filter((m) => optsOf(m).color === 0x6e4a30)
    for (const m of desk) expect(intensityOf(m)).toBeUndefined()
    api.dispose()
  })

  it('with reduced motion the lamp sets the env intensity at once: off is env0 × ENV.min, on is env0 again', async () => {
    const { ENV } = await vi.importActual('./laptop.js')
    const env = setup()
    const api = env.build({ reduce: true })
    const mats = envMats()
    api.lamp()
    for (const m of mats) expect(intensityOf(m)).toBeCloseTo(m.userData.env0 * ENV.min, 9)
    api.lamp()
    for (const m of mats) expect(intensityOf(m)).toBeCloseTo(m.userData.env0, 9)
    api.dispose()
  })

  it('without reduced motion the env intensity eases down over frames and settles at env0 × ENV.min', async () => {
    const { ENV } = await vi.importActual('./laptop.js')
    const env = setup()
    sized(env)
    const api = env.build()
    const mats = envMats()
    api.lamp()
    api.frame(16, 0.05)
    for (const m of mats) {
      expect(intensityOf(m)).toBeLessThan(m.userData.env0)
      expect(intensityOf(m)).toBeGreaterThan(m.userData.env0 * ENV.min)
    }
    for (let i = 0; i < 60; i++) api.frame(32 + 16 * i, 0.1)
    for (const m of mats) expect(intensityOf(m)).toBeCloseTo(m.userData.env0 * ENV.min, 9)
    api.dispose()
  })

  it('the window frame (6 bars and the sill) is one merged mesh, and the Window hotspot is still the sky plane', () => {
    const env = setup()
    const api = env.build()
    const frame = createdOf('Mesh').filter((m) => optsOf(m.material).color === 0xe9edf2)
    expect(frame).toHaveLength(1)
    expect(frame[0].geometry.__args[0]).toHaveLength(7)
    const win = state.created.find((o) => o.userData?.hot?.label === 'Window')
    expect(win.__kind).toBe('Mesh')
    expect(win.geometry.__kind).toBe('PlaneGeometry')
    api.dispose()
  })

  it('the four desk legs are one merged mesh', () => {
    const env = setup()
    const api = env.build()
    const legs = createdOf('Mesh').filter((m) => optsOf(m.material).color === 0x3a2818)
    expect(legs).toHaveLength(1)
    expect(legs[0].geometry.__args[0]).toHaveLength(4)
    api.dispose()
  })

  it('the three namespace is only read through members (THREE.X), never passed as a value', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/scene/createScene.js'), 'utf8').replace(/\/\/.*$/gm, '')
    // Neither a member read (THREE.X) nor an object key (the injected `THREE: { … }` for laptopBuild).
    const bare = src.match(/\bTHREE\b(?![.:])/g) ?? []
    // The one bare use is the import itself: `import * as THREE from 'three'`.
    expect(bare).toHaveLength(1)
    expect(src).toMatch(/import \* as THREE from 'three'/)
  })
})

// Round 4 Phase R4-3 TEST LIST (plan-r4 §2 D1–D6, M18–M21, §5): the side slot's laptop, the MagSafe
// and drive LEDs, the braided cable, the contact shadow, the lid overshoot, the sheen sweep and the
// deck glow. Meshes are found by what they are (geometry size, texture size, blending, material
// writes), not by a name the implementation may not have.
describe('scene/createScene R4-3 LEDs, cable, contact shadow, lid overshoot, sheen and deck glow', () => {
  beforeEach(() => {
    state.calls = []
    state.created = []
    state.failOn = null
    state.seq = 0
    state.hits = []
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  const hotOf = (label) => state.created.find((o) => o.__kind === 'Group' && o.userData?.hot?.label === label)
  const canvasOf = (env) => env.mount.querySelector('canvas.gl')
  const pointer = (el, type, x = 10) => el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 10 }))
  const hoverOn = (env, label) => {
    state.hits = [{ object: hotOf(label) }]
    pointer(canvasOf(env), 'pointermove')
  }
  const sized = (env) => {
    Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: 900 })
  }
  const optsOf = (m) => m?.__args?.[0] ?? {}
  /** A material or geometry option, from its constructor arguments or a property set after it. */
  const propOf = (m, k) => optsOf(m)[k] ?? Reflect.getOwnPropertyDescriptor(m, k)?.value
  /** The last position (or rotation/scale) set on an object: the arguments of its recorded `set` call. */
  const setOf = (o) => state.calls.filter((c) => c.kind === o.__kind && c.id === o.__id && c.method === 'set').at(-1)?.args
  const parentOf = (o) => state.created.find((p) => p.children?.includes(o))
  const subtree = (o) => [o, ...(o.children ?? []).flatMap(subtree)]
  const planeOf = (w, h) => state.created.find((o) => o.__kind === 'Mesh' && o.geometry?.__kind === 'PlaneGeometry' && o.geometry.__args?.[0] === w && o.geometry.__args?.[1] === h)
  /** The lid sheen: an additive plane whose map is the 256 × 64 band. */
  const sheenMesh = () =>
    state.created.find(
      (o) =>
        o.__kind === 'Mesh' &&
        o.material?.map?.__kind === 'CanvasTexture' &&
        o.material.map.__args[0]?.width === 256 &&
        o.material.map.__args[0]?.height === 64 &&
        propOf(o.material, 'blending') === ADDITIVE_BLENDING,
    )
  const deckGlowMesh = () => planeOf(2.8, 1)
  const contactMesh = () => planeOf(3.4, 2.5)
  const cableMesh = () => state.created.find((o) => o.__kind === 'Mesh' && o.geometry?.__kind === 'TubeGeometry')
  /** Every value written to a MeshBasicMaterial colour (the MagSafe LED's only writer). */
  const basicWrites = () => state.calls.filter((c) => c.kind === 'MeshBasicMaterial' && c.method === 'setHex')
  const lastBasicWrite = () => basicWrites().at(-1)?.args[0]
  const sweepSteps = (api, from, n, dt) => {
    for (let i = 1; i <= n; i++) api.frame(from + 50 * i, dt)
  }

  it('the MagSafe LED shows the OS state: green when on, dim amber when off (the charging look)', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    env.app.os.store.set({ state: 'on' })
    env.app.ctrl.z = 0
    api.frame(0, 0.016)
    expect(lastBasicWrite()).toBe(0x3ddc84)
    env.app.os.store.set({ state: 'off' })
    api.frame(16, 0.016)
    expect(lastBasicWrite()).toBe(0x3a2406)
    api.dispose()
  })

  it('the MagSafe LED breathes in standby: each frame writes ledMagSafe(standby, t) with its time', async () => {
    const { ledMagSafe } = await vi.importActual('./sceneMath.js')
    const env = setup()
    sized(env)
    const api = env.build()
    env.app.os.store.set({ state: 'standby' })
    env.app.ctrl.z = 0
    api.frame(1000, 0.016)
    expect(lastBasicWrite()).toBe(ledMagSafe('standby', 1000, false))
    api.frame(2000, 0.016)
    expect(lastBasicWrite()).toBe(ledMagSafe('standby', 2000, false))
    api.dispose()
  })

  it('with reduced motion the MagSafe LED stays a steady amber 0xff9f1c in standby', () => {
    const env = setup()
    sized(env)
    const api = env.build({ reduce: true })
    env.app.os.store.set({ state: 'standby' })
    env.app.ctrl.z = 0
    for (const t of [1000, 2000, 3000]) {
      api.frame(t, 0.016)
      expect(lastBasicWrite()).toBe(0xff9f1c)
    }
    api.dispose()
  })

  it('the drive LED blinks while a floppy is busy (api.drive): both its on and off colours are written, and it sits on the front face at x 1.2', async () => {
    const env = setup()
    sized(env)
    const api = env.build()
    api.drive(1)
    api.frame(0, 0.016)
    api.frame(80, 0.016)
    const writes = state.calls.filter((c) => c.kind === 'MeshStandardMaterial' && c.method === 'setHex' && (c.args[0] === 0x220800 || c.args[0] === 0xff5533))
    const values = new Set(writes.map((c) => c.args[0]))
    expect(values).toEqual(new Set([0x220800, 0xff5533]))
    const id = writes[0].id
    const led = state.created.find((o) => o.__kind === 'Mesh' && o.material?.__id === id)
    expect(led, 'the drive LED mesh').toBeDefined()
    const [x, , z] = setOf(led)
    const LP = await vi.importActual('./laptop.js')
    expect(x).toBeCloseTo(1.2, 2)
    expect(z).toBeCloseTo(LP.BASE.d / 2, 2)
    api.dispose()
  })

  it('the lid sheen sweeps when the hover becomes the lid at z 0: visible within the 0.9 s sweep, then hidden again at 1.0 s', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    const sheen = sheenMesh()
    expect(sheen, 'the sheen band plane').toBeDefined()
    env.app.ctrl.z = 0
    expect(sheen.visible).not.toBe(true)
    hoverOn(env, 'Laptop · open me')
    api.frame(0, 0.016)
    expect(sheen.visible).toBe(true)
    sweepSteps(api, 0, 9, 0.05)
    expect(sheen.visible, 'still sweeping at 0.45 s').toBe(true)
    sweepSteps(api, 450, 11, 0.05)
    expect(sheen.visible, 'hidden again after the 0.9 s sweep (at about 1.0 s)').not.toBe(true)
    api.dispose()
  })

  it('with reduced motion the sheen never shows: not on a hover at z 0, not during 2 s of frames', () => {
    const env = setup()
    sized(env)
    const api = env.build({ reduce: true })
    const sheen = sheenMesh()
    env.app.ctrl.z = 0
    hoverOn(env, 'Laptop · open me')
    for (let i = 0; i < 40; i++) {
      api.frame(50 * i, 0.05)
      expect(sheen.visible).not.toBe(true)
    }
    api.dispose()
  })

  it('the deck glow is hidden with the lid shut (le 0) and visible with the OS on and the lid open; off it stays hidden', () => {
    const env = setup()
    sized(env)
    const api = env.build()
    const glow = deckGlowMesh()
    expect(glow, 'the deck glow plane 2.8 × 1.0').toBeDefined()
    env.app.os.store.set({ state: 'on' })
    env.app.ctrl.z = 0
    api.frame(0, 0.016)
    expect(glow.visible).not.toBe(true)
    env.app.ctrl.z = 0.6
    sweepSteps(api, 0, 5, 0.016)
    expect(glow.visible).toBe(true)
    env.app.os.store.set({ state: 'off' })
    sweepSteps(api, 300, 120, 0.1)
    expect(glow.visible).not.toBe(true)
    api.dispose()
  })

  it('the contact shadow is a plane in the rig (not the base), 3.4 × 2.5 at y 0.0015 centred on the base, and it casts no shadow', () => {
    const env = setup()
    const api = env.build()
    const shadow = contactMesh()
    expect(shadow, 'the contact shadow plane 3.4 × 2.5').toBeDefined()
    // The hinge hangs off the base group, and the base sits in the rig with the desk and props.
    const base = parentOf(hotOf('Laptop · open me'))
    const rig = parentOf(base)
    expect(parentOf(shadow)).toBe(rig)
    expect(parentOf(shadow)).not.toBe(base)
    const [x, y, z] = setOf(shadow)
    expect(x).toBeCloseTo(0, 6)
    expect(y).toBeCloseTo(0.0015, 6)
    expect(z).toBeCloseTo(0.35, 6)
    expect(shadow.castShadow).toBeFalsy()
    expect(propOf(shadow.material, 'transparent')).toBe(true)
    expect(propOf(shadow.material, 'depthWrite')).toBe(false)
    expect(propOf(shadow.material, 'opacity')).toBeCloseTo(0.5, 6)
    api.dispose()
  })

  it('a TubeGeometry is built for the braided cable, along a CatmullRomCurve3 through the seven CABLE points', async () => {
    const LP = await vi.importActual('./laptop.js')
    const env = setup()
    const api = env.build()
    expect(createdOf('TubeGeometry').length).toBeGreaterThanOrEqual(1)
    const cable = cableMesh()
    expect(cable, 'a mesh on the cable tube').toBeDefined()
    const curve = cable.geometry.__args[0]
    expect(curve.__kind).toBe('CatmullRomCurve3')
    expect(curve.__args[0]).toHaveLength(LP.CABLE.points.length)
    expect(LP.CABLE.points).toHaveLength(7)
    api.dispose()
  })

  it('the hinge follows lidOpenAngle(lidT(z)) through the dive, so the lid overshoots and settles at −10°', async () => {
    const SM = await vi.importActual('./sceneMath.js')
    const env = setup()
    sized(env)
    const api = env.build()
    const hinge = hotOf('Laptop · open me')
    for (const z of [0.1, 0.3, 0.6]) {
      env.app.ctrl.z = z
      api.frame(16, 0.016)
      expect(hinge.rotation.x, `hinge at z ${z}`).toBeCloseTo(SM.lidOpenAngle(SM.lidT(z), false), 9)
    }
    env.app.ctrl.z = 0.3
    api.frame(32, 0.016)
    expect(Math.abs(SM.lidOpenAngle(SM.lidT(0.3), false) - SM.hingeAngle(SM.lidT(0.3)))).toBeGreaterThan(0.01)
    api.dispose()
  })

  it('with reduced motion the hinge is exactly hingeAngle(lidT(z)) through the dive: no overshoot', async () => {
    const SM = await vi.importActual('./sceneMath.js')
    const env = setup()
    sized(env)
    const api = env.build({ reduce: true })
    const hinge = hotOf('Laptop · open me')
    env.app.ctrl.z = 0.3
    api.frame(16, 0.016)
    expect(hinge.rotation.x).toBeCloseTo(SM.hingeAngle(SM.lidT(0.3)), 9)
    api.dispose()
  })

  // R4-3 review (D2): the power fade eases the screen light and the backlight; reduced motion is instant.
  const screenLight = () => state.created.find((o) => o.__kind === 'PointLight' && o.__args?.[0] === 0x7cc4ff)
  const keyMat = () => state.created.find((o) => o.__kind === 'Mesh' && o.geometry?.attributes?.position?.__args?.[0]?.length === 77 * 72)?.material
  const lastKeyRgb = (mat) => state.calls.filter((c) => c.kind === 'MeshStandardMaterial' && c.id === mat.__id && c.method === 'setRGB').at(-1)?.args ?? [0, 0, 0]

  it('D2: one 16 ms frame after the OS is on with the lid open, the screen light and the backlight are part-way up (strictly between 0 and their targets)', async () => {
    const SM = await vi.importActual('./sceneMath.js')
    const env = setup()
    sized(env)
    const api = env.build()
    env.app.os.store.set({ state: 'on' })
    env.app.ctrl.z = 0.6
    api.frame(16, 0.016)
    const target = SM.screenLightTarget('on', 1)
    expect(screenLight().intensity).toBeGreaterThan(0)
    expect(screenLight().intensity).toBeLessThan(target)
    const [r] = lastKeyRgb(keyMat())
    expect(r).toBeGreaterThan(0)
    expect(r).toBeLessThan(1)
    api.dispose()
  })

  it('D2: with reduced motion the screen light and the backlight are at their targets on the first frame', async () => {
    const SM = await vi.importActual('./sceneMath.js')
    const env = setup()
    sized(env)
    const api = env.build({ reduce: true })
    env.app.os.store.set({ state: 'on' })
    env.app.ctrl.z = 0.6
    api.frame(16, 0.016)
    expect(screenLight().intensity).toBeCloseTo(SM.screenLightTarget('on', 1), 12)
    expect(lastKeyRgb(keyMat())[0]).toBeCloseTo(1, 12)
    api.dispose()
  })

  // R4-3 review (D5): the first-show sweep, and a hover during a sweep does not restart it.
  it('the first-show sheen sweep starts at SHEEN.delay of shown frames at the desk, runs its 0.9 s, and never comes back on its own', async () => {
    const SM = await vi.importActual('./sceneMath.js')
    const env = setup()
    sized(env)
    const api = env.build()
    const sheen = sheenMesh()
    env.app.ctrl.z = 0
    let t = 0
    const run = (secs) => {
      for (let i = 0; i < Math.round(secs / 0.05); i++) api.frame((t += 50), 0.05)
    }
    run(SM.SHEEN.delay - 0.1)
    expect(sheen.visible, 'not before SHEEN.delay').not.toBe(true)
    run(0.2)
    expect(sheen.visible, 'sweeping just after SHEEN.delay').toBe(true)
    run(SM.SHEEN.dur)
    expect(sheen.visible, 'done after the sweep').not.toBe(true)
    run(3)
    expect(sheen.visible, 'no second sweep without a hover').not.toBe(true)
    api.dispose()
  })

  it('a lid hover during a sweep does not restart it: the band keeps moving on and the sweep ends 0.9 s after it began', async () => {
    const SM = await vi.importActual('./sceneMath.js')
    const env = setup()
    sized(env)
    const api = env.build()
    const sheen = sheenMesh()
    env.app.ctrl.z = 0
    hoverOn(env, 'Laptop · open me')
    sweepSteps(api, 0, 10, 0.05) // 0.5 s into the sweep
    const mid = sheen.material.map.offset.x
    expect(mid).toBeCloseTo(SM.sheenOffset(0.5), 9)
    // Off the laptop, then back onto the lid: a new hover on the lid mid-sweep.
    state.hits = []
    pointer(canvasOf(env), 'pointermove')
    hoverOn(env, 'Laptop · open me')
    api.frame(550, 0.05)
    expect(sheen.material.map.offset.x, 'not reset to the start').toBeGreaterThan(mid)
    sweepSteps(api, 550, 8, 0.05) // 0.95 s since the sweep began
    expect(sheen.visible, 'the sweep ended on its first schedule').not.toBe(true)
    api.dispose()
  })

  it('the laptop mesh budget holds with the cable and the contact shadow counted: the visible meshes at rest are at most LAPTOP.drawBudget', async () => {
    const LP = await vi.importActual('./laptop.js')
    const env = setup()
    const api = env.build()
    const base = parentOf(hotOf('Laptop · open me'))
    const visible = (o) => o.__kind === 'Mesh' && optsOf(o.material).visible !== false && o.visible !== false
    const inBase = subtree(base).filter(visible)
    const extra = [cableMesh(), contactMesh()].filter((m) => m && visible(m))
    const count = new Set([...inBase, ...extra]).size
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(LP.LAPTOP.drawBudget)
    api.dispose()
  })
})
