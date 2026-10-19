// Phase 7 TEST LIST: scene/loadScene.test.js. canGL and the importer are injectable.
import { describe, it, expect, vi } from 'vitest'
import { loadScene } from './loadScene.js'

describe('scene/loadScene', () => {
  it('canGL → false gives null and the importer is never called', async () => {
    const importer = vi.fn(async () => ({ createScene: vi.fn() }))
    await expect(loadScene({ canGL: () => false, importer })).resolves.toBeNull()
    expect(importer).not.toHaveBeenCalled()
  })

  it('an importer that throws gives null', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const importer = vi.fn(async () => {
      throw new Error('chunk failed to load')
    })
    await expect(loadScene({ canGL: () => true, importer })).resolves.toBeNull()
  })

  it('success resolves to the imported module, which carries createScene', async () => {
    const mod = { createScene: vi.fn() }
    const importer = vi.fn(async () => mod)
    const result = await loadScene({ canGL: () => true, importer })
    expect(result).toBe(mod)
    expect(importer).toHaveBeenCalledTimes(1)
  })

  it('with the default probe, jsdom has no WebGL, so loadScene resolves to null', async () => {
    const importer = vi.fn(async () => ({ createScene: vi.fn() }))
    await expect(loadScene({ importer })).resolves.toBeNull()
    expect(importer).not.toHaveBeenCalled()
  })
})
