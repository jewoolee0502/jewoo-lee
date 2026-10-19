// Phase 7 TEST LIST: stage/SceneMount.wiring.test.jsx. `wireScene(api, app)` is the thin helper
// that createScene uses to subscribe the scene to the stores (exported from scene/createScene.js).
// SceneMount is rendered through renderWithApp with a fake loadScene, so no WebGL is needed.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { StrictMode, createRef } from 'react'
import { render, waitFor } from '@testing-library/react'
import { renderWithApp } from '../test/renderWithApp.jsx'
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
