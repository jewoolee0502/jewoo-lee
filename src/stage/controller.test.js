// Round 2 Phase 2 TEST LIST: stage/controller.test.js (rewrite). The camera pose is a pure
// function of the scroll position (R1): no tween, no armed/suppress, no leave().
// Harness: stage H = 1000, track 2900 (R 1900), rect.top = −scrollY unless env.trackTop is set.
// `at(y)` sets scrollY and runs one update(). `glide` is a fake { to, cancel, active }.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createController } from './controller.js'

function setup({ now } = {}) {
  const env = { scrollY: 0, status: 'ready', reduce: false, trackTop: null, trackH: 2900, stageH: 1000 }
  const os = { state: 'standby', boot: vi.fn(), setFlat: vi.fn(), setLive: vi.fn() }
  const ui = { setCue: vi.fn(), setZoomed: vi.fn(), setRunway: vi.fn(), setHud: vi.fn() }
  const scrollTo = vi.fn()
  const scrollToResume = vi.fn()
  const glide = { to: vi.fn(), cancel: vi.fn(), active: false }
  const ctrl = createController({
    getTrackRect: () => ({
      top: env.trackTop ?? -env.scrollY,
      height: env.trackH,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
    }),
    getStageHeight: () => env.stageH,
    scrollY: () => env.scrollY,
    scrollTo,
    glide,
    reduce: () => env.reduce,
    sceneStatus: () => env.status,
    os,
    ui,
    scrollToResume,
    now,
  })
  const at = (y) => {
    env.scrollY = y
    ctrl.update(0)
  }
  const phase = () => ctrl.store.get().phase
  const lastTo = () => glide.to.mock.calls.at(-1)?.[0]
  return { env, os, ui, scrollTo, scrollToResume, glide, ctrl, at, phase, lastTo }
}

