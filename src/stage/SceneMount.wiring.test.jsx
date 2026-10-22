// Phase 7 TEST LIST: stage/SceneMount.wiring.test.jsx. `wireScene(api, app)` is the thin helper
// that createScene uses to subscribe the scene to the stores (exported from scene/createScene.js).
// SceneMount is rendered through renderWithApp with a fake loadScene, so no WebGL is needed.
// Round 3 Phase R3-3 (plan-r3 V17, I17): the scene loads on the first unpark, never while the laptop
// is parked (a deep link to the résumé), and a later park does not dispose it. Review: the main.jsx
// order (views.init() on a #resume URL, then mount) defers the scene, and "Open the laptop" while the
// scene is still loading lands at the desk and glides open once it is ready.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { StrictMode, createRef } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { renderWithApp } from '../test/renderWithApp.jsx'
import { setReducedMotion } from '../test/setup.js'
import { createApp } from '../app/createApp.js'
import { AppProvider } from '../app/AppContext.jsx'
import { MODE_KEYS } from '../wallpaper/modes.js'
import { wireScene } from '../scene/createScene.js'
import SceneMount from './SceneMount.jsx'

function fakeApi() {
  return { onOS: vi.fn(), dispose: vi.fn() }
}

describe('stage/SceneMount wiring (wireScene)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('wireScene needs no wall store: createApp() has no app.wall and wiring does not throw', () => {
    const app = createApp()
    const api = fakeApi()
    expect(app.wall).toBeUndefined()
    let off
    expect(() => {
      off = wireScene(api, app)
    }).not.toThrow()
    expect(api).not.toHaveProperty('setWall')
    off()
    app.dispose()
  })

  it('os.boot() calls api.onOS("boot") through the os store subscription', () => {
    const app = createApp()
    const api = fakeApi()
    const off = wireScene(api, app)
    app.os.boot()
    expect(api.onOS).toHaveBeenCalledWith('boot')
    off()
    app.dispose()
  })

  it('a wallpaper choice change calls api.onOS with the current OS state', () => {
    const app = createApp()
    const api = fakeApi()
    const off = wireScene(api, app)
    expect(app.os.store.get().state).toBe('standby')

    expect(app.wallpaper.setChoice(MODE_KEYS[0])).toBe(true)

    expect(api.onOS).toHaveBeenCalledWith('standby')
    off()
    app.dispose()
  })

  it('the returned unsubscribe stops further calls', () => {
    const app = createApp()
    const api = fakeApi()
    const off = wireScene(api, app)
    off()
    api.onOS.mockClear()

    app.os.boot()
    app.wallpaper.setChoice(MODE_KEYS[0])

    expect(api.onOS).not.toHaveBeenCalled()
    app.dispose()
  })
})

describe('stage/SceneMount loading', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mountOnly(overrides) {
    const refs = { sceneLayerRef: createRef(), stageRef: createRef(), tipRef: createRef() }
    return renderWithApp(<SceneMount {...refs} />, overrides)
  }

  it('a loader that resolves a module with createScene gives status ready and stores the api', async () => {
    const api = { dispose: vi.fn(), onOS: vi.fn() }
    const createScene = vi.fn(() => api)
    const { app } = mountOnly({ loadScene: vi.fn(async () => ({ createScene })) })
    await waitFor(() => expect(app.scene.store.get().status).toBe('ready'))
    expect(createScene).toHaveBeenCalledTimes(1)
    expect(app.scene.api).toBe(api)
  })

  it('a loader that resolves null (no WebGL) gives status unavailable', async () => {
    const { app } = mountOnly({ loadScene: vi.fn(async () => null) })
    await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
    expect(app.scene.api).toBeNull()
  })

  it('the default loader in jsdom (no WebGL) gives status unavailable', async () => {
    const { app } = mountOnly()
    await waitFor(() => expect(app.scene.store.get().status).toBe('unavailable'))
  })

  it('StrictMode: exactly one scene is created and alive while mounted; unmount disposes it', async () => {
    const counter = { created: 0, disposed: 0 }
    const refs = { sceneLayerRef: createRef(), stageRef: createRef(), tipRef: createRef() }
    const app = createApp({
      loadScene: vi.fn(async () => ({
        createScene: () => {
          counter.created += 1
          return { dispose: () => (counter.disposed += 1) }
        },
      })),
    })
    const { unmount } = render(
      <StrictMode>
        <AppProvider app={app}>
          <SceneMount {...refs} />
        </AppProvider>
      </StrictMode>,
    )
    await waitFor(() => expect(app.scene.store.get().status).toBe('ready'))
    expect(counter.created - counter.disposed).toBe(1)
    unmount()
    expect(counter.created - counter.disposed).toBe(0)
    app.dispose()
  })
})

