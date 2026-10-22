import { describe, it, expect, vi, afterEach } from 'vitest'
import { createWallpaperStore } from './wallpaperStore.js'
import { autoWp } from './modes.js'

describe('createWallpaperStore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('the default choice is auto', () => {
    const wp = createWallpaperStore()

    expect(wp.store.get().choice).toBe('auto')
  })

  it('setChoice("golden") returns true and current() is golden', () => {
    const wp = createWallpaperStore()

    expect(wp.setChoice('golden')).toBe(true)
    expect(wp.current()).toBe('golden')
  })

  it('setChoice("constructor") returns false and leaves the choice unchanged', () => {
    const wp = createWallpaperStore()

    expect(wp.setChoice('constructor')).toBe(false)
    expect(wp.store.get().choice).toBe('auto')
  })

  it('never touches localStorage: no reads or writes, and a new store starts at auto', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const getItem = vi.spyOn(Storage.prototype, 'getItem')

    const wp = createWallpaperStore()
    wp.setChoice('golden')

    expect(setItem).not.toHaveBeenCalled()
    expect(getItem).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
    expect(createWallpaperStore().store.get().choice).toBe('auto')
  })

  it('in auto, current(date) equals autoWp(date)', () => {
    const wp = createWallpaperStore()
    const date = new Date('2026-07-16T03:00Z') // 23:00 EDT

    expect(wp.current(date)).toBe(autoWp(date))
    expect(wp.current(date)).toBe('night')
  })
})
