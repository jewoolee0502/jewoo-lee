// Phase 5 TEST LIST: wallpaper/secrets.test.js. Texts from L575–588 (curly quotes are content).
import { describe, it, expect, vi } from 'vitest'
import { createSecretTracker, act } from './secrets.js'

function setup() {
  const toast = vi.fn()
  const unlock = vi.fn()
  const tracker = createSecretTracker({ toast, unlock })
  return { toast, unlock, tracker }
}

describe('createSecretTracker.found', () => {
  it('toasts the first find once: found("moon") twice gives one toast with the exact text', () => {
    const { toast, tracker } = setup()
    tracker.found('moon')
    tracker.found('moon')
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(
      'Secret 1 · That’s a bagel now',
      'Sesame, Montréal-style. St-Viateur or Fairmount? Choose wisely.',
      'info',
    )
  })

  it('numbers each new distinct secret in the toast title', () => {
    const { toast, tracker } = setup()
    tracker.found('moon')
    tracker.found('sun')
    expect(toast).toHaveBeenLastCalledWith(
      'Secret 2 · Deal with it',
      'Even the sun needs shades on a snow day.',
      'info',
    )
  })

  it('unlocks local once when three distinct secrets are found', () => {
    const { unlock, tracker } = setup()
    tracker.found('moon')
    tracker.found('sun')
    expect(unlock).not.toHaveBeenCalled()
    tracker.found('cross')
    expect(unlock).toHaveBeenCalledTimes(1)
    expect(unlock).toHaveBeenCalledWith('local')
    tracker.found('wheel')
    expect(unlock).toHaveBeenCalledTimes(1)
  })

  it('does not count repeats of one secret towards the three', () => {
    const { unlock, tracker } = setup()
    tracker.found('moon')
    tracker.found('moon')
    tracker.found('moon')
    expect(unlock).not.toHaveBeenCalled()
  })
})

describe('act', () => {
  const snd = () => ({ tone: vi.fn() })

  it('moon toggles bagel and plays the click tone', () => {
    const state = { bagel: false }
    const s = snd()
    act(state, { k: 'moon' }, { snd: s })
    expect(state.bagel).toBe(true)
    expect(s.tone).toHaveBeenCalledWith(660, 0.05, 'square', 0.04)
    act(state, { k: 'moon' }, { snd: s })
    expect(state.bagel).toBe(false)
  })

  it('cross cycles the colour 0 → 1 … 4 → 0', () => {
    const state = { cross: 0 }
    const s = snd()
    const seen = []
    for (let i = 0; i < 5; i++) {
      act(state, { k: 'cross' }, { snd: s })
      seen.push(state.cross)
    }
    expect(seen).toEqual([1, 2, 3, 4, 0])
  })

  it('boat sets boatV to 26 and plays two tones (click and the ferry horn)', () => {
    const state = { boatV: 5 }
    const s = snd()
    act(state, { k: 'boat' }, { snd: s })
    expect(state.boatV).toBe(26)
    expect(s.tone).toHaveBeenCalledTimes(2)
    expect(s.tone).toHaveBeenCalledWith(150, 0.35, 'sawtooth', 0.05)
  })

  it('raccoon sets run to true', () => {
    const state = { rac: { x: 40, dir: 1, run: false, away: 0 } }
    act(state, { k: 'raccoon' }, { snd: snd() })
    expect(state.rac.run).toBe(true)
  })
})
