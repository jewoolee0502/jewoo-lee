import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createOsController } from './osController.js'
import { createOsHost } from './osHost.js'
import { createTimers } from '../core/timers.js'
import { createMotion } from '../core/motion.js'
import { createStore } from '../core/store.js'
import { dynApp } from './registry.js'
import { setReducedMotion } from '../test/setup.js'

// Stub registry, as the plan specifies. Plain object, looked up with own().
const REGISTRY = {
  a: { title: 'A', w: 300, h: 200 },
  b: { title: 'B', w: 340, h: 250, x: 520, y: 50 },
}

// Fakes for everything the controller reaches through injected deps.
function makeDeps() {
  const scene = { drive: vi.fn(), disco: vi.fn() }
  const ctrl = { exit: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn() }
  return {
    scene,
    ctrl,
    deps: {
      host: createOsHost(),
      registry: REGISTRY,
      ach: { unlock: vi.fn(), list: [], store: createStore({ got: new Set() }) },
      toasts: { toast: vi.fn() },
      snd: { tone: vi.fn(), chime: vi.fn(), off: vi.fn(), ach: vi.fn() },
      motion: createMotion(),
      timers: createTimers(),
      scene: () => scene,
      ctrl: () => ctrl,
    },
  }
}

function makeController() {
  const parts = makeDeps()
  const c = createOsController(parts.deps)
  // Expose the fakes (ach, snd, …) at the top level; scene and ctrl stay the fake objects.
  return { c, ...parts.deps, scene: parts.scene, ctrl: parts.ctrl }
}

