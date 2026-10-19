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
  const state = { calls: [], created: [], failOn: null, seq: 0 }

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
    Raycaster: ctor('Raycaster'),
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

import { createScene } from './createScene.js'

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
