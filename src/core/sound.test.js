import { describe, it, expect, vi } from 'vitest'
import { createSound } from './sound.js'

// Minimal fake AudioContext: records the oscillator and frequency writes.
function makeFakeAudio() {
  const osc = {
    type: 'square',
    frequency: { value: 0, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
  const gain = {
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }
  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: {},
    createOscillator: vi.fn(() => osc),
    createGain: vi.fn(() => gain),
    createBuffer: vi.fn(),
    createBufferSource: vi.fn(),
    createBiquadFilter: vi.fn(),
    resume: vi.fn(() => Promise.resolve()),
  }
  const factory = vi.fn(() => ctx)
  return { ctx, osc, factory }
}

describe('createSound', () => {
  it('with sound off, tone() never calls the factory', () => {
    const { factory, ctx } = makeFakeAudio()
    const snd = createSound({ ctxFactory: factory })

    snd.tone(440, 0.1, 'sine', 0.1)

    expect(factory).not.toHaveBeenCalled()
    expect(ctx.createOscillator).not.toHaveBeenCalled()
  })

  it('setOn(true) calls the factory once and creates one 660 Hz oscillator', () => {
    const { factory, ctx, osc } = makeFakeAudio()
    const snd = createSound({ ctxFactory: factory })

    snd.setOn(true)

    expect(factory).toHaveBeenCalledTimes(1)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1)
    const frequencies = [osc.frequency.value, ...osc.frequency.setValueAtTime.mock.calls.map((c) => c[0])]
    expect(frequencies).toContain(660)
  })

  it('setOn(false) then tone() creates nothing new', () => {
    const { factory, ctx } = makeFakeAudio()
    const snd = createSound({ ctxFactory: factory })
    snd.setOn(true)
    const oscillatorsBefore = ctx.createOscillator.mock.calls.length

    snd.setOn(false)
    snd.tone(440, 0.1, 'sine', 0.1)

    expect(ctx.createOscillator.mock.calls.length).toBe(oscillatorsBefore)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('the store on flag toggles with setOn', () => {
    const { factory } = makeFakeAudio()
    const snd = createSound({ ctxFactory: factory })
    expect(snd.store.get().on).toBe(false)

    snd.setOn(true)
    expect(snd.store.get().on).toBe(true)

    snd.setOn(false)
    expect(snd.store.get().on).toBe(false)
  })
})
