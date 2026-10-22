// Opt-in Web Audio sound effects, ported from L638–649. The AudioContext is
// created lazily (only once sound is turned on) through an injectable factory.
import { createStore } from './store.js'

function defaultCtxFactory() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext
  return AC ? new AC() : null
}

export function createSound({ ctxFactory = defaultCtxFactory } = {}) {
  const store = createStore({ on: false })
  let ac = null

  function ctx() {
    if (!ac) {
      try {
        ac = ctxFactory() || null
      } catch {
        ac = null
      }
    }
    return ac
  }

  const snd = {
    store,
    ctx,
    tone(f, dur, type, vol, when) {
      if (!store.get().on) return
      const a = ctx()
      if (!a) return
      const o = a.createOscillator()
      const g = a.createGain()
      const t = a.currentTime + (when || 0)
      o.type = type || 'square'
      o.frequency.value = f
      g.gain.setValueAtTime(vol || 0.04, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g)
      g.connect(a.destination)
      o.start(t)
      o.stop(t + dur + 0.05)
    },
    noise(dur, vol, freq, when) {
      if (!store.get().on) return
      const a = ctx()
      if (!a) return
      const n = Math.floor(a.sampleRate * dur)
      const buf = a.createBuffer(1, n, a.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n)
      const s = a.createBufferSource()
      const f = a.createBiquadFilter()
      const g = a.createGain()
      const t = a.currentTime + (when || 0)
      s.buffer = buf
      f.type = 'bandpass'
      f.frequency.value = freq || 2000
      g.gain.value = vol || 0.05
      s.connect(f)
      f.connect(g)
      g.connect(a.destination)
      s.start(t)
    },
    click() {
      snd.noise(0.03, 0.05, 3200)
    },
    chime() {
      ;[523, 659, 784, 1047].forEach((f, i) => snd.tone(f, 0.6, 'triangle', 0.06, i * 0.11))
    },
    floppy() {
      for (let i = 0; i < 7; i++) snd.noise(0.07, 0.06, 300 + (i % 3) * 180, i * 0.09)
    },
    pop() {
      snd.tone(880, 0.07, 'square', 0.05)
      snd.tone(330, 0.12, 'square', 0.04, 0.04)
    },
    ach() {
      snd.tone(988, 0.1, 'square', 0.045)
      snd.tone(1319, 0.3, 'square', 0.045, 0.1)
    },
    off() {
      snd.tone(220, 0.4, 'sawtooth', 0.04)
      snd.tone(110, 0.5, 'sawtooth', 0.03, 0.15)
    },
    /** L650 setSound: toggles, creates the context when turning on, and plays a confirmation blip. */
    setOn(v) {
      const on = Boolean(v)
      store.set({ on })
      if (on) {
        ctx()
        snd.tone(660, 0.12, 'square', 0.05)
      }
    },
  }
  return snd
}
