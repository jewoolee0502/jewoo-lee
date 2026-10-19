// Phase 7 TEST LIST: stage/SceneMount.wiring.test.jsx. `wireScene(api, app)` is the thin helper
// that createScene uses to subscribe the scene to the stores (exported from scene/createScene.js).
// SceneMount is rendered through renderWithApp with a fake loadScene, so no WebGL is needed.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { StrictMode, createRef } from 'react'
import { render, waitFor } from '@testing-library/react'
import { renderWithApp } from '../test/renderWithApp.jsx'
import { createApp } from '../app/createApp.js'
import { AppProvider } from '../app/AppContext.jsx'
import { createStore } from '../core/store.js'
import { EXAMPLES } from '../wall/examples.js'
import { MODE_KEYS } from '../wallpaper/modes.js'
import { wireScene } from '../scene/createScene.js'
import SceneMount from './SceneMount.jsx'

function fakeWall(approved = []) {
  return {
    store: createStore({ approved }),
    ensureInit: vi.fn(async () => {}),
    dispose: vi.fn(),
  }
}

const drawing = (n) => ({ id: `d${n}`, dataUrl: `data:image/png;base64,DRAW${n}`, decidedAt: n })

function fakeApi() {
  return { setWall: vi.fn(), onOS: vi.fn(), dispose: vi.fn() }
}

describe('stage/SceneMount wiring (wireScene)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('wireScene calls setWall once at creation with the examples while nothing is approved, and calls wall.ensureInit', () => {
    const wall = fakeWall([])
    const app = createApp({ wall })
    const api = fakeApi()
    const off = wireScene(api, app)
    expect(api.setWall).toHaveBeenCalledTimes(1)
    const pngs = api.setWall.mock.calls[0][0]
    expect(pngs).toHaveLength(3)
    expect(pngs).toEqual([...EXAMPLES])
    expect(api.setWall.mock.calls[0][1]).toBe(0)
    expect(wall.ensureInit).toHaveBeenCalled()
    off()
    app.dispose()
  })

  it('approved drawings change: setWall gets at most 6 data URLs, newest first', () => {
    const wall = fakeWall([])
    const app = createApp({ wall })
    const api = fakeApi()
    const off = wireScene(api, app)
    api.setWall.mockClear()

    const eight = Array.from({ length: 8 }, (_, i) => drawing(i))
    wall.store.set({ approved: eight })

    expect(api.setWall).toHaveBeenCalledTimes(1)
    const pngs = api.setWall.mock.calls[0][0]
    expect(pngs).toHaveLength(6)
    expect(pngs).toEqual(eight.slice(0, 6).map((d) => d.dataUrl))
    expect(api.setWall.mock.calls[0][1]).toBe(8)
    off()
    app.dispose()
  })

  it('approving one drawing passes approvedCount 1 (not the 3 examples it replaces)', () => {
    const wall = fakeWall([])
    const app = createApp({ wall })
    const api = fakeApi()
    const off = wireScene(api, app)
    api.setWall.mockClear()

    wall.store.set({ approved: [drawing(1)] })

    expect(api.setWall).toHaveBeenCalledTimes(1)
    expect(api.setWall.mock.calls[0][0]).toEqual([drawing(1).dataUrl])
    expect(api.setWall.mock.calls[0][1]).toBe(1)
    off()
    app.dispose()
  })

  it('os.boot() calls api.onOS("boot") through the os store subscription', () => {
    const app = createApp({ wall: fakeWall([]) })
    const api = fakeApi()
    const off = wireScene(api, app)
    app.os.boot()
    expect(api.onOS).toHaveBeenCalledWith('boot')
    off()
    app.dispose()
  })

  it('a wallpaper choice change calls api.onOS with the current OS state', () => {
    const app = createApp({ wall: fakeWall([]) })
    const api = fakeApi()
    const off = wireScene(api, app)
    expect(app.os.store.get().state).toBe('standby')

    expect(app.wallpaper.setChoice(MODE_KEYS[0])).toBe(true)

    expect(api.onOS).toHaveBeenCalledWith('standby')
    off()
    app.dispose()
  })

  it('the returned unsubscribe stops further calls', () => {
    const wall = fakeWall([])
    const app = createApp({ wall })
    const api = fakeApi()
    const off = wireScene(api, app)
    off()
    api.setWall.mockClear()
    api.onOS.mockClear()

    wall.store.set({ approved: [drawing(1)] })
    app.os.boot()
    app.wallpaper.setChoice(MODE_KEYS[0])

    expect(api.setWall).not.toHaveBeenCalled()
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
    const api = { dispose: vi.fn(), onOS: vi.fn(), setWall: vi.fn() }
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