describe('stage/controller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('1. at scrollY 0: z 0, phase desk, and the cue is .8', () => {
    const { ctrl, ui, at, phase } = setup()
    at(0)
    expect(ctrl.z).toBe(0)
    expect(phase()).toBe('desk')
    expect(ui.setCue).toHaveBeenLastCalledWith(0.8)
  })

  it('2. at 500: z .5, phase dive, not interactive, the OS never goes live, cue 0', () => {
    const { ctrl, ui, os, at, phase } = setup()
    at(500)
    expect(ctrl.z).toBe(0.5)
    expect(phase()).toBe('dive')
    expect(ctrl.store.get().interactive).toBe(false)
    expect(os.setLive).not.toHaveBeenCalledWith(true)
    expect(ui.setCue).toHaveBeenLastCalledWith(0)
  })

  it('the HUD is fully shown on the desk and mid-dive, and gone before the screen reaches it (HUD_FADE)', () => {
    const { ui, at } = setup()
    at(0)
    expect(ui.setHud).toHaveBeenLastCalledWith(1)
    at(500)
    expect(ui.setHud).toHaveBeenLastCalledWith(1)
    at(700)
    const mid = ui.setHud.mock.calls.at(-1)[0]
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    at(800)
    expect(ui.setHud).toHaveBeenLastCalledWith(0)
  })

  it('3. at 1000: phase inside, zoomed on, the OS live, and the last setFlat is (true, false)', () => {
    const { ctrl, ui, os, at, phase } = setup()
    at(1000)
    expect(phase()).toBe('inside')
    expect(ctrl.store.get().interactive).toBe(true)
    expect(ui.setZoomed).toHaveBeenLastCalledWith(true)
    expect(os.setLive).toHaveBeenLastCalledWith(true)
    expect(os.setFlat).toHaveBeenLastCalledWith(true, false)
  })

  it('4. hysteresis: 990 stays inside, 984 drops back to dive and turns the OS off', () => {
    const { ui, os, at, phase } = setup()
    at(1000)
    at(990)
    expect(phase()).toBe('inside')
    at(984)
    expect(phase()).toBe('dive')
    expect(ui.setZoomed).toHaveBeenLastCalledWith(false)
    expect(os.setLive).toHaveBeenLastCalledWith(false)
    expect(os.setFlat).toHaveBeenLastCalledWith(false, false)
  })

  it('5. out segment: 1420 is z .5 in dive, 1720 is z 0 at desk, 2500 stays desk', () => {
    const { ctrl, at, phase } = setup()
    at(1420)
    expect(ctrl.z).toBe(0.5)
    expect(phase()).toBe('dive')
    at(1720)
    expect(ctrl.z).toBe(0)
    expect(phase()).toBe('desk')
    at(2500)
    expect(phase()).toBe('desk')
  })

  it('6. narrow: with setNarrow(true), the last setFlat once inside is (true, true)', () => {
    const { os, ctrl, at } = setup()
    ctrl.setNarrow(true)
    at(1000)
    expect(os.setFlat).toHaveBeenLastCalledWith(true, true)
  })

  it('7. enter() glides to trackTopDoc + diveEnd from wherever the page is, and does nothing when inside or loading', () => {
    const a = setup()
    a.at(0)
    a.ctrl.enter()
    expect(a.lastTo()).toBe(1000)

    const b = setup()
    b.at(3000)
    b.ctrl.enter()
    expect(b.lastTo()).toBe(1000)

    const c = setup()
    c.env.trackTop = 200
    c.at(50)
    c.ctrl.enter()
    expect(c.lastTo()).toBe(1250)

    const d = setup()
    d.at(1000)
    d.glide.to.mockClear()
    d.ctrl.enter()
    expect(d.glide.to).not.toHaveBeenCalled()

    const e = setup()
    e.env.status = 'loading'
    e.at(0)
    e.ctrl.enter()
    expect(e.glide.to).not.toHaveBeenCalled()
  })

  it('7b. enter() with no scene (unavailable) scrolls the track top into view and never glides', () => {
    const { env, scrollTo, glide, ctrl, at } = setup()
    env.status = 'unavailable'
    at(300)
    ctrl.enter()
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
    expect(glide.to).not.toHaveBeenCalled()
  })

  it('8. exit() from inside glides to the track top; from desk it does nothing', () => {
    const a = setup()
    a.at(1000)
    a.ctrl.exit()
    expect(a.lastTo()).toBe(0)

    const b = setup()
    b.at(0)
    b.ctrl.exit()
    expect(b.glide.to).not.toHaveBeenCalled()
  })

  it('9. goToResume() cancels any glide first, then scrolls to the résumé (smooth, or auto with reduced motion)', () => {
    const a = setup()
    a.at(1000)
    a.ctrl.goToResume()
    expect(a.glide.cancel).toHaveBeenCalledTimes(1)
    expect(a.scrollToResume).toHaveBeenCalledWith('smooth')
    expect(a.glide.cancel.mock.invocationCallOrder[0]).toBeLessThan(a.scrollToResume.mock.invocationCallOrder[0])

    const b = setup()
    b.env.reduce = true
    b.at(0)
    b.ctrl.goToResume()
    expect(b.scrollToResume).toHaveBeenLastCalledWith('auto')
  })

  it('10. settle(+1) glides to diveEnd at 400 and to 0 at 200; not on plateau or past; not while a glide is active', () => {
    const a = setup()
    a.at(400)
    a.ctrl.settle(1)
    expect(a.lastTo()).toBe(1000)

    const b = setup()
    b.at(200)
    b.ctrl.settle(1)
    expect(b.lastTo()).toBe(0)

    const c = setup()
    c.at(1060)
    c.ctrl.settle(1)
    expect(c.glide.to).not.toHaveBeenCalled()

    const d = setup()
    d.at(2000)
    d.ctrl.settle(1)
    expect(d.glide.to).not.toHaveBeenCalled()

    const e = setup()
    e.at(400)
    e.glide.active = true
    e.ctrl.settle(1)
    expect(e.glide.to).not.toHaveBeenCalled()
  })

  it('11. loading: at 1000 is desk with no flat-on call and cue .8; once ready, the same position is inside', () => {
    const { env, os, ui, at, phase } = setup()
    env.status = 'loading'
    at(1000)
    expect(phase()).toBe('desk')
    expect(os.setFlat).not.toHaveBeenCalledWith(true, expect.anything())
    expect(ui.setCue).toHaveBeenLastCalledWith(0.8)
    env.status = 'ready'
    at(1000)
    expect(phase()).toBe('inside')
  })

  it('12. unavailable: setRunway(true) once over three updates, flat compact live, boot once while standby, cue 0', () => {
    const { env, os, ui, at } = setup()
    env.status = 'unavailable'
    at(0)
    at(100)
    at(200)
    expect(ui.setRunway).toHaveBeenCalledTimes(1)
    expect(ui.setRunway).toHaveBeenCalledWith(true)
    expect(os.setFlat).toHaveBeenLastCalledWith(true, true)
    expect(os.setLive).toHaveBeenLastCalledWith(true)
    expect(os.boot).toHaveBeenCalledTimes(1)
    os.state = 'on'
    at(300)
    expect(os.boot).toHaveBeenCalledTimes(1)
    expect(ui.setCue).toHaveBeenLastCalledWith(0)
  })

  it('13. resize remap: a stage/track change over 15 % scrolls to the remapped position; a 5 % change does not', () => {
    const a = setup()
    a.at(1000)
    a.env.stageH = 600
    a.env.trackH = 1740
    a.ctrl.update(0)
    expect(a.scrollTo).toHaveBeenCalledWith({ top: 600, behavior: 'instant' })

    const b = setup()
    b.at(1000)
    b.env.trackH = 2800 // R 1800 against 1900: 5 %
    b.ctrl.update(0)
    expect(b.scrollTo).not.toHaveBeenCalled()
  })

  it('14. invariant through the controller: z > 0 implies the stage is still pinned, at three viewport sizes', () => {
    const sizes = [
      { H: 1000, trackH: 2900 },
      { H: 600, trackH: 1740 },
      { H: 844, trackH: 2448 },
    ]
    for (const { H, trackH } of sizes) {
      const { env, ctrl, at } = setup()
      env.stageH = H
      env.trackH = trackH
      const R = trackH - H
      for (let y = 0; y <= trackH; y += 5) {
        at(y)
        if (ctrl.z > 0) {
          expect(y, `H ${H} y ${y}`).toBeLessThan(R)
          expect(y, `H ${H} y ${y}`).toBeLessThanOrEqual(R - 0.15 * H)
        }
      }
    }
  })

  it('14b. the H 1000 case: z > 0 only for y ≤ 1750', () => {
    const { ctrl, at } = setup()
    for (let y = 0; y <= 3000; y += 10) {
      at(y)
      if (ctrl.z > 0) expect(y).toBeLessThanOrEqual(1750)
    }
  })

  it('15. onWheel: a burst crossing the plateau returns true and snaps to 1000; the next event returns true with no extra scroll', () => {
    const { at, ctrl, scrollTo } = setup()
    at(800)
    expect(ctrl.onWheel({ deltaY: 300, deltaMode: 0, timeStamp: 0 })).toBe(true)
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'instant' })
    scrollTo.mockClear()
    expect(ctrl.onWheel({ deltaY: 300, deltaMode: 0, timeStamp: 16 })).toBe(true)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('15c. an exact landing on the plateau (800 + 200 = 1000) holds the detent: events < DETENT_GAP_MS apart keep the flag true', () => {
    const clock = { t: 0 }
    const { at, ctrl, scrollTo } = setup({ now: () => clock.t })
    at(800)
    expect(ctrl.onWheel({ deltaY: 200, deltaMode: 0, timeStamp: 0 })).toBe(true)
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'instant' })
    at(1000)
    expect(ctrl.store.get().detent).toBe(true)
    for (let t = 16; t <= 96; t += 16) {
      clock.t = t
      ctrl.onWheel({ deltaY: 50, deltaMode: 0, timeStamp: t })
      at(1000)
      expect(ctrl.store.get().detent, `t ${t}`).toBe(true)
    }
  })

  it('15b. onWheel while loading returns false (the event is left alone)', () => {
    const { env, ctrl, at } = setup()
    env.status = 'loading'
    at(800)
    expect(ctrl.onWheel({ deltaY: 300, deltaMode: 0, timeStamp: 0 })).toBe(false)
  })

  it('16. the controller never boots the OS when the scene is ready (the lid does)', () => {
    const { os, ctrl, at } = setup()
    at(0)
    at(1000)
    ctrl.enter()
    at(1000)
    expect(os.boot).not.toHaveBeenCalled()
  })
})