// Round 4 R4-1 (plan-r4 §5 step 1): with `?stats` in the URL the live api is globalThis.__jayScene,
// for the headless draw-count probe; without it nothing is exposed.
describe('stage/SceneMount ?stats hook (R4-1)', () => {
  const refs = () => ({ sceneLayerRef: createRef(), stageRef: createRef(), tipRef: createRef() })
  const at = (url) => window.history.replaceState(null, '', url)
  afterEach(() => {
    at('/')
    delete globalThis.__jayScene
    vi.restoreAllMocks()
  })

  it('with ?stats the scene api is globalThis.__jayScene, and unmount removes it', async () => {
    at('/?stats')
    const api = { dispose: vi.fn(), onOS: vi.fn() }
    const { app, unmount } = renderWithApp(<SceneMount {...refs()} />, { loadScene: vi.fn(async () => ({ createScene: () => api })) })
    await waitFor(() => expect(app.scene.store.get().status).toBe('ready'))
    expect(globalThis.__jayScene).toBe(api)
    unmount()
    expect('__jayScene' in globalThis).toBe(false)
  })

  it('without ?stats nothing is exposed', async () => {
    at('/?other=1')
    const { app, unmount } = renderWithApp(<SceneMount {...refs()} />, {
      loadScene: vi.fn(async () => ({ createScene: () => ({ dispose: vi.fn(), onOS: vi.fn() }) })),
    })
    await waitFor(() => expect(app.scene.store.get().status).toBe('ready'))
    expect('__jayScene' in globalThis).toBe(false)
    unmount()
  })

  it('unmount leaves __jayScene alone when it is no longer this api', async () => {
    at('/?stats')
    const api = { dispose: vi.fn(), onOS: vi.fn() }
    const { app, unmount } = renderWithApp(<SceneMount {...refs()} />, { loadScene: vi.fn(async () => ({ createScene: () => api })) })
    await waitFor(() => expect(app.scene.store.get().status).toBe('ready'))
    const other = { info: () => null }
    globalThis.__jayScene = other
    unmount()
    expect(globalThis.__jayScene).toBe(other)
    expect(api.dispose).toHaveBeenCalledTimes(1)
  })
})

