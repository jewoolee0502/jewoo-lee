// Round 3 Phase R3-1 TEST LIST: stage/controller.test.js. The camera pose is a pure function of the
// scroll position (R1): no tween, no armed/suppress, no leave().
// Harness: stage H = 1000, track 2120 (R 1120, diveEnd 1000), rect.top = −scrollY unless env.trackTop is set.
// `at(y)` sets scrollY and runs one update(). `glide` is a fake { to, cancel, jump, owns, active }.
// Round 3 (plan-r3 V2–V5): the document ends at the open laptop. Enter and settle target R, not diveEnd;
// the resize rule jumps through glide.jump; nothing snaps or detents.
// Round 3 Phase R3-2 (plan-r3 V6–V7, I9–I10): park/unpark freeze the laptop while the résumé view is
// shown. goToResume is gone (the views switch it, not the controller), so its test 9 is removed.
// Round 3 Phase R3-3 review (plan-r3 V17): a deep link's scene loads only on the first unpark, so
// unpark('open') can land while the scene is still loading. It lands at the desk and opens with the
// normal glide once the scene is ready (L1–L5); a page left mid-dive while loading settles on ready.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createController } from './controller.js'

function setup() {
  const env = { scrollY: 0, status: 'ready', reduce: false, trackTop: null, trackH: 2120, stageH: 1000 }
  const os = { state: 'standby', boot: vi.fn(), setFlat: vi.fn(), setLive: vi.fn() }
  const ui = { setCue: vi.fn(), setZoomed: vi.fn(), setRunway: vi.fn(), setHud: vi.fn() }
  // jump() moves the page as the browser would, so a phase read after it sees the new position.
  const glide = {
    to: vi.fn(),
    cancel: vi.fn(),
    jump: vi.fn((top) => {
      env.scrollY = top
    }),
    owns: vi.fn(() => false),
    active: false,
  }
  const getTrackRect = vi.fn(() => ({
    top: env.trackTop ?? -env.scrollY,
    height: env.trackH,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
  }))
  const ctrl = createController({
    getTrackRect,
    getStageHeight: () => env.stageH,
    scrollY: () => env.scrollY,
    glide,
    reduce: () => env.reduce,
    sceneStatus: () => env.status,
    os,
    ui,
  })
  const at = (y) => {
    env.scrollY = y
    ctrl.update(0)
  }
  const phase = () => ctrl.store.get().phase
  const lastTo = () => glide.to.mock.calls.at(-1)?.[0]
  return { env, os, ui, glide, getTrackRect, ctrl, at, phase, lastTo }
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

  it('5. the plateau: 1060 and 1120 are inside with z 1; after 1120 then 1060 it stays inside', () => {
    const { ctrl, at, phase } = setup()
    at(1060)
    expect(ctrl.z).toBe(1)
    expect(phase()).toBe('inside')
    at(1120)
    expect(phase()).toBe('inside')
    at(1060)
    expect(phase()).toBe('inside')
    expect(ctrl.z).toBe(1)
  })

  it('6. narrow: with setNarrow(true), the last setFlat once inside is (true, true)', () => {
    const { os, ctrl, at } = setup()
    ctrl.setNarrow(true)
    at(1000)
    expect(os.setFlat).toHaveBeenLastCalledWith(true, true)
  })

  it('7. enter() glides to the open laptop (R 1120) from wherever the page is, and does nothing when inside, loading or interactive', () => {
    const a = setup()
    a.at(0)
    a.ctrl.enter()
    expect(a.lastTo()).toBe(1120)

    const b = setup()
    b.at(500)
    b.ctrl.enter()
    expect(b.lastTo()).toBe(1120)

    const c = setup()
    c.env.trackTop = 200
    c.at(50)
    c.ctrl.enter()
    expect(c.lastTo()).toBe(1370)

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

  it('7b. enter() with no scene (unavailable) does not glide at the track top: the fallback is already open', () => {
    const { env, glide, ctrl, at } = setup()
    env.status = 'unavailable'
    at(0)
    ctrl.enter()
    expect(glide.to).not.toHaveBeenCalled()
  })

  // R3-2: the fallback is always the open flat OS, so enter() does nothing there, even when the
  // page is scrolled past the track (the résumé view is shown by the views, not by a glide).
  it('7c. enter() with no scene does nothing, even scrolled past the track: no glide and no jump', () => {
    const { env, glide, ctrl, at } = setup()
    env.status = 'unavailable'
    at(300)
    ctrl.enter()
    expect(glide.to).not.toHaveBeenCalled()
    expect(glide.jump).not.toHaveBeenCalled()
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

  it('10. settle({dir, travel}) glides by the user direction: down at 100 px travel to the open laptop, up at 200 px to the desk, a tiny travel returns; the plateau, beyond R and a running glide never settle', () => {
    const a = setup()
    a.at(100)
    a.ctrl.settle({ dir: 1, travel: 100 })
    expect(a.lastTo()).toBe(1120)

    const b = setup()
    b.at(10)
    b.ctrl.settle({ dir: 1, travel: 10 })
    expect(b.lastTo()).toBe(0)

    const c = setup()
    c.at(900)
    c.ctrl.settle({ dir: -1, travel: 200 })
    expect(c.lastTo()).toBe(0)

    const d = setup()
    d.at(1060)
    d.ctrl.settle({ dir: 1, travel: 100 })
    expect(d.glide.to).not.toHaveBeenCalled()

    const e = setup()
    e.at(1120)
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

  // V5 (plan-r3 I7): a layout change on an open laptop jumps to its new open end, mid-dive keeps its
  // fraction only past REMAP_THRESHOLD, and a glide the controller started is re-aimed at its end.
  describe('resize rule (V5, I7)', () => {
    it('(a) mid-dive with a 36 % layout change keeps the dive fraction through glide.jump (500 → 300)', () => {
      const { env, glide, at } = setup()
      at(500)
      env.stageH = 600
      env.trackH = 1320
      at(500)
      expect(glide.jump).toHaveBeenCalledWith(300)
    })

    it('(b) mid-dive with a 4.5 % layout change keeps the position: no jump', () => {
      const { env, glide, at } = setup()
      at(500)
      env.stageH = 1050
      env.trackH = 2220
      at(500)
      expect(glide.jump).not.toHaveBeenCalled()
    })

    it('(c) open at 1000 with a taller layout (dive end 1050) jumps to the new open end: glide.jump(1170)', () => {
      const { env, glide, at } = setup()
      at(1000)
      env.stageH = 1050
      env.trackH = 2220
      at(1000)
      expect(glide.jump).toHaveBeenCalledWith(1170)
    })

    it('(d) open at 1120 with the taller layout: already on its plateau, no jump', () => {
      const { env, glide, at } = setup()
      at(1120)
      env.stageH = 1050
      env.trackH = 2220
      at(1120)
      expect(glide.jump).not.toHaveBeenCalled()
    })

    it('(e) an open glide started by enter() is re-aimed at the new open end when the layout changes', () => {
      const { env, glide, at, ctrl } = setup()
      at(0)
      ctrl.enter()
      expect(glide.to).toHaveBeenLastCalledWith(1120)
      glide.active = true
      env.stageH = 1050
      env.trackH = 2220
      at(300)
      expect(glide.to).toHaveBeenLastCalledWith(1170)
    })

    it('(f) once the controller glide has finished, its end is forgotten: a later active glide is not re-aimed, the resize rule applies', () => {
      const { env, glide, at, ctrl } = setup()
      at(0)
      ctrl.enter()
      glide.active = true
      at(500)
      glide.active = false
      at(500)
      // A glide the controller did not start (it is active, but no controller end is pending).
      glide.active = true
      env.stageH = 600
      env.trackH = 1320
      at(500)
      expect(glide.to).toHaveBeenCalledTimes(1)
      expect(glide.jump).toHaveBeenCalledWith(300)
    })

    it('(g) a small layout change (mobile toolbar) late in the dive keeps the dive fraction: no jump to open, still mid-dive', () => {
      const { env, glide, ctrl, at, phase, os } = setup()
      env.stageH = 754
      env.trackH = 2 * 844 + 120
      at(900)
      const z0 = ctrl.z
      expect(phase()).toBe('dive')
      env.stageH = 844
      at(900)
      expect(glide.jump).toHaveBeenCalledWith(813)
      expect(phase()).toBe('dive')
      expect(ctrl.store.get().interactive).toBe(false)
      expect(os.setLive).not.toHaveBeenCalledWith(true)
      expect(Math.abs(ctrl.z - z0)).toBeLessThan(0.01)
    })
  })

  it('14. the document end is the open laptop: at trackH − stageH the phase is inside and every s from diveEnd to R has z 1, at three viewport sizes', () => {
    const sizes = [
      { H: 1000, trackH: 2120 },
      { H: 600, trackH: 1320 },
      { H: 844, trackH: 1808 },
    ]
    for (const { H, trackH } of sizes) {
      const { env, ctrl, phase, at } = setup()
      env.stageH = H
      env.trackH = trackH
      const R = trackH - H
      at(R)
      expect(phase(), `H ${H} R`).toBe('inside')
      for (let y = R; y >= H; y -= 5) {
        at(y)
        expect(ctrl.z, `H ${H} y ${y}`).toBe(1)
        expect(phase(), `H ${H} y ${y}`).toBe('inside')
      }
    }
  })

  // Scroll cue (U9): visible at the top only; the cue is 0 once the dive has begun.
  describe('scroll cue (U9)', () => {
    it('at the top the cue is .8; on the open plateau (1120) it is 0', () => {
      const { ui, at } = setup()
      at(0)
      expect(ui.setCue).toHaveBeenLastCalledWith(0.8)
      at(1120)
      expect(ui.setCue).toHaveBeenLastCalledWith(0)
    })
  })

  it('16. the controller never boots the OS when the scene is ready (the lid does)', () => {
    const { os, ctrl, at } = setup()
    at(0)
    at(1000)
    ctrl.enter()
    at(1000)
    expect(os.boot).not.toHaveBeenCalled()
  })

  // Round 3 Phase R3-2 (plan-r3 V6, V7, I9, I10): parking freezes the laptop while the résumé view is
  // shown; unparking re-measures and jumps to the place the visitor left.
  describe('park and unpark (V6, V7, I9, I10)', () => {
    it('P1: park() at 1120 returns open, cancels the glide and sets store.parked; while parked, update() does not measure and writes no cue or live flip', () => {
      const { ctrl, glide, ui, os, at, getTrackRect } = setup()
      at(1120)
      expect(ctrl.park()).toBe('open')
      expect(ctrl.store.get().parked).toBe(true)
      expect(glide.cancel).toHaveBeenCalled()

      getTrackRect.mockClear()
      const cues = ui.setCue.mock.calls.length
      const lives = os.setLive.mock.calls.length
      at(300)
      expect(getTrackRect).not.toHaveBeenCalled()
      expect(ui.setCue.mock.calls.length).toBe(cues)
      expect(os.setLive.mock.calls.length).toBe(lives)
      expect(ctrl.store.get().parked).toBe(true)
    })

    it('P2: park() at 300 returns desk, and at 500 returns open (the dive fraction decides, z ≥ .5 is open)', () => {
      const a = setup()
      a.at(300)
      expect(a.ctrl.park()).toBe('desk')

      const b = setup()
      b.at(500)
      expect(b.ctrl.park()).toBe('open')
    })

    it('P3: a glide in flight from enter() is parked at its end: park() returns open', () => {
      const { ctrl, glide, at } = setup()
      at(100)
      ctrl.enter()
      glide.active = true
      expect(ctrl.park()).toBe('open')
    })

    it('P4: park() at 1120, the stage shrinks to 600/1320, then unpark() jumps to the new open end (720), stays inside, and a later at(720) makes no further jump', () => {
      const { env, ctrl, glide, at, phase } = setup()
      at(1120)
      ctrl.park()
      env.stageH = 600
      env.trackH = 1320
      expect(ctrl.unpark()).toBe('open')
      expect(glide.jump).toHaveBeenLastCalledWith(720)
      expect(phase()).toBe('inside')
      glide.jump.mockClear()
      at(720)
      expect(glide.jump).not.toHaveBeenCalled()
      expect(phase()).toBe('inside')
    })

    it('P5: unpark("desk") jumps to the track top and the phase is desk', () => {
      const { ctrl, glide, at, phase } = setup()
      at(1120)
      ctrl.park()
      glide.jump.mockClear()
      expect(ctrl.unpark('desk')).toBe('desk')
      expect(glide.jump).toHaveBeenLastCalledWith(0)
      expect(phase()).toBe('desk')
    })

    it('P6: unavailable: park() returns desk, and unpark("open") still jumps to the track top and returns desk', () => {
      const { env, ctrl, glide, at } = setup()
      env.status = 'unavailable'
      at(0)
      expect(ctrl.park()).toBe('desk')
      glide.jump.mockClear()
      expect(ctrl.unpark('open')).toBe('desk')
      expect(glide.jump).toHaveBeenLastCalledWith(0)
    })

    it('P7: park("desk") with an explicit place does not measure the track', () => {
      const { ctrl, at, getTrackRect } = setup()
      at(1120)
      getTrackRect.mockClear()
      expect(ctrl.park('desk')).toBe('desk')
      expect(getTrackRect).not.toHaveBeenCalled()
    })

    it('P8: parked, exit() makes no glide, sets returnTo to desk, and unpark() then lands at the desk', () => {
      const { ctrl, glide, at } = setup()
      at(1120)
      ctrl.park()
      glide.to.mockClear()
      ctrl.exit()
      expect(glide.to).not.toHaveBeenCalled()
      expect(ctrl.returnTo).toBe('desk')
      glide.jump.mockClear()
      ctrl.unpark()
      expect(glide.jump).toHaveBeenLastCalledWith(0)
    })

    // A Back during the résumé fade-in (the laptop was never hidden): it comes back where it was.
    // unpark('here') returns the end the page is at or settling to, for the views' focus fallback.
    it('P10: unpark("here") after park() on the plateau jumps back to the exact parked s, stays open and returns open', () => {
      const { ctrl, glide, at, phase } = setup()
      at(1060)
      ctrl.park()
      glide.jump.mockClear()
      glide.to.mockClear()
      expect(ctrl.unpark('here')).toBe('open')
      expect(glide.jump).toHaveBeenLastCalledWith(1060)
      expect(glide.to).not.toHaveBeenCalled()
      expect(phase()).toBe('inside')
    })

    it('P11: unpark("here") mid-dive (z .3) restores that s instead of jumping to the desk, then settles it by glide (never half-open) and returns that end, desk', () => {
      const { ctrl, glide, at } = setup()
      at(300)
      expect(ctrl.park()).toBe('desk')
      glide.jump.mockClear()
      expect(ctrl.unpark('here')).toBe('desk')
      expect(glide.jump).toHaveBeenLastCalledWith(300)
      expect(glide.jump).not.toHaveBeenCalledWith(0)
      expect(glide.to).toHaveBeenLastCalledWith(0)
    })

    it('P11b: unpark("here") at z .7 settles toward the open laptop and returns open; at the desk it returns desk', () => {
      const a = setup()
      a.at(700)
      a.ctrl.park()
      expect(a.ctrl.unpark('here')).toBe('open')
      expect(a.glide.jump).toHaveBeenLastCalledWith(700)
      expect(a.glide.to).toHaveBeenLastCalledWith(1120)

      const b = setup()
      b.at(0)
      b.ctrl.park()
      b.glide.to.mockClear()
      expect(b.ctrl.unpark('here')).toBe('desk')
      expect(b.glide.to).not.toHaveBeenCalled()
    })

    it('P12: unpark("here") with nothing measured at park (an explicit place, or a glide in flight) uses returnTo', () => {
      const a = setup()
      a.at(1120)
      a.ctrl.park('desk')
      a.glide.jump.mockClear()
      expect(a.ctrl.unpark('here')).toBe('desk')
      expect(a.glide.jump).toHaveBeenLastCalledWith(0)

      const b = setup()
      b.at(100)
      b.ctrl.enter()
      b.glide.active = true
      b.ctrl.park()
      b.glide.active = false
      b.glide.jump.mockClear()
      expect(b.ctrl.unpark('here')).toBe('open')
      expect(b.glide.jump).toHaveBeenLastCalledWith(1120)
    })

    it('P9: parked, settle() and enter() make no glide', () => {
      const { ctrl, glide, at } = setup()
      at(400)
      ctrl.park()
      glide.to.mockClear()
      ctrl.settle({ dir: 1, travel: 100 })
      ctrl.enter()
      expect(glide.to).not.toHaveBeenCalled()
    })
  })

  // plan-r3 V17: the scene loads on the first unpark, so "Open the laptop" from a deep-linked résumé
  // unparks while it is still loading. A loading scene shows z 0 everywhere, so landing at R would
  // show a blank stage at the document end and then snap open with no dive.
  describe('unpark while the scene is loading (V17)', () => {
    it('L1: unpark("open") while loading lands at the desk (0), returns desk and makes no glide', () => {
      const { env, ctrl, glide, at, phase } = setup()
      env.status = 'loading'
      at(0)
      ctrl.park('desk')
      glide.jump.mockClear()
      expect(ctrl.unpark('open')).toBe('desk')
      expect(glide.jump).toHaveBeenLastCalledWith(0)
      expect(glide.jump).not.toHaveBeenCalledWith(1120)
      expect(glide.to).not.toHaveBeenCalled()
      expect(phase()).toBe('desk')
    })

    it('L2: the first update once the scene is ready glides to the open laptop (R 1120), once', () => {
      const { env, ctrl, glide, at } = setup()
      env.status = 'loading'
      at(0)
      ctrl.park('desk')
      ctrl.unpark('open')
      at(0)
      expect(glide.to).not.toHaveBeenCalled()
      env.status = 'ready'
      at(0)
      expect(glide.to).toHaveBeenCalledTimes(1)
      expect(glide.to).toHaveBeenLastCalledWith(1120)
      at(0)
      expect(glide.to).toHaveBeenCalledTimes(1)
    })

    it('L3: a user scroll while loading cancels the pending open: on ready nothing glides open', () => {
      const { env, ctrl, glide, at } = setup()
      env.status = 'loading'
      at(0)
      ctrl.park('desk')
      ctrl.unpark('open')
      at(80)
      at(0)
      env.status = 'ready'
      at(0)
      expect(glide.to).not.toHaveBeenCalled()
    })

    it('L4: park() or exit() while loading cancels the pending open', () => {
      const a = setup()
      a.env.status = 'loading'
      a.at(0)
      a.ctrl.park('desk')
      a.ctrl.unpark('open')
      a.ctrl.exit()
      a.env.status = 'ready'
      a.at(0)
      expect(a.glide.to).not.toHaveBeenCalled()

      const b = setup()
      b.env.status = 'loading'
      b.at(0)
      b.ctrl.park('desk')
      b.ctrl.unpark('open')
      b.ctrl.park('desk')
      b.ctrl.unpark('desk')
      b.env.status = 'ready'
      b.at(0)
      expect(b.glide.to).not.toHaveBeenCalled()
    })

    it('L3b: a scroll off the desk in the same update the scene turns ready cancels the pending open; the mid-dive settle applies instead (80 → desk)', () => {
      const { env, ctrl, glide, at } = setup()
      env.status = 'loading'
      at(0)
      ctrl.park('desk')
      ctrl.unpark('open')
      env.status = 'ready'
      at(80)
      expect(glide.to).not.toHaveBeenCalledWith(1120)
      expect(glide.to).toHaveBeenCalledTimes(1)
      expect(glide.to).toHaveBeenLastCalledWith(0)
    })

    it('L4b: the scene turning unavailable drops the pending open (nothing opens on a later ready)', () => {
      const { env, ctrl, glide, at } = setup()
      env.status = 'loading'
      at(0)
      ctrl.park('desk')
      ctrl.unpark('open')
      env.status = 'unavailable'
      at(0)
      env.status = 'loading'
      at(0)
      env.status = 'ready'
      at(0)
      expect(glide.to).not.toHaveBeenCalled()
    })

    it('L5: unpark("open") once the scene is ready still jumps straight to R (no pending)', () => {
      const { ctrl, glide, at, phase } = setup()
      at(0)
      ctrl.park('desk')
      expect(ctrl.unpark('open')).toBe('open')
      expect(glide.jump).toHaveBeenLastCalledWith(1120)
      expect(phase()).toBe('inside')
      expect(glide.to).not.toHaveBeenCalled()
    })

    it('L6: unavailable still lands at the desk with no glide later (nothing pending)', () => {
      const { env, ctrl, glide, at } = setup()
      env.status = 'unavailable'
      at(0)
      ctrl.park('desk')
      expect(ctrl.unpark('open')).toBe('desk')
      at(0)
      expect(glide.to).not.toHaveBeenCalled()
    })
  })

  // No idle settle runs while the scene loads (settle needs a ready scene), so a rest mid-dive then
  // would be left half-open when the laptop appears. The loading → ready update settles it (dir 0:
  // the nearer end).
  describe('loading → ready settles a mid-dive page', () => {
    it('R1: mid-dive at 400 while loading, then ready: glides to the desk (0), once', () => {
      const { env, glide, at } = setup()
      env.status = 'loading'
      at(400)
      env.status = 'ready'
      at(400)
      expect(glide.to).toHaveBeenCalledTimes(1)
      expect(glide.to).toHaveBeenLastCalledWith(0)
      at(400)
      expect(glide.to).toHaveBeenCalledTimes(1)
    })

    it('R2: mid-dive at 700 while loading, then ready: glides to the open laptop (1120)', () => {
      const { env, glide, at } = setup()
      env.status = 'loading'
      at(700)
      env.status = 'ready'
      at(700)
      expect(glide.to).toHaveBeenLastCalledWith(1120)
    })

    it('R3: no settle without a loading→ready transition, and none at the desk or on the plateau when it happens', () => {
      for (const y of [0, 1060]) {
        const f = setup()
        f.env.status = 'loading'
        f.at(y)
        f.env.status = 'ready'
        f.at(y)
        expect(f.glide.to).not.toHaveBeenCalled()
      }
      const g = setup()
      g.at(400)
      g.at(400)
      expect(g.glide.to).not.toHaveBeenCalled()
    })
  })
})