// Boots to `on`. The last boot line is at 1050 ms, the splash at 1200 ms, and on at 2200 ms.
function bootToOn(c) {
  c.boot()
  vi.advanceTimersByTime(2200)
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe('osController', () => {
  it('starts in the standby state', () => {
    const { c } = makeController()

    expect(c.store.get().state).toBe('standby')
  })

  describe('boot', () => {
    it('shows the first line at once, then one line every 150 ms until all 8 are shown', () => {
      const { c } = makeController()

      c.boot()
      expect(c.store.get().bootLines).toHaveLength(1)

      vi.advanceTimersByTime(149)
      expect(c.store.get().bootLines).toHaveLength(1)

      vi.advanceTimersByTime(1)
      expect(c.store.get().bootLines).toHaveLength(2)

      vi.advanceTimersByTime(900)
      expect(c.store.get().bootLines).toHaveLength(8)
    })

    it('uses the prototype boot text, with the live project and role counts and the LOW tag', () => {
      const { c } = makeController()
      c.boot()
      vi.advanceTimersByTime(1050)

      const lines = c.store.get().bootLines
      expect(lines[0].text).toBe('JAY-BIOS (C) 2001-2026 · Montréal Edition')
      expect(lines[3].text).toBe('Detecting drives:  A: 3½" floppy   C: projects (9)')
      expect(lines[6].tag).toBe('LOW')
    })

    it('calls scene.drive(.2) once per boot line', () => {
      const { c, scene } = makeController()
      c.boot()
      vi.advanceTimersByTime(1050)

      expect(scene.drive).toHaveBeenCalledTimes(8)
      for (const call of scene.drive.mock.calls) expect(call).toEqual([0.2])
    })

    it('sets splashing on the tick after line 8, and goes on 1000 ms after that', () => {
      const { c, ach, snd } = makeController()
      c.boot()

      vi.advanceTimersByTime(1199)
      expect(c.store.get().splashing).toBe(false)

      vi.advanceTimersByTime(1)
      expect(c.store.get().splashing).toBe(true)
      expect(c.store.get().state).toBe('boot')

      vi.advanceTimersByTime(999)
      expect(c.store.get().state).toBe('boot')

      vi.advanceTimersByTime(1)
      expect(c.store.get().state).toBe('on')
      expect(ach.unlock).toHaveBeenCalledTimes(1)
      expect(ach.unlock).toHaveBeenCalledWith('boot')
      expect(snd.chime).toHaveBeenCalledTimes(1)
    })

    it('with reduced motion: a line every 30 ms, and the splash takes 150 ms', () => {
      setReducedMotion(true)
      const { c } = makeController()
      c.boot()
      expect(c.store.get().bootLines).toHaveLength(1)

      vi.advanceTimersByTime(29)
      expect(c.store.get().bootLines).toHaveLength(1)
      vi.advanceTimersByTime(1)
      expect(c.store.get().bootLines).toHaveLength(2)

      vi.advanceTimersByTime(180)
      expect(c.store.get().bootLines).toHaveLength(8)

      // Splash starts at 240 ms (the tick after line 8), then on 150 ms later.
      vi.advanceTimersByTime(29)
      expect(c.store.get().splashing).toBe(false)
      vi.advanceTimersByTime(1)
      expect(c.store.get().splashing).toBe(true)
      vi.advanceTimersByTime(149)
      expect(c.store.get().state).toBe('boot')
      vi.advanceTimersByTime(1)
      expect(c.store.get().state).toBe('on')
    })

    it('does nothing when called during boot or on', () => {
      const { c } = makeController()
      c.boot()
      vi.advanceTimersByTime(300)
      expect(c.store.get().bootLines).toHaveLength(3)

      c.boot()
      expect(c.store.get().state).toBe('boot')
      expect(c.store.get().bootLines).toHaveLength(3)

      vi.advanceTimersByTime(2000)
      expect(c.store.get().state).toBe('on')
      expect(c.store.get().bootLines).toHaveLength(8)

      c.boot()
      expect(c.store.get().state).toBe('on')
      expect(c.store.get().bootLines).toHaveLength(8)
    })

    it('dispose() clears pending boot timers, so nothing changes afterwards', () => {
      const { c } = makeController()
      c.boot()

      c.dispose()
      vi.advanceTimersByTime(5000)

      expect(c.store.get().state).toBe('boot')
      expect(c.store.get().bootLines).toHaveLength(1)
    })
  })

  describe('openApp before the desk is on', () => {
    it('returns null and starts boot from standby; after boot, the window opens', () => {
      const { c } = makeController()

      expect(c.openApp('a')).toBeNull()
      expect(c.store.get().state).toBe('boot')

      vi.advanceTimersByTime(2200)
      expect(c.store.get().wins.map((w) => w.id)).toEqual(['a'])
    })

    it('queues two ids and opens them in queue order once on', () => {
      const { c } = makeController()

      expect(c.openApp('a')).toBeNull()
      expect(c.openApp('b')).toBeNull()
      vi.advanceTimersByTime(2200)

      expect(c.store.get().wins.map((w) => w.id)).toEqual(['a', 'b'])
    })
  })

  describe('when on', () => {
    it('opens a window at the cascade origin, with z 21 and opening true, and clears opening after 220 ms', () => {
      const { c, snd } = makeController()
      bootToOn(c)

      const rec = c.openApp('a')

      expect(rec).toMatchObject({ id: 'a', title: 'A', x: 130, y: 46, z: 21, opening: true })
      expect(c.store.get().wins[0]).toMatchObject({ id: 'a', x: 130, y: 46, z: 21, opening: true })

      vi.advanceTimersByTime(219)
      expect(c.store.get().wins[0].opening).toBe(true)
      vi.advanceTimersByTime(1)
      expect(c.store.get().wins[0].opening).toBe(false)

      expect(snd.tone).toHaveBeenCalledWith(520, 0.05, 'square', 0.03)
    })

    it('an explicit def position is used, and a third window cascades to x 190', () => {
      const { c } = makeController()
      bootToOn(c)

      c.openApp('a')
      expect(c.openApp('b')).toMatchObject({ x: 520, y: 50 })
      // Third window has no def.x, so it takes cascade step 2: x = 130 + 2 * 30.
      expect(c.openApp('p:0')).toMatchObject({ x: 190 })
    })

    it('re-opening an open window adds no window, bumps shakeNonce, and focuses it', () => {
      const { c } = makeController()
      bootToOn(c)
      c.openApp('a')
      c.openApp('b')

      const ret = c.openApp('a')

      expect(ret).toMatchObject({ id: 'a' })
      expect(c.store.get().wins).toHaveLength(2)
      const a = c.store.get().wins.find((w) => w.id === 'a')
      const b = c.store.get().wins.find((w) => w.id === 'b')
      expect(a.shakeNonce).toBe(1)
      expect(a.z).toBeGreaterThan(b.z)
      expect(c.store.get().focusedId).toBe('a')
    })

    // The terminal re-syncs its caret on `opened`, which only an openApp of an open window bumps.
    // A focus (a pointerdown on the window, os.focus) moves z but never `opened`.
    it('each openApp of an already-open window bumps its opened counter; a focus does not', () => {
      const { c } = makeController()
      bootToOn(c)
      const first = c.openApp('a')
      expect(first.opened).toBe(0)
      c.openApp('b')

      c.focus('a')
      expect(c.store.get().wins.find((w) => w.id === 'a').opened).toBe(0)

      expect(c.openApp('a').opened).toBe(1)
      expect(c.openApp('a').opened).toBe(2)
      expect(c.store.get().wins.find((w) => w.id === 'a').opened).toBe(2)
      expect(c.store.get().wins.filter((w) => w.id === 'a')).toHaveLength(1)
    })

    it('openApp with cmd sets cmd.text, and the nonce increases on every call', () => {
      const { c } = makeController()
      bootToOn(c)

      c.openApp('a', { cmd: 'help' })
      const first = c.store.get().wins[0].cmd
      expect(first.text).toBe('help')

      c.openApp('a', { cmd: 'help' })
      const second = c.store.get().wins[0].cmd
      expect(second.text).toBe('help')
      expect(second.nonce).toBeGreaterThan(first.nonce)
    })

    it('ignores unknown and prototype-named ids without throwing', () => {
      const { c } = makeController()
      bootToOn(c)

      expect(c.openApp('nope')).toBeNull()
      expect(c.openApp('constructor')).toBeNull()
      expect(c.openApp('__proto__')).toBeNull()
      expect(c.store.get().wins).toHaveLength(0)
    })

    it('resolves project ids through dynApp: p:0 is RecycleWise, p:8 is Joblog, p:9 and p:x are null', () => {
      expect(dynApp('p:0')).toMatchObject({ title: 'RecycleWise', w: 600, h: 540 })
      expect(dynApp('p:8')).toMatchObject({ title: 'Joblog' })
      expect(dynApp('p:9')).toBeNull()
      expect(dynApp('p:x')).toBeNull()
    })

    it('has no art state and no addArt (Paint and its saved drawings are gone); art:0 never opens', () => {
      const { c } = makeController()
      bootToOn(c)

      expect(c.store.get()).not.toHaveProperty('art')
      expect(c.addArt).toBeUndefined()
      expect(c.openApp('art:0')).toBeNull()
    })

    it('shutdown: windows are removed at once; off at 600 ms; then() runs at 1500 ms', () => {
      const { c, snd, ach } = makeController()
      bootToOn(c)
      c.openApp('a')
      c.openApp('b')
      const then = vi.fn()

      c.shutdown(then)

      expect(c.store.get().wins).toHaveLength(0)
      expect(c.store.get().collapsing).toBe(true)
      expect(snd.off).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(600)
      expect(c.store.get().state).toBe('off')
      expect(c.store.get().collapsing).toBe(false)
      expect(ach.unlock).toHaveBeenCalledWith('shutdown')

      vi.advanceTimersByTime(899)
      expect(then).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(then).toHaveBeenCalledTimes(1)
    })

    it('openApp during the 600 ms shutdown collapse creates no window once state is off', () => {
      const { c } = makeController()
      bootToOn(c)

      c.shutdown(() => {})
      c.openApp('a')

      vi.advanceTimersByTime(600)
      expect(c.store.get().state).toBe('off')
      expect(c.store.get().wins.find((w) => w.id === 'a')).toBeUndefined()
    })

    it('a second shutdown during the collapse calls then exactly once', () => {
      const { c } = makeController()
      bootToOn(c)
      const first = vi.fn()
      const second = vi.fn()

      c.shutdown(first)
      c.shutdown(second)

      vi.advanceTimersByTime(2000)
      expect(first.mock.calls.length + second.mock.calls.length).toBe(1)
    })

    it('with reduced motion, shutdown reaches off at 50 ms', () => {
      setReducedMotion(true)
      const { c } = makeController()
      bootToOn(c)

      c.shutdown(() => {})

      vi.advanceTimersByTime(49)
      expect(c.store.get().state).toBe('on')
      vi.advanceTimersByTime(1)
      expect(c.store.get().state).toBe('off')
    })

    it('shutdown from standby is a no-op', () => {
      const { c, snd } = makeController()
      const then = vi.fn()

      c.shutdown(then)
      vi.advanceTimersByTime(2000)

      expect(c.store.get().state).toBe('standby')
      expect(snd.off).not.toHaveBeenCalled()
      expect(then).not.toHaveBeenCalled()
    })

    it('restart, shutdown(() => boot()), reaches on again', () => {
      const { c } = makeController()
      bootToOn(c)

      c.shutdown(() => c.boot())
      vi.advanceTimersByTime(1500)
      expect(c.store.get().state).toBe('boot')

      vi.advanceTimersByTime(2200)
      expect(c.store.get().state).toBe('on')
    })

    it('disco is on for 6000 ms and calls scene.disco(6)', () => {
      const { c, scene } = makeController()
      bootToOn(c)

      c.disco()
      expect(c.store.get().disco).toBe(true)
      expect(scene.disco).toHaveBeenCalledWith(6)

      vi.advanceTimersByTime(5999)
      expect(c.store.get().disco).toBe(true)
      vi.advanceTimersByTime(1)
      expect(c.store.get().disco).toBe(false)
    })

    it('with reduced motion, disco does nothing', () => {
      setReducedMotion(true)
      const { c, scene } = makeController()
      bootToOn(c)

      c.disco()

      expect(c.store.get().disco).toBe(false)
      expect(scene.disco).not.toHaveBeenCalled()
    })

    it('matrix() sets fx.kind to matrix, and shutdown clears fx', () => {
      const { c } = makeController()
      bootToOn(c)

      c.matrix()
      expect(c.store.get().fx.kind).toBe('matrix')

      c.shutdown(() => {})
      expect(c.store.get().fx).toBeNull()
    })

    it('setSize shrinking moves windows back in bounds; growing leaves the records unchanged', () => {
      const { c } = makeController()
      bootToOn(c)
      c.openApp('a')
      c.openApp('b')

      c.setSize(600, 500)
      const b = c.store.get().wins.find((w) => w.id === 'b')
      // fitWindows: x = clamp(520, 8, 600 - 340 - 8) = 252
      expect(b.x).toBe(252)

      const before = c.store.get().wins
      c.setSize(1000, 700)
      expect(c.store.get().wins).toBe(before)
    })
  })

  // Round 2 Phase 2 TEST LIST item 8: the flat scale is stored, and refit() re-fits after a resize.
  describe('flat scale and refit (round 2)', () => {
    function flatController({ scale = 1.5 } = {}) {
      const parts = makeDeps()
      let size = { w: 900, h: 675 }
      const host = {
        ...createOsHost(),
        setFlat: vi.fn((v) => Boolean(v)),
        fitFlat: vi.fn(() => scale),
        size: () => size,
      }
      parts.deps.host = host
      const c = createOsController(parts.deps)
      return {
        c,
        host,
        resize(next) {
          size = next
        },
      }
    }

    it('setFlat(true, false) stores the scale returned by fitFlat (1.5)', () => {
      const { c, host } = flatController({ scale: 1.5 })

      c.setFlat(true, false)

      expect(host.fitFlat).toHaveBeenCalled()
      expect(c.store.get().scale).toBe(1.5)
    })

    it('setFlat(false) resets the stored scale to 1', () => {
      const { c } = flatController({ scale: 1.5 })
      c.setFlat(true, false)

      c.setFlat(false)

      expect(c.store.get().scale).toBe(1)
    })

    it('refit() re-measures the host and moves an out-of-bounds window back inside host.size()', () => {
      const { c, host, resize } = flatController({ scale: 1 })
      bootToOn(c)
      c.setFlat(true, false)
      c.openApp('a')
      c.openApp('b')
      host.fitFlat.mockClear()

      resize({ w: 600, h: 500 })
      c.refit()

      expect(host.fitFlat).toHaveBeenCalled()
      const b = c.store.get().wins.find((w) => w.id === 'b')
      // fitWindows: x = clamp(520, 8, 600 - 340 - 8) = 252
      expect(b.x).toBe(252)
    })
  })
})