// Round 3 Phase R3-3 TEST LIST (plan-r3 V17, I17): the scene is deferred until the laptop is first shown.
describe('stage/SceneMount deferral (V17)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // One macrotask: past the microtasks SceneMount's loader chain needs.
  const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  const refs = () => ({ sceneLayerRef: createRef(), stageRef: createRef(), tipRef: createRef() })

  it('with the laptop parked before mount (a deep link to the résumé), loadScene is not called', async () => {
    const loadScene = vi.fn(async () => ({ createScene: () => ({ dispose: vi.fn() }) }))
    const app = createApp({ loadScene })
    app.ctrl.park('desk')
    render(
      <AppProvider app={app}>
        <SceneMount {...refs()} />
      </AppProvider>,
    )
    await flush()
    expect(loadScene).not.toHaveBeenCalled()
    expect(app.scene.store.get().status).toBe('loading')
    app.dispose()
  })

  it('after the first unpark, loadScene is called once and the scene becomes ready', async () => {
    const createScene = vi.fn(() => ({ dispose: vi.fn() }))
    const loadScene = vi.fn(async () => ({ createScene }))
    const app = createApp({ loadScene })
    app.ctrl.park('desk')
    render(
      <AppProvider app={app}>
        <SceneMount {...refs()} />
      </AppProvider>,
    )
    await flush()
    expect(loadScene).not.toHaveBeenCalled()

    act(() => app.ctrl.unpark())
    await waitFor(() => expect(app.scene.store.get().status).toBe('ready'))
    await flush()
    expect(loadScene).toHaveBeenCalledTimes(1)
    expect(createScene).toHaveBeenCalledTimes(1)
    app.dispose()
  })

  it('a later park after the scene is ready does not dispose it', async () => {
    const dispose = vi.fn()
    const app = createApp({ loadScene: vi.fn(async () => ({ createScene: () => ({ dispose }) })) })
    app.ctrl.park('desk')
    render(
      <AppProvider app={app}>
        <SceneMount {...refs()} />
      </AppProvider>,
    )
    await flush()
    act(() => app.ctrl.unpark())
    await waitFor(() => expect(app.scene.store.get().status).toBe('ready'))

    act(() => app.ctrl.park('desk'))
    await flush()
    expect(dispose).not.toHaveBeenCalled()
    expect(app.scene.api).not.toBeNull()
    app.dispose()
  })

  it('StrictMode: after the first unpark exactly one scene is alive; unmount disposes it', async () => {
    const counter = { created: 0, disposed: 0 }
    const app = createApp({
      loadScene: vi.fn(async () => ({
        createScene: () => {
          counter.created += 1
          return { dispose: () => (counter.disposed += 1) }
        },
      })),
    })
    app.ctrl.park('desk')
    const { unmount } = render(
      <StrictMode>
        <AppProvider app={app}>
          <SceneMount {...refs()} />
        </AppProvider>
      </StrictMode>,
    )
    await flush()
    expect(counter.created).toBe(0)

    act(() => app.ctrl.unpark())
    await waitFor(() => expect(app.scene.store.get().status).toBe('ready'))
    await flush()
    expect(counter.created - counter.disposed).toBe(1)
    unmount()
    expect(counter.created - counter.disposed).toBe(0)
    app.dispose()
  })

  // As main.jsx does it: createApp(), then views.init() reads the #resume URL and parks the laptop,
  // then the tree mounts.
  function deepLinkApp(loadScene) {
    setReducedMotion(true)
    history.replaceState(null, '', '/#resume')
    const app = createApp({ loadScene })
    app.views.init()
    render(
      <AppProvider app={app}>
        <SceneMount {...refs()} />
      </AppProvider>,
    )
    return app
  }

  it('a #resume URL through views.init() (the main.jsx order) defers the scene; backToLaptop loads it once', async () => {
    const loadScene = vi.fn(async () => ({ createScene: () => ({ dispose: vi.fn() }) }))
    const app = deepLinkApp(loadScene)
    expect(document.documentElement.getAttribute('data-view')).toBe('resume')
    expect(app.ctrl.store.get().parked).toBe(true)
    await flush()
    expect(loadScene).not.toHaveBeenCalled()

    act(() => app.nav.backToLaptop())
    expect(document.documentElement.getAttribute('data-view')).toBe('laptop')
    await waitFor(() => expect(app.scene.store.get().status).toBe('ready'))
    await flush()
    expect(loadScene).toHaveBeenCalledTimes(1)
    app.dispose()
  })

  it('openLaptop from a deep-linked résumé while the scene loads: lands at the desk, then glides open once it is ready', async () => {
    let resolve
    const loadScene = vi.fn(() => new Promise((r) => (resolve = r)))
    const app = deepLinkApp(loadScene)
    // A measured laptop: stage 1000, track 2120, so the open end is R 1120 (jsdom has no layout).
    app.dom.track = { getBoundingClientRect: () => ({ top: -window.scrollY, height: 2120 }) }
    app.dom.stage = { clientHeight: 1000, classList: { toggle: vi.fn() }, style: { setProperty: vi.fn(), removeProperty: vi.fn() } }
    const jump = vi.spyOn(app.glide, 'jump').mockImplementation(() => {})
    const to = vi.spyOn(app.glide, 'to').mockImplementation(() => {})
    await flush()

    act(() => app.nav.openLaptop())
    expect(document.documentElement.getAttribute('data-view')).toBe('laptop')
    expect(jump).toHaveBeenLastCalledWith(0)
    expect(jump).not.toHaveBeenCalledWith(1120)
    await flush()
    expect(loadScene).toHaveBeenCalledTimes(1)
    expect(app.scene.store.get().status).toBe('loading')
    app.ctrl.update()
    expect(to).not.toHaveBeenCalled()

    await act(async () => resolve({ createScene: () => ({ dispose: vi.fn() }) }))
    await waitFor(() => expect(app.scene.store.get().status).toBe('ready'))
    app.ctrl.update()
    expect(to).toHaveBeenCalledTimes(1)
    expect(to).toHaveBeenLastCalledWith(1120)
    app.dom.track = null
    app.dom.stage = null
    app.dispose()
  })
})
