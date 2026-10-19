import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ACH, createAchievements } from './achievements.js'

function makeDeps() {
  return { toast: vi.fn(), snd: { ach: vi.fn() } }
}

describe('ACH', () => {
  it('has 12 achievements in the prototype order (Artist in Residence removed with Paint)', () => {
    expect(ACH).toHaveLength(12)
    expect(ACH.map((a) => a.id)).toEqual([
      'boot',
      'floppy',
      'term',
      'neofetch',
      'hire',
      'bugs',
      'snake',
      'tags',
      'lamp',
      'konami',
      'shutdown',
      'local',
    ])
  })
})

describe('createAchievements', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('unlock adds the id, persists it, toasts and plays the sound once', () => {
    const deps = makeDeps()
    const ach = createAchievements(deps)

    ach.unlock('boot')

    expect(ach.store.get().got.has('boot')).toBe(true)
    expect(localStorage.getItem('jayos-ach')).toBe('["boot"]')
    expect(deps.toast).toHaveBeenCalledTimes(1)
    expect(deps.toast).toHaveBeenCalledWith('★ Achievement unlocked', 'Power User')
    expect(deps.snd.ach).toHaveBeenCalledTimes(1)
  })

  it('a second unlock of the same id adds no toast and plays no sound', () => {
    const deps = makeDeps()
    const ach = createAchievements(deps)
    ach.unlock('boot')

    ach.unlock('boot')

    expect(deps.toast).toHaveBeenCalledTimes(1)
    expect(deps.snd.ach).toHaveBeenCalledTimes(1)
  })

  it('unlock of an unknown id is a no-op and does not throw', () => {
    const deps = makeDeps()
    const ach = createAchievements(deps)

    expect(() => ach.unlock('nope')).not.toThrow()

    expect(ach.store.get().got.size).toBe(0)
    expect(deps.toast).not.toHaveBeenCalled()
    expect(deps.snd.ach).not.toHaveBeenCalled()
  })

  it('stored ["boot","bogus"] loads as only {boot}', () => {
    localStorage.setItem('jayos-ach', '["boot","bogus"]')

    const ach = createAchievements(makeDeps())

    expect(ach.store.get().got).toEqual(new Set(['boot']))
  })

  it('stored invalid JSON loads as an empty set', () => {
    localStorage.setItem('jayos-ach', '{not json')

    const ach = createAchievements(makeDeps())

    expect(ach.store.get().got).toEqual(new Set())
  })

  it('a stored "paint" id from an older build is dropped and the count stays correct', () => {
    localStorage.setItem('jayos-ach', '["boot","paint","lamp"]')

    const ach = createAchievements(makeDeps())

    expect(ach.store.get().got).toEqual(new Set(['boot', 'lamp']))
    expect(ach.store.get().got.has('paint')).toBe(false)
    expect(ACH.filter((a) => ach.store.get().got.has(a.id))).toHaveLength(2)
  })
})
