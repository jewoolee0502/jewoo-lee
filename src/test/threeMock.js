// Shared three.js proxy fake (round 4, R4-2). Every object the scene constructs is a recording
// proxy: a method call is recorded as {kind, id, method, args} in state.calls, and every
// construction is pushed to state.created with its constructor args in __args. Used by
// createScene.test.jsx (through vi.hoisted) and laptopBuild.test.js (through a plain import), so
// both see one behaviour. Each createThreeFake() call is a fresh world (its own state).
//
// Geometry: parametric kinds carry position/normal/uv attributes; ExtrudeGeometry and
// RoundedBoxGeometry are non-indexed (index null), the others indexed. BufferGeometry has real
// setAttribute / setIndex / toNonIndexed methods that update `attributes` and `index`.

// three r128 constants the scene uses (values as in three's constants).
export const BACK_SIDE = 1
export const ADDITIVE_BLENDING = 2
export const CLAMP_TO_EDGE_WRAPPING = 1001

const NON_INDEXED = new Set(['ExtrudeGeometry', 'RoundedBoxGeometry'])

export function createThreeFake() {
  const state = { calls: [], created: [], failOn: null, seq: 0, hits: [] }

  const SKIP = (p) => typeof p === 'symbol' || p === 'then' || p === 'toJSON' || p === 'nodeType'

  const record = (obj, method, args) => state.calls.push({ kind: obj.__kind, id: obj.__id, method, args })

  // An unknown member (e.g. `mesh.position`, `renderer.shadowMap`) is itself callable and
  // property-accessible, so nested access like `mesh.position.set(…)` works. Calling any member
  // records `method` = its last name.
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

  // BufferGeometry methods that keep `attributes` and `index` true to three, and record the call.
  const geometryOwn = () => ({
    attributes: {},
    index: null,
    setAttribute(name, attr) {
      this.attributes[name] = attr
      record(this, 'setAttribute', [name, attr])
      return this
    },
    setIndex(idx) {
      this.index = idx
      record(this, 'setIndex', [idx])
      return this
    },
    toNonIndexed() {
      this.index = null
      record(this, 'toNonIndexed', [])
      return this
    },
  })

  // A parametric geometry: three gives it position, normal and uv; only some kinds are indexed.
  const parametric = (kind) =>
    ctor(kind, () => ({
      attributes: { position: {}, normal: {}, uv: {} },
      index: NON_INDEXED.has(kind) ? null : {},
    }))

  // A render target from PMREMGenerator.fromScene: its texture is a plain object (stable identity).
  function renderTarget(gen, args) {
    const rt = makeProxy('WebGLRenderTarget', { texture: {} })
    rt.__args = args
    state.created.push(rt)
    record(gen, 'fromScene', args)
    return rt
  }

  const three = {
    WebGLRenderer: ctor('WebGLRenderer', () => ({ domElement: document.createElement('canvas') })),
    Scene: ctor('Scene'),
    Color: ctor('Color'),
    Fog: ctor('Fog'),
    PerspectiveCamera: ctor('PerspectiveCamera'),
    Group: ctor('Group'),
    Object3D: ctor('Object3D'),
    // A real Object3D starts at scale 1; the mock's scale is a plain {x,y,z} so an unset axis reads 1.
    Mesh: ctor('Mesh', () => ({ scale: { x: 1, y: 1, z: 1 } })),
    Points: ctor('Points'),
    MeshStandardMaterial: ctor('MeshStandardMaterial'),
    MeshBasicMaterial: ctor('MeshBasicMaterial'),
    PointsMaterial: ctor('PointsMaterial'),
    BoxGeometry: parametric('BoxGeometry'),
    PlaneGeometry: parametric('PlaneGeometry'),
    CylinderGeometry: parametric('CylinderGeometry'),
    SphereGeometry: parametric('SphereGeometry'),
    TorusGeometry: parametric('TorusGeometry'),
    ConeGeometry: parametric('ConeGeometry'),
    ExtrudeGeometry: parametric('ExtrudeGeometry'),
    ShapeGeometry: parametric('ShapeGeometry'),
    CircleGeometry: parametric('CircleGeometry'),
    TubeGeometry: parametric('TubeGeometry'),
    BufferGeometry: ctor('BufferGeometry', geometryOwn),
    BufferAttribute: ctor('BufferAttribute'),
    Shape: ctor('Shape'),
    Path: ctor('Path'),
    CatmullRomCurve3: ctor('CatmullRomCurve3'),
    CanvasTexture: ctor('CanvasTexture'),
    PMREMGenerator: ctor('PMREMGenerator', () => ({
      fromScene(...args) {
        return renderTarget(this, args)
      },
    })),
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
    BackSide: BACK_SIDE,
    AdditiveBlending: ADDITIVE_BLENDING,
    ClampToEdgeWrapping: CLAMP_TO_EDGE_WRAPPING,
  }

  // jsm modules: RoundedBoxGeometry is a class; BufferGeometryUtils is an object of functions
  // (r128 exports it that way, so the scene imports `{ BufferGeometryUtils }`).
  const jsm = {
    RoundedBoxGeometry: parametric('RoundedBoxGeometry'),
    BufferGeometryUtils: {
      mergeBufferGeometries(list) {
        state.calls.push({ kind: 'BufferGeometryUtils', id: 0, method: 'mergeBufferGeometries', args: [list] })
        const merged = makeProxy('BufferGeometry', geometryOwn())
        merged.__args = [list]
        state.created.push(merged)
        return merged
      },
    },
  }

  const css3d = {
    CSS3DRenderer: ctor('CSS3DRenderer', () => ({ domElement: document.createElement('div') })),
    CSS3DObject: ctor('CSS3DObject'),
  }

  return { state, three, css3d, jsm }
}
