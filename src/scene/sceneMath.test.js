// Phase 7 TEST LIST 1–11: scene/sceneMath.test.js. Pure functions ported from the frame loop
// (L1239–1262) and the drag handler (L1036–1054). Assumed shapes are listed in the test report.
import { describe, it, expect, vi } from 'vitest'
import {
  lidT,
  hingeAngle,
  camE,
  lidBoot,
  widenSize,
  camFov,
  camDistance,
  widePose,
  cameraPose,
  stepKey,
  stepSnow,
  ledPower,
  ledDrive,
  screenLightTarget,
  tagAngle,
  stepTween,
  dragYaw,
  stepParallax,
  perceptualE,
  fogFor,
  holderAlpha,
  vignetteAlpha,
  approach,
  wiggle,
  stepSteam,
  peekTarget,
  peekLatch,
  glowColor,
  createTweenList,
} from './sceneMath.js'
import * as SM from './sceneMath.js'
import { ss, easeQuad } from '../core/math.js'
import { OS_W, OS_H } from '../core/constants.js'

const DEG = Math.PI / 180

describe('scene/sceneMath', () => {
  it('1. lidT(0)=0, lidT(.45)=1, and lidT is ss(0,.45,z)', () => {
    expect(lidT(0)).toBe(0)
    expect(lidT(0.45)).toBeCloseTo(1, 12)
    expect(lidT(0.225)).toBeCloseTo(0.5, 12)
    expect(lidT(0.2)).toBeCloseTo(ss(0, 0.45, 0.2), 12)
  })

  it('1. hingeAngle(0)=π/2 and hingeAngle(1)=-10° in radians', () => {
    expect(hingeAngle(0)).toBeCloseTo(Math.PI / 2, 12)
    expect(hingeAngle(1)).toBeCloseTo(-10 * DEG, 12)
    expect(hingeAngle(0.5)).toBeCloseTo(Math.PI / 2 + (-10 * DEG - Math.PI / 2) * 0.5, 12)
  })

  it('2. lidBoot: a lid opening from closed boots the OS only from standby or off', () => {
    expect(lidBoot(0.8, true, 'standby')).toEqual({ wasClosed: false, boot: true })
    expect(lidBoot(0.8, false, 'standby')).toEqual({ wasClosed: false, boot: false })
    expect(lidBoot(0.05, false, 'on')).toEqual({ wasClosed: true, boot: false })
    expect(lidBoot(0.8, true, 'on')).toEqual({ wasClosed: false, boot: false })
  })

  // Round 2 Phase 3 (R12): the holder widens over [.97, 1] with no .994 factor, so widenSize(1) is the flat layout.
  it('3. widenSize: no widening below .97; widenSize(1, 1600, 900) = {1200, 675} (k = min(w/900, h/675), no .994)', () => {
    expect(widenSize(0.96, 1600, 900)).toEqual({ w: OS_W, h: OS_H })
    expect(widenSize(0.5, 1600, 900)).toEqual({ w: OS_W, h: OS_H })
    const k = Math.min(1600 / OS_W, 900 / OS_H)
    expect(k).toBeCloseTo(1.3333, 4)
    const full = widenSize(1, 1600, 900)
    expect(full.w).toBeCloseTo(1600 / k, 6)
    expect(full.h).toBeCloseTo(900 / k, 6)
    expect(full.w).toBeCloseTo(1200, 6)
    expect(full.h).toBeCloseTo(675, 6)
  })

  it('3. widenSize at z=.985 is halfway through the widen (g = ss(.97, 1, .985) = .5)', () => {
    const mid = widenSize(0.985, 1600, 900)
    expect(mid.w).toBeCloseTo(OS_W + (1200 - OS_W) * 0.5, 4)
    expect(mid.h).toBeCloseTo(OS_H, 4)
  })

  it('camE(z) = ss(.2,1,z): 0 at .2, 1 at 1, and ss in between', () => {
    expect(camE(0.2)).toBe(0)
    expect(camE(1)).toBe(1)
    expect(camE(0.6)).toBeCloseTo(ss(0.2, 1, 0.6), 12)
  })

  it('4. camFov: 46 below aspect 1.05 (narrow), 35 otherwise', () => {
    expect(camFov(1.04)).toBe(46)
    expect(camFov(1.06)).toBe(35)
    expect(camFov(1.05)).toBe(35)
  })

  it('4. camDistance(35, 16/9) equals max(1.95/2/tv, 2.6/2/(tv*aspect))', () => {
    const aspect = 16 / 9
    const tv = Math.tan((35 * DEG) / 2)
    expect(camDistance(35, aspect)).toBeCloseTo(Math.max(1.95 / 2 / tv, 2.6 / 2 / (tv * aspect)), 12)
  })

  it('4. widePose: narrow pose below aspect 1.05, desktop pose otherwise (both with k = 1 when the view is wide enough)', () => {
    expect(widePose(1.04)).toMatchObject({ wp: [0.5, 4.4, 13.8], wl: [0.1, 1.3, 0], k: 1 })
    expect(widePose(1.5)).toMatchObject({ wp: [1.4, 3.6, 10.2], wl: [0.2, 1.0, 0], k: 1 })
  })

  it('5. cameraPose with e=0 and sp.x=.5 adds .55 to pos.x when not reduced, and nothing when reduced', () => {
    const base = { e: 0, aspect: 1.5, sp: { x: 0.5, y: 0 }, aPos: { x: 0, y: 1.12, z: 0 }, aN: { x: 0, y: 0, z: 1 }, d: 3 }
    expect(cameraPose({ ...base, reduce: false }).pos.x).toBeCloseTo(1.4 + 0.55, 12)
    expect(cameraPose({ ...base, reduce: true }).pos.x).toBeCloseTo(1.4, 12)
  })

  it('5. cameraPose with e=1 puts the camera at aPos + aN*d', () => {
    const { pos } = cameraPose({
      e: 1,
      aspect: 1.5,
      sp: { x: 0.5, y: 0.3 },
      aPos: { x: 0, y: 1.12, z: 0 },
      aN: { x: 0, y: 0, z: 1 },
      d: 3,
      reduce: false,
    })
    expect(pos.x).toBeCloseTo(0, 12)
    expect(pos.y).toBeCloseTo(1.12, 12)
    expect(pos.z).toBeCloseTo(3, 12)
  })

  it('6. stepKey(1, .1) gives p=.3 and y=.19-.035*.6; stepKey(.05, .1) gives p=0 and y=.19', () => {
    const a = stepKey(1, 0.1)
    expect(a.p).toBeCloseTo(0.3, 12)
    expect(a.y).toBeCloseTo(0.19 - 0.035 * 0.6, 12)
    const b = stepKey(0.05, 0.1)
    expect(b.p).toBe(0)
    expect(b.y).toBeCloseTo(0.19, 12)
  })

  it('7. ledPower: standby blinks between 0xFFAA22 and 0x221100 every 600 ms; on=0x2BE070; off=0', () => {
    expect(ledPower('standby', 0)).toBe(0xffaa22)
    expect(ledPower('standby', 700)).toBe(0x221100)
    expect(ledPower('on', 0)).toBe(0x2be070)
    expect(ledPower('off', 0)).toBe(0)
  })

  it('7. ledDrive: 0 when idle; 0x220800 at t=0 when busy; 0xFF5533 at t=80', () => {
    expect(ledDrive(0, 'on', 0)).toBe(0)
    expect(ledDrive(1, 'on', 0)).toBe(0x220800)
    expect(ledDrive(1, 'on', 80)).toBe(0xff5533)
  })

  it('8. screenLightTarget: on at lidT 1 = 1.1; boot at lidT .5 = .3; off = 0', () => {
    expect(screenLightTarget('on', 1)).toBeCloseTo(1.1, 12)
    expect(screenLightTarget('boot', 0.5)).toBeCloseTo(0.3, 12)
    expect(screenLightTarget('off', 1)).toBe(0)
  })

  it('9. tagAngle(t, .7, reduce=true) is 0; not reduced it is sin(t*3.1)*(swing+.03)', () => {
    expect(tagAngle(5, 0.7, true)).toBe(0)
    expect(tagAngle(1, 0.7, false)).toBeCloseTo(Math.sin(3.1) * (0.7 + 0.03), 12)
  })

  it('10. stepTween reaches the target at t >= dur, is easeQuad(.5)=.5 half-way, and calls done once', () => {
    expect(easeQuad(0.5)).toBe(0.5)
    const done = vi.fn()
    const tw = {
      t: 0,
      dur: 1,
      obj: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      fp: { x: 0, y: 0, z: 0 },
      tp: { x: 10, y: 0, z: 0 },
      fr: { x: 0, y: 0, z: 0 },
      tr: { x: 0, y: 0, z: 0 },
      done,
    }
    stepTween(tw, 0.5)
    expect(tw.obj.position.x).toBeCloseTo(5, 12)
    expect(done).not.toHaveBeenCalled()
    stepTween(tw, 0.6)
    expect(tw.obj.position.x).toBeCloseTo(10, 12)
    expect(done).toHaveBeenCalledTimes(1)
    stepTween(tw, 0.6)
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('11. stepSnow: falls by v*dt, wraps to 3.65 below 1.75, and boost multiplies the speed by 3.5', () => {
    expect(stepSnow(2, 0.5, 0.1, 1)).toBeCloseTo(1.95, 12)
    expect(stepSnow(2, 0.5, 0.1, 3.5)).toBeCloseTo(2 - 0.5 * 0.1 * 3.5, 12)
    expect(stepSnow(1.76, 0.5, 0.1, 1)).toBeCloseTo(3.65, 12)
  })

  it('drag yaw (L1039) is clamped to ±.4 at .005 rad per px', () => {
    expect(dragYaw(0, 40)).toBeCloseTo(0.2, 12)
    expect(dragYaw(0, 200)).toBeCloseTo(0.4, 12)
    expect(dragYaw(0, -200)).toBeCloseTo(-0.4, 12)
    expect(dragYaw(0.3, 100)).toBeCloseTo(0.4, 12)
  })

  it('parallax damping (L1243) moves .08 of the remaining distance per frame', () => {
    expect(stepParallax(0, 1)).toBeCloseTo(0.08, 12)
    expect(stepParallax(0.5, -0.5)).toBeCloseTo(0.5 + (-1) * 0.08, 12)
  })

  // Round 2 Phase 3 TEST LIST 1 (R11, R12, phone wide pull-back, fog, holder crossfade).
  it('R11 perceptualE: 0 at e=0, 1 at e=1, ≈.784 at e=.5 for (11.2, 3.09), strictly increasing over 11 samples', () => {
    expect(perceptualE(0, 11.2, 3.09)).toBeCloseTo(0, 12)
    expect(perceptualE(1, 11.2, 3.09)).toBeCloseTo(1, 12)
    expect(perceptualE(0.5, 11.2, 3.09)).toBeCloseTo(0.784, 3)
    let prev = -Infinity
    for (let i = 0; i <= 10; i++) {
      const v = perceptualE(i / 10, 11.2, 3.09)
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
  })

  it('R11 perceptualE makes the apparent size grow linearly: d1 / (d0 - (d0 - d1)·p) = d1/d0 + (1 - d1/d0)·e', () => {
    const d0 = 11.2
    const d1 = 3.09
    for (const e of [0.25, 0.5, 0.75]) {
      const p = perceptualE(e, d0, d1)
      expect(d1 / (d0 - (d0 - d1) * p)).toBeCloseTo(d1 / d0 + (1 - d1 / d0) * e, 4)
    }
  })

  it('R11 perceptualE(.3, 3, 3) = .3 (no division by zero when the distances match)', () => {
    expect(perceptualE(0.3, 3, 3)).toBeCloseTo(0.3, 12)
  })

  it('R11 cameraPose at e=.5 places pos and look at the perceptual parameter k = perceptualE(e, |A - aPos|, d)', () => {
    const e = 0.5
    const aspect = 1.5
    const sp = { x: 0.5, y: 0.3 }
    const aPos = { x: 0, y: 1.12, z: 0 }
    const aN = { x: 0, y: 0, z: 1 }
    const d = 3
    const wp = [1.4, 3.6, 10.2]
    const wl = [0.2, 1.0, 0]
    // A: the wide position with parallax (parallax factor 1 - e, as in cameraPose); B: the end position.
    const A = { x: wp[0] + sp.x * 1.1 * (1 - e), y: wp[1] - sp.y * 0.7 * (1 - e), z: wp[2] }
    const B = { x: aPos.x + aN.x * d, y: aPos.y + aN.y * d, z: aPos.z + aN.z * d }
    const d0 = Math.hypot(A.x - aPos.x, A.y - aPos.y, A.z - aPos.z)
    const k = perceptualE(e, d0, d)
    expect(Math.abs(k - e)).toBeGreaterThan(0.1)
    const { pos, look } = cameraPose({ e, aspect, sp, aPos, aN, d, reduce: false })
    expect(pos.x).toBeCloseTo(A.x + (B.x - A.x) * k, 9)
    expect(pos.y).toBeCloseTo(A.y + (B.y - A.y) * k, 9)
    expect(pos.z).toBeCloseTo(A.z + (B.z - A.z) * k, 9)
    expect(look.x).toBeCloseTo(wl[0] + (aPos.x - wl[0]) * k, 9)
    expect(look.y).toBeCloseTo(wl[1] + (aPos.y - wl[1]) * k, 9)
    expect(look.z).toBeCloseTo(wl[2] + (aPos.z - wl[2]) * k, 9)
  })

  // Round 3 (lead decision 3): the pull-back fits the near desk corners, not a 3.6 half-width, and
  // the look target drops .6 per unit of pull-back so the room is centred rather than the wall.
  it('R phone pull-back: widePose(390/844) has k ≈ 1.47, wp ≈ [.69, 5.57, 20.28] and the look target lowered to y ≈ 1.02', () => {
    const p = widePose(390 / 844)
    expect(p.k).toBeCloseTo(1.47, 2)
    expect(p.wp[0]).toBeCloseTo(0.69, 2)
    expect(p.wp[1]).toBeCloseTo(5.57, 2)
    expect(p.wp[2]).toBeCloseTo(20.28, 2)
    expect(p.wl[0]).toBe(0.1)
    expect(p.wl[1]).toBeCloseTo(1.3 - 0.6 * (p.k - 1), 9)
    expect(p.wl[2]).toBe(0)
  })

  it('R phone pull-back: widePose(.75) is the base phone pose with k = 1', () => {
    expect(widePose(0.75)).toMatchObject({ wp: [0.5, 4.4, 13.8], wl: [0.1, 1.3, 0], k: 1 })
  })

  it('R phone pull-back: the phone wide shot covers at least 3.6 units of half-width at the look distance', () => {
    const aspect = 390 / 844
    const { wp, wl } = widePose(aspect)
    const dist = Math.hypot(wp[0] - wl[0], wp[1] - wl[1], wp[2] - wl[2])
    const halfW = Math.tan((camFov(aspect) * DEG) / 2) * aspect * dist
    expect(halfW).toBeGreaterThanOrEqual(3.6 - 1e-9)
  })

  it('R fogFor(k) scales the fog with the pull-back: fogFor(1) = {16, 34}, fogFor(1.3) = {20.8, 44.2}', () => {
    expect(fogFor(1)).toEqual({ near: 16, far: 34 })
    const f = fogFor(1.3)
    expect(f.near).toBeCloseTo(20.8, 9)
    expect(f.far).toBeCloseTo(44.2, 9)
  })

  it('R12 widenSize(1, w, h) equals the flat layout (w/k, h/k) with k = min(w/900, h/675)', () => {
    for (const [w, h] of [[1440, 900], [2560, 1080], [1024, 1366]]) {
      const k = Math.min(w / OS_W, h / OS_H)
      const s = widenSize(1, w, h)
      expect(s.w).toBeCloseTo(w / k, 6)
      expect(s.h).toBeCloseTo(h / k, 6)
    }
  })

  it('R12 widenSize numbers: (.96,1440,900)={900,675}; (1,1440,900)={1080,675}; (1,2560,1080)≈{1600,675}; (1,1024,1366)≈{900,1200.6}', () => {
    expect(widenSize(0.96, 1440, 900)).toEqual({ w: OS_W, h: OS_H })
    const a = widenSize(1, 1440, 900)
    expect(a.w).toBeCloseTo(1080, 6)
    expect(a.h).toBeCloseTo(675, 6)
    const b = widenSize(1, 2560, 1080)
    expect(b.w).toBeCloseTo(1600, 6)
    expect(b.h).toBeCloseTo(675, 6)
    const c = widenSize(1, 1024, 1366)
    expect(c.w).toBeCloseTo(900, 6)
    expect(c.h).toBeCloseTo(1200.6, 1)
  })

  it('vignetteAlpha: 1 on the desk, 0 from the start of the widen (.97), so the flat swap shows no pop', () => {
    expect(vignetteAlpha(0)).toBe(1)
    expect(vignetteAlpha(0.86)).toBe(1)
    expect(vignetteAlpha(0.97)).toBe(0)
    expect(vignetteAlpha(1)).toBe(0)
  })

  it('R crossfade holderAlpha: 0 at .42, 1 at .6, monotonic between', () => {
    expect(holderAlpha(0.42)).toBe(0)
    expect(holderAlpha(0.6)).toBe(1)
    expect(holderAlpha(0.51)).toBeCloseTo(0.5, 9)
    let prev = -1
    for (let i = 0; i <= 18; i++) {
      const v = holderAlpha(0.42 + i * 0.01)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  // Round 3 (R12 revised): the holder is never clipped. The screen grows out of the bezel to the
  // full view over [.97, 1], so there is no clip-path helper left to call.
  it('R12 revised: sceneMath no longer exports screenClip', () => {
    expect(Object.keys(SM)).not.toContain('screenClip')
    expect('screenClip' in SM).toBe(false)
  })

  // Round 3 TEST LIST 3 (phone wide shot): the four top corners of the desk slab (7 × 3.2, top at
  // y 0; createScene.js B(7, 0.22, 3.2) at y −0.11) must project inside the wide shot's frustum with
  // at least a 2 % margin on each side. The look-at basis is built by hand (no three.js).
  describe('phone wide shot contains the whole desk', () => {
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
    const unit = (a) => {
      const l = Math.hypot(a[0], a[1], a[2])
      return [a[0] / l, a[1] / l, a[2] / l]
    }
    const DESK_TOP_CORNERS = [
      [-3.5, 0, -1.6],
      [3.5, 0, -1.6],
      [-3.5, 0, 1.6],
      [3.5, 0, 1.6],
    ]
    const MARGIN = 0.98

    for (const [w, h] of [
      [390, 844],
      [360, 800],
      [768, 1024],
    ]) {
      it(`every desk corner is inside the frustum by at least 2 % at ${w}/${h}`, () => {
        const aspect = w / h
        const { wp, wl } = widePose(aspect)
        const tv = Math.tan((camFov(aspect) * DEG) / 2)
        const f = unit(sub(wl, wp))
        const r = unit(cross(f, [0, 1, 0]))
        const u = cross(r, f)
        for (const corner of DESK_TOP_CORNERS) {
          const p = sub(corner, wp)
          const depth = dot(p, f)
          const nx = dot(p, r) / depth / (tv * aspect)
          const ny = dot(p, u) / depth / tv
          const tag = `corner ${corner.join(',')} at ${w}/${h}`
          expect(depth, tag).toBeGreaterThan(0)
          expect(Math.abs(nx), `${tag} horizontal ndc ${nx}`).toBeLessThanOrEqual(MARGIN)
          expect(Math.abs(ny), `${tag} vertical ndc ${ny}`).toBeLessThanOrEqual(MARGIN)
        }
      })
    }

    // Very narrow aspects (the pull-back bisection runs against the cap k = 4): the four desk-top
    // corners must still project within NDC ±0.951 (WIDE_FIT_NDC), using the same projection.
    for (const aspect of [0.15, 0.1]) {
      it(`every desk corner stays within NDC ±0.951 at very narrow aspect ${aspect}`, () => {
        const { wp, wl } = widePose(aspect)
        const tv = Math.tan((camFov(aspect) * DEG) / 2)
        const f = unit(sub(wl, wp))
        const r = unit(cross(f, [0, 1, 0]))
        const u = cross(r, f)
        for (const corner of DESK_TOP_CORNERS) {
          const p = sub(corner, wp)
          const depth = dot(p, f)
          const nx = dot(p, r) / depth / (tv * aspect)
          const ny = dot(p, u) / depth / tv
          const tag = `corner ${corner.join(',')} at aspect ${aspect}`
          expect(depth, tag).toBeGreaterThan(0)
          expect(Math.abs(nx), `${tag} horizontal ndc ${nx}`).toBeLessThanOrEqual(0.951)
          expect(Math.abs(ny), `${tag} vertical ndc ${ny}`).toBeLessThanOrEqual(0.951)
        }
      })
    }
  })

  // Round 3 TEST LIST 8 (R11): the measured apparent size (1 / distance from aPos) grows linearly
  // between 1/d0 and 1/d1 within 2 %. sp is zero so the wide position does not move with e.
  it('R11 cameraPose: 1 / |pos - aPos| is within 2 % of the linear interpolation of 1/d0 and 1/d1 at e = .25/.5/.75 (aspect 1.6)', () => {
    const aspect = 1.6
    const aPos = { x: 0, y: 1.12, z: 0 }
    const aN = { x: 0, y: 0, z: 1 }
    const d = camDistance(camFov(aspect), aspect)
    const { wp } = widePose(aspect)
    const d0 = Math.hypot(wp[0] - aPos.x, wp[1] - aPos.y, wp[2] - aPos.z)
    for (const e of [0.25, 0.5, 0.75]) {
      const { pos } = cameraPose({ e, aspect, sp: { x: 0, y: 0 }, aPos, aN, d, reduce: false })
      const apparent = 1 / Math.hypot(pos.x - aPos.x, pos.y - aPos.y, pos.z - aPos.z)
      const linear = 1 / d0 + (1 / d - 1 / d0) * e
      expect(Math.abs(apparent - linear) / linear, `e=${e}`).toBeLessThanOrEqual(0.02)
    }
  })

  // Round 2 Phase 4 TEST LIST 4 (hover, lamp ease, steam, lid peek).
  it('approach(cur, target, dt, rate) = target + (cur - target) · exp(-rate · dt)', () => {
    expect(approach(0, 1, 0, 10)).toBe(0)
    expect(approach(0, 1, 1, 10)).toBeCloseTo(1, 4)
    expect(approach(1, 0, 0.1, 6)).toBeCloseTo(Math.exp(-0.6), 12)
  })

  it('wiggle(t, amp) is amp · sin(t · 0.014): zero at t = 0 and never larger than amp', () => {
    expect(wiggle(0, 0.06)).toBe(0)
    for (const t of [1, 250, 1234, 5000, 99999]) {
      expect(Math.abs(wiggle(t, 0.06))).toBeLessThanOrEqual(0.06)
    }
  })

  it('stepSteam(y, v, dt) wraps from 0.85 back to 0.45 and otherwise rises', () => {
    expect(stepSteam(0.84, 1, 0.1)).toBeCloseTo(0.45, 10)
    const rising = stepSteam(0.5, 1, 0.1)
    expect(rising).toBeGreaterThan(0.5)
    expect(rising).toBeLessThan(0.85)
  })

  it('peekTarget is 7 degrees (in radians) only while hovered, close (z < 0.02) and not reduced', () => {
    const PEEK = 7 * (Math.PI / 180)
    expect(peekTarget({ hovered: true, z: 0, reduce: false })).toBeCloseTo(PEEK, 10)
    expect(peekTarget({ hovered: true, z: 0.019, reduce: false })).toBeCloseTo(PEEK, 10)
    expect(peekTarget({ hovered: true, z: 0.02, reduce: false })).toBe(0)
    expect(peekTarget({ hovered: true, z: 0.5, reduce: false })).toBe(0)
    expect(peekTarget({ hovered: false, z: 0, reduce: false })).toBe(0)
    expect(peekTarget({ hovered: true, z: 0, reduce: true })).toBe(0)
  })

  // Round 2 Phase 4 (R14): one object's tweens play leg by leg, each from where the last one left it.
  it('createTweenList queues a second tween on a busy object and starts it from the first one\'s end', () => {
    const obj = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    const done = []
    const list = createTweenList()
    list.tween(obj, { p: { x: 1, y: 0, z: 0 } }, 1, () => done.push('a'))
    list.tween(obj, { p: { x: 1, y: 2, z: 0 } }, 1, () => done.push('b'))
    expect(list.busy(obj)).toBe(true)
    list.step(0.5)
    expect(obj.position.y).toBe(0)
    list.step(0.5)
    expect(obj.position).toEqual({ x: 1, y: 0, z: 0 })
    expect(done).toEqual(['a'])
    list.step(1)
    expect(obj.position).toEqual({ x: 1, y: 2, z: 0 })
    expect(done).toEqual(['a', 'b'])
    expect(list.busy(obj)).toBe(false)
  })

  it('createTweenList runs tweens on different objects side by side, with durations from durFor', () => {
    const mk = () => ({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } })
    const a = mk()
    const b = mk()
    const list = createTweenList(() => 0.01)
    list.tween(a, { p: { x: 1, y: 0, z: 0 } }, 5)
    list.tween(b, { p: { x: 0, y: 0, z: 1 }, r: { x: 0, y: 1, z: 0 } }, 5)
    list.step(0.02)
    expect(a.position.x).toBe(1)
    expect(b.position.z).toBe(1)
    expect(b.rotation.y).toBe(1)
  })
})

// Round 2 Phase 4 decisions (hover glow and lid peek latch). API chosen:
//   glowColor(hex, k) -> [r, g, b] floats in 0..1: the channels of `hex` (0xRRGGBB) scaled by k.
//   peekLatch(prevPeeking, pickIsLid, pickIsLaptop) -> boolean: whether the lid stays peeked this frame.
//     Starts on a lid pick; holds while the pointer is on any laptop part (lid, keyboard, power
//     button); drops only when the pointer leaves the laptop. A base-first pick does not start it.
describe('scene/sceneMath hover glow and lid peek latch (round 2 phase 4 decisions)', () => {
  const chan = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => v / 255)

  it('glowColor keeps the hue: red 0xed1b2f scaled by 0.35 has r > g and r > b (not the fixed bluish 0x2e4d6b)', () => {
    const [r, g, b] = glowColor(0xed1b2f, 0.35)
    expect(r).toBeGreaterThan(g)
    expect(r).toBeGreaterThan(b)
  })

  it('glowColor is the colour channels times k, as 0..1 floats', () => {
    const got = glowColor(0xed1b2f, 0.35)
    const want = chan(0xed1b2f).map((c) => c * 0.35)
    got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 10))
  })

  it('glowColor keeps a blue part blue: 0x2f6fb0 has its largest channel in b', () => {
    const [r, g, b] = glowColor(0x2f6fb0, 0.35)
    expect(b).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(g)
  })

  it('glowColor with k 0 is black', () => {
    expect(glowColor(0xed1b2f, 0)).toEqual([0, 0, 0])
  })

  it('peekLatch starts on a lid pick and holds while the pointer moves from the lid onto the keyboard or power button', () => {
    expect(peekLatch(false, true, false)).toBe(true)
    expect(peekLatch(true, false, true)).toBe(true)
    expect(peekLatch(true, true, false)).toBe(true)
  })

  it('peekLatch does not start on a base pick (keyboard first, no lid before it)', () => {
    expect(peekLatch(false, false, true)).toBe(false)
  })

  it('peekLatch eases back only when the pointer leaves the laptop entirely', () => {
    expect(peekLatch(true, false, false)).toBe(false)
    expect(peekLatch(false, false, false)).toBe(false)
  })
})
