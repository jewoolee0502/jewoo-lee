// Round 2 Phase 2 TEST LIST: stage/controller.test.js (rewrite). The camera pose is a pure
// function of the scroll position (R1): no tween, no armed/suppress, no leave().
// Harness: stage H = 1000, track 2900 (R 1900), rect.top = −scrollY unless env.trackTop is set.
// `at(y)` sets scrollY and runs one update(). `glide` is a fake { to, cancel, jump, owns, active }.
// Phase 6A (plan-r2 section 7): the remap and the detent write through glide.jump (U3); the snap rail
// is synced through ui.setSnap before a remap (U1, U2); the cue follows cueOpacity (U9).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createController } from './controller.js'

function setup({ now } = {}) {
  const env = { scrollY: 0, status: 'ready', reduce: false, trackTop: null, trackH: 2900, stageH: 1000 }
  const os = { state: 'standby', boot: vi.fn(), setFlat: vi.fn(), setLive: vi.fn() }
  const ui = { setCue: vi.fn(), setZoomed: vi.fn(), setRunway: vi.fn(), setHud: vi.fn(), setSnap: vi.fn() }
  const scrollTo = vi.fn()
  const scrollToResume = vi.fn()
  const glide = { to: vi.fn(), cancel: vi.fn(), jump: vi.fn(), owns: vi.fn(() => false), active: false }
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

  it('10. settle({dir, travel}) glides by the user direction: down at 100 px travel to diveEnd, up at 200 px from the out segment to insideEnd; a tiny travel returns', () => {
    const a = setup()
    a.at(100)
    a.ctrl.settle({ dir: 1, travel: 100 })
    expect(a.lastTo()).toBe(1000)

    const b = setup()
    b.at(10)
    b.ctrl.settle({ dir: 1, travel: 10 })
    expect(b.lastTo()).toBe(0)

    const c = setup()
    c.at(1300)
    c.ctrl.settle({ dir: -1, travel: 200 })
    expect(c.lastTo()).toBe(1120)

    const d = setup()
    d.at(1060)
    d.ctrl.settle({ dir: 1, travel: 100 })
    expect(d.glide.to).not.toHaveBeenCalled()

    const e = setup()
    e.at(2000)
    e.ctrl.settle({ dir: 1, travel: 100 })
    expect(e.glide.to).not.toHaveBeenCalled()

    const f = setup()
    f.at(400)
    f.glide.active = true
    f.ctrl.settle({ dir: 1, travel: 100 })
    expect(f.glide.to).not.toHaveBeenCalled()
  })

  it('11. loading: at 1000 is desk with no flat-on call and cue 0 (U9: the cue follows the segment); at 0 it is .8; once ready, the same position is inside', () => {
    const { env, os, ui, at, phase } = setup()
    env.status = 'loading'
    at(1000)
    expect(phase()).toBe('desk')
    expect(os.setFlat).not.toHaveBeenCalledWith(true, expect.anything())
    expect(ui.setCue).toHaveBeenLastCalledWith(0)
    at(0)
    expect(ui.setCue).toHaveBeenLastCalledWith(0.8)
    env.status = 'ready'
    at(1000)
    expect(phase()).toBe('inside')
  })

  it('12n. unavailable on a narrow screen: the flat OS is compact, because narrow is passed through', () => {
    const { env, os, ctrl, at } = setup()
    ctrl.setNarrow(true)
    env.status = 'unavailable'
    at(0)
    expect(os.setFlat).toHaveBeenLastCalledWith(true, true)
  })

  it('12. unavailable: setRunway(true) once over three updates, flat (not compact on a wide screen) live, boot once while standby, cue 0', () => {
    const { env, os, ui, at } = setup()
    env.status = 'unavailable'
    at(0)
    at(100)
    at(200)
    expect(ui.setRunway).toHaveBeenCalledTimes(1)
    expect(ui.setRunway).toHaveBeenCalledWith(true)
    // No-WebGL fallback on a wide screen uses the normal flat layout: compact = narrow (false here).
    expect(os.setFlat).toHaveBeenLastCalledWith(true, false)
    expect(os.setFlat).not.toHaveBeenCalledWith(true, true)
    expect(os.setLive).toHaveBeenLastCalledWith(true)
    expect(os.boot).toHaveBeenCalledTimes(1)
    os.state = 'on'
    at(300)
    expect(os.boot).toHaveBeenCalledTimes(1)
    expect(ui.setCue).toHaveBeenLastCalledWith(0)
  })

  it('13. resize remap: a stage/track change over 15 % jumps to the remapped position (U3: through glide.jump); a 5 % change does not', () => {
    const a = setup()
    a.at(1000)
    a.env.stageH = 600
    a.env.trackH = 1740
    a.ctrl.update(0)
    expect(a.glide.jump).toHaveBeenCalledWith(600)
    expect(a.scrollTo).not.toHaveBeenCalled()

    const b = setup()
    b.at(1000)
    b.env.trackH = 2800 // R 1800 against 1900: 5 %
    b.ctrl.update(0)
    expect(b.glide.jump).not.toHaveBeenCalled()
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

  it('15. onWheel: a burst crossing the plateau returns true and snaps to 1000 through glide.jump; the next event returns true with no extra jump', () => {
    const { at, ctrl, glide, scrollTo } = setup()
    at(800)
    expect(ctrl.onWheel({ deltaY: 300, deltaMode: 0, timeStamp: 0 })).toBe(true)
    expect(glide.jump).toHaveBeenCalledWith(1000)
    expect(scrollTo).not.toHaveBeenCalled()
    glide.jump.mockClear()
    expect(ctrl.onWheel({ deltaY: 300, deltaMode: 0, timeStamp: 16 })).toBe(true)
    expect(glide.jump).not.toHaveBeenCalled()
  })

  it('15c. an exact landing on the plateau (800 + 200 = 1000) holds the detent: events < DETENT_GAP_MS apart keep the flag true', () => {
    const clock = { t: 0 }
    const { at, ctrl, glide } = setup({ now: () => clock.t })
    at(800)
    expect(ctrl.onWheel({ deltaY: 200, deltaMode: 0, timeStamp: 0 })).toBe(true)
    expect(glide.jump).toHaveBeenCalledWith(1000)
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

  // Phase 6A (U1, U2): the rail is synced once per layout, before any remap, and released with the scene.
  describe('snap rail sync (U1, U2)', () => {
    it('the first ready frame syncs the rail with the layout once; ten more frames at other positions do not sync it again', () => {
      const { ui, at } = setup()
      at(0)
      expect(ui.setSnap).toHaveBeenCalledTimes(1)
      expect(ui.setSnap).toHaveBeenCalledWith(expect.objectContaining({ R: 1900, diveEnd: 1000, insideEnd: 1120, outEnd: 1720 }))
      for (const y of [100, 500, 1000, 1200, 1500, 1720, 1800, 1900, 2500, 2900]) at(y)
      expect(ui.setSnap).toHaveBeenCalledTimes(1)
    })

    it('a resize syncs the new layout again, before glide.jump (the rail must move first, or the browser re-snaps to the old one)', () => {
      const { env, ui, glide, at } = setup()
      at(1000)
      ui.setSnap.mockClear()
      env.stageH = 720
      env.trackH = 2088
      at(1000)
      expect(ui.setSnap).toHaveBeenCalledWith(expect.objectContaining({ R: 1368, diveEnd: 720, insideEnd: 840, outEnd: 1238 }))
      expect(glide.jump).toHaveBeenCalled()
      expect(ui.setSnap.mock.invocationCallOrder[0]).toBeLessThan(glide.jump.mock.invocationCallOrder[0])
    })

    it('while loading the rail is never synced', () => {
      const { env, ui, at } = setup()
      env.status = 'loading'
      at(0)
      at(1000)
      expect(ui.setSnap).not.toHaveBeenCalled()
    })

    it('unavailable clears the rail once over three updates', () => {
      const { env, ui, at } = setup()
      env.status = 'unavailable'
      at(0)
      at(100)
      at(200)
      expect(ui.setSnap).toHaveBeenCalledTimes(1)
      expect(ui.setSnap).toHaveBeenCalledWith(null)
    })

    it('releaseSnap() clears the rail (setSnap(null)) and forgets the synced layout', () => {
      const { ui, ctrl, at } = setup()
      at(0)
      ui.setSnap.mockClear()
      ctrl.releaseSnap()
      expect(ui.setSnap).toHaveBeenCalledWith(null)
      at(0)
      expect(ui.setSnap).toHaveBeenCalledTimes(2)
      expect(ui.setSnap).toHaveBeenLastCalledWith(expect.objectContaining({ diveEnd: 1000 }))
    })
  })

  // Phase 6A (U9): the cue is visible at the top only, and the loading cue follows the same function.
  describe('scroll cue (U9)', () => {
    it('at the top the cue is .8; at 1720 (the tail) and 2500 (the résumé) it is 0', () => {
      const { ui, at } = setup()
      at(0)
      expect(ui.setCue).toHaveBeenLastCalledWith(0.8)
      at(1720)
      expect(ui.setCue).toHaveBeenLastCalledWith(0)
      at(2500)
      expect(ui.setCue).toHaveBeenLastCalledWith(0)
    })
  })

  // Browser re-check (phase 6A): Chrome ends a wheel sequence at its first blocked event and snaps from
  // where the sequence meant to end (short of the stop), so the detent keeps the CSS snap off until rest.
  it('15d. a detent snap holds the CSS snap (ui.holdSnap) before its jump, once, until the next settle', () => {
    const { at, ctrl, ui, glide } = setup()
    ui.holdSnap = vi.fn()
    at(800)
    ctrl.onWheel({ deltaY: 300, deltaMode: 0, timeStamp: 0 })
    ctrl.onWheel({ deltaY: 300, deltaMode: 0, timeStamp: 16 })
    expect(ui.holdSnap.mock.calls).toEqual([[true]])
    expect(ui.holdSnap.mock.invocationCallOrder[0]).toBeLessThan(glide.jump.mock.invocationCallOrder[0])
    at(1000)
    ctrl.settle({ dir: 1, travel: 200 })
    expect(ui.holdSnap.mock.calls).toEqual([[true], [false]])
    ctrl.settle({ dir: 1, travel: 0 })
    expect(ui.holdSnap).toHaveBeenCalledTimes(2)
  })

  // Phase 6A TEST LIST (detent snap-hold not stuck): a detent snap to where the page already is moves
  // nothing, so it must not hold the CSS snap (a hold with no jump would stay on until a settle that never
  // comes, since no burst ends at a new position).
  it('15e. a detent snap whose snapTo equals the current s (|snapTo − s| < 1) does not call ui.holdSnap', () => {
    const { at, ctrl, ui, glide } = setup()
    ui.holdSnap = vi.fn()
    at(999.5)
    const r = ctrl.onWheel({ deltaY: 300, deltaMode: 0, timeStamp: 0 })
    expect(r).toBe(true)
    expect(glide.jump).toHaveBeenCalledWith(1000)
    expect(ui.holdSnap).not.toHaveBeenCalled()
  })

  // Phase 6A TEST LIST (runway-snap cleared at once): applyFlat runs on the scene status change and must
  // clear the rail as soon as the scene is unavailable, not on the next frame.
  it('15f. applyFlat after the scene turns unavailable (no frame) clears the rail: ui.setSnap(null)', () => {
    const { env, ui, ctrl, at } = setup()
    at(0)
    expect(ui.setSnap).toHaveBeenLastCalledWith(expect.objectContaining({ diveEnd: 1000 }))
    ui.setSnap.mockClear()
    env.status = 'unavailable'
    ctrl.applyFlat()
    expect(ui.setSnap).toHaveBeenCalledWith(null)
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
