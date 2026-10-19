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
} from './sceneMath.js'
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

  it('3. widenSize: no widening below ss(.86,1,z); full widening at z=1 uses k=min(w/900,h/675)*.994', () => {
    expect(widenSize(0.86, 1600, 900)).toEqual({ w: OS_W, h: OS_H })
    expect(widenSize(0.5, 1600, 900)).toEqual({ w: OS_W, h: OS_H })

    const k = Math.min(1600 / OS_W, 900 / OS_H) * 0.994
    expect(k).toBeCloseTo(1.3253, 4)
    const full = widenSize(1, 1600, 900)
    expect(full.w).toBeCloseTo(1600 / k, 6)
    expect(full.h).toBeCloseTo(900 / k, 6)
    expect(full.w).toBeCloseTo(1207.2, 0)
    expect(full.h).toBeCloseTo(679.1, 0)
  })

  it('3. widenSize at z=.9 is between the base size and the full size, with g=ss(.86,1,.9)', () => {
    const g = ss(0.86, 1, 0.9)
    const k = Math.min(1600 / OS_W, 900 / OS_H) * 0.994
    const mid = widenSize(0.9, 1600, 900)
    expect(mid.w).toBeGreaterThan(OS_W)
    expect(mid.w).toBeLessThan(1600 / k)
    expect(mid.w).toBeCloseTo(OS_W + (1600 / k - OS_W) * g, 6)
    expect(mid.h).toBeCloseTo(OS_H + (900 / k - OS_H) * g, 6)
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

  it('4. widePose: narrow pose below aspect 1.05, desktop pose otherwise', () => {
    expect(widePose(1.04)).toEqual({ wp: [0.5, 4.4, 13.8], wl: [0.1, 1.3, 0] })
    expect(widePose(1.5)).toEqual({ wp: [1.4, 3.6, 10.2], wl: [0.2, 1.0, 0] })
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
})
