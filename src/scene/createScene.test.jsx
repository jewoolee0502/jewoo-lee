// Phase 7 TEST LIST: scene/createScene.test.js (lifecycle). `three` and its CSS3D addon are
// mocked. Every constructed object is a recording proxy, so the test can check which resources
// were created and which were disposed, and whether the DOM was cleaned up.
// jsdom has no WebGL: nothing here renders. Assumed signature (see the report):
// createScene({ mount, stage, holder, park, tipEl, app, reduce }).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode, useRef } from 'react'
import { render, waitFor } from '@testing-library/react'
import { createApp } from '../app/createApp.js'
import { AppProvider } from '../app/AppContext.jsx'
import SceneMount from '../stage/SceneMount.jsx'

const T = vi.hoisted(() => {
  // `hits`: what the raycaster reports for a pointer pick (round 2 phase 4 tests set it per case).
  const state = { calls: [], created: [], failOn: null, seq: 0, hits: [] }

  const SKIP = (p) => typeof p === 'symbol' || p === 'then' || p === 'toJSON' || p === 'nodeType'

  // An unknown member (e.g. `mesh.position`, `renderer.shadowMap`) is itself callable and
  // property-accessible, so nested access like `mesh.position.set(…)` or
  // `moon.shadow.mapSize.set(…)` works. Calling any member records `method` = its last name.
  function member(kind, id, root, name) {
    const own = {}
    const fn = function () {}
    return new Proxy(fn, {
      get(_t, p) {
        if (p in own) return own[p]
        if (SKIP(p)) return undefined
        if (typeof p === 'string' && /^is[A-Z]/.test(p)) return false
        own[p] = member(kind, id, root, p)
        return own[p]
      },
      set(_t, p, v) {
        own[p] = v
        return true
      },
      apply(_t, _this, args) {
        state.calls.push({ kind, id, method: name, args })
        return root
      },
    })
  }

  function makeProxy(kind, own = {}) {
    const id = ++state.seq
    const target = { ...own, __kind: kind, __id: id, children: [] }
    const proxy = new Proxy(target, {
      get(t, p) {
        if (p in t) return t[p]
        if (SKIP(p)) return undefined
        if (typeof p === 'string' && /^is[A-Z]/.test(p)) return false
        t[p] = member(kind, id, proxy, p)
        return t[p]
      },
      set(t, p, v) {
        t[p] = v
        return true
      },
    })
    target.add = (c) => {
      target.children.push(c)
      return proxy
    }
    target.remove = (c) => {
      target.children = target.children.filter((x) => x !== c)
      state.calls.push({ kind, id, method: 'remove', args: [c] })
      return proxy
    }
    target.traverse = (fn) => {
      fn(proxy)
      for (const c of target.children) c.traverse(fn)
    }
    return proxy
  }

  function ctor(kind, own) {
    return class {
      constructor(...args) {
        if (state.failOn === kind) throw new Error(`boom: ${kind}`)
        const extra = own ? own(args) : {}
        const proxy = makeProxy(kind, extra)
        proxy.__args = args
        if (kind === 'Mesh' || kind === 'Points') {
          proxy.geometry = args[0]
          proxy.material = args[1]
          proxy[kind === 'Mesh' ? 'isMesh' : 'isPoints'] = true
        }
        state.created.push(proxy)
        return proxy
      }
    }
  }

  const three = {
    WebGLRenderer: ctor('WebGLRenderer', () => ({ domElement: document.createElement('canvas') })),
    Scene: ctor('Scene'),
    Color: ctor('Color'),
    Fog: ctor('Fog'),
    PerspectiveCamera: ctor('PerspectiveCamera'),
    Group: ctor('Group'),
    Object3D: ctor('Object3D'),
    Mesh: ctor('Mesh'),
    Points: ctor('Points'),
    MeshStandardMaterial: ctor('MeshStandardMaterial'),
    MeshBasicMaterial: ctor('MeshBasicMaterial'),
    PointsMaterial: ctor('PointsMaterial'),
    BoxGeometry: ctor('BoxGeometry'),
    PlaneGeometry: ctor('PlaneGeometry'),
    CylinderGeometry: ctor('CylinderGeometry'),
    SphereGeometry: ctor('SphereGeometry'),
    TorusGeometry: ctor('TorusGeometry'),
    ConeGeometry: ctor('ConeGeometry'),
    BufferGeometry: ctor('BufferGeometry'),
    BufferAttribute: ctor('BufferAttribute'),
    CanvasTexture: ctor('CanvasTexture'),
    HemisphereLight: ctor('HemisphereLight'),
    DirectionalLight: ctor('DirectionalLight'),
    PointLight: ctor('PointLight'),
    Vector2: ctor('Vector2'),
    Vector3: ctor('Vector3'),
    Quaternion: ctor('Quaternion'),
    Euler: ctor('Euler'),
    Raycaster: ctor('Raycaster', () => ({ intersectObjects: () => state.hits })),
    TextureLoader: ctor('TextureLoader'),
    sRGBEncoding: 3001,
    PCFShadowMap: 2,
    NearestFilter: 1003,
    DoubleSide: 2,
  }
  const css3d = {
    CSS3DRenderer: ctor('CSS3DRenderer', () => ({ domElement: document.createElement('div') })),
    CSS3DObject: ctor('CSS3DObject'),
  }
  return { state, three, css3d }
})

vi.mock('three', () => T.three)
vi.mock('three/examples/jsm/renderers/CSS3DRenderer.js', () => T.css3d)

import { createScene, CANVAS_FONTS, GLOW_K } from './createScene.js'
import { MUG, HIT } from './props.js'
import { glowColor } from './sceneMath.js'

const { state } = T
const RESOURCE_KINDS = new Set([
  'BoxGeometry',
  'PlaneGeometry',
  'CylinderGeometry',
  'SphereGeometry',
  'TorusGeometry',
  'ConeGeometry',
  'BufferGeometry',
  'MeshStandardMaterial',
  'MeshBasicMaterial',
  'PointsMaterial',
  'CanvasTexture',
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
  it('dispose() resets the widened OS size: holder width and height are "" (or 900px / 675px) after a late widen', () => {
    const env = setup()
    Object.defineProperty(env.stage, 'clientWidth', { configurable: true, value: 1440 })
    Object.defineProperty(env.stage, 'clientHeight', { configurable: true, value: 900 })
    const api = env.build()

    env.app.ctrl.z = 0.99
    api.frame(0, 0.016)
    expect(env.holder.style.width, 'widened width before dispose').not.toBe('900px')

    api.dispose()

    expect(['', '900px']).toContain(env.holder.style.width)
    expect(['', '675px']).toContain(env.holder.style.height)
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
})
