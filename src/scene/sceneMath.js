// Pure maths from the scene frame loop (L1239–1262) and the pointer handlers (L1214–1219).
// Every value is the prototype's, including its per-frame (not dt-based) smoothing factors.
import { clamp, ss, easeQuad } from '../core/math.js'
import { OS_W, OS_H, CAM_NARROW_ASPECT } from '../core/constants.js'

const DEG = Math.PI / 180
const SCREEN_W = 2.6
const SCREEN_H = 1.95

/** Lid opening over the first 45 % of the timeline (L1241). */
export const lidT = (z) => ss(0, 0.45, z)

/** Hinge rotation: closed π/2, fully open −10° (L1241). */
export const hingeAngle = (t) => Math.PI / 2 + (-10 * DEG - Math.PI / 2) * t

/** Camera dolly progress (L1239). */
export const camE = (z) => ss(0.2, 1, z)

/** The OS boots once each time the lid passes 75 % after being nearly closed (L1242–1243). */
export function lidBoot(t, wasClosed, osState) {
  if (t < 0.1) wasClosed = true
  let boot = false
  if (t > 0.75 && wasClosed) {
    wasClosed = false
    boot = osState === 'standby' || osState === 'off'
  }
  return { wasClosed, boot }
}

/** The desktop widens to fill the stage over the last 14 % of the dive (L1245). */
export function widenSize(z, w, h) {
  const g = ss(0.86, 1, z)
  const k = Math.min(w / OS_W, h / OS_H) * 0.994
  return { w: OS_W + (w / k - OS_W) * g, h: OS_H + (h / k - OS_H) * g }
}

export const camFov = (aspect) => (aspect < CAM_NARROW_ASPECT ? 46 : 35)

/** Distance at which the 2.6×1.95 screen fills the view (L1247). */
export function camDistance(fov, aspect) {
  const tv = Math.tan((fov * DEG) / 2)
  return Math.max(SCREEN_H / 2 / tv, SCREEN_W / 2 / (tv * aspect))
}

/** The wide room shot and its look target (L1248). */
export function widePose(aspect) {
  return aspect < CAM_NARROW_ASPECT
    ? { wp: [0.5, 4.4, 13.8], wl: [0.1, 1.3, 0] }
    : { wp: [1.4, 3.6, 10.2], wl: [0.2, 1.0, 0] }
}

/** Camera position and look target between the wide shot (e=0) and the screen (e=1) (L1249–1253). */
export function cameraPose({ e, aspect, sp, aPos, aN, d, reduce }) {
  const { wp, wl } = widePose(aspect)
  const par = reduce ? 0 : 1 - e
  const ax = wp[0] + sp.x * 1.1 * par
  const ay = wp[1] - sp.y * 0.7 * par
  const az = wp[2]
  const bx = aPos.x + aN.x * d
  const by = aPos.y + aN.y * d
  const bz = aPos.z + aN.z * d
  return {
    pos: { x: ax + (bx - ax) * e, y: ay + (by - ay) * e, z: az + (bz - az) * e },
    look: { x: wl[0] + (aPos.x - wl[0]) * e, y: wl[1] + (aPos.y - wl[1]) * e, z: wl[2] + (aPos.z - wl[2]) * e },
  }
}

/** One frame of key depression (L1257). */
export function stepKey(p, dt, base = 0.19) {
  const np = Math.max(0, p - dt * 7)
  return { p: np, y: base - 0.035 * Math.min(1, np * 2) }
}

export const SNOW_TOP = 3.65
export const SNOW_BOTTOM = 1.75

/** One flake's fall; wraps to the top below the sill (L1258–1259). `boost` is the speed factor. */
export function stepSnow(y, v, dt, boost) {
  const ny = y - v * dt * boost
  return ny < SNOW_BOTTOM ? SNOW_TOP : ny
}

/** Power LED colour (L1260–1261). */
export function ledPower(state, t) {
  if (state === 'on' || state === 'boot') return 0x2be070
  if (state === 'standby') return (t / 600) % 2 < 1 ? 0xffaa22 : 0x221100
  return 0x000000
}

/** Drive LED colour (L1262). */
export function ledDrive(busy, state, t) {
  if (busy > 0 || state === 'boot') return ((t / 80) | 0) % 2 ? 0xff5533 : 0x220800
  return 0x000000
}

const SCREEN_LIGHT = { on: 1.1, boot: 0.6, standby: 0.25 }

/** Target intensity of the light the screen casts (L1263). */
export const screenLightTarget = (state, t) => (SCREEN_LIGHT[state] ?? 0) * t

/** Dog-tag swing angle (L1256). */
export const tagAngle = (t, swing, reduce) => (reduce ? 0 : Math.sin(t * 3.1) * (swing + 0.03))

/**
 * One frame of an object tween (L1254–1255, quad in-out). Writes position and rotation
 * component-wise, calls `done` once on completion and returns true when finished.
 */
export function stepTween(tw, dt) {
  if (tw.finished) return true
  tw.t += dt
  const k = Math.min(1, tw.t / tw.dur)
  const s = easeQuad(k)
  const { position: p, rotation: r } = tw.obj
  p.x = tw.fp.x + (tw.tp.x - tw.fp.x) * s
  p.y = tw.fp.y + (tw.tp.y - tw.fp.y) * s
  p.z = tw.fp.z + (tw.tp.z - tw.fp.z) * s
  r.x = tw.fr.x + (tw.tr.x - tw.fr.x) * s
  r.y = tw.fr.y + (tw.tr.y - tw.fr.y) * s
  r.z = tw.fr.z + (tw.tr.z - tw.fr.z) * s
  if (k < 1) return false
  tw.finished = true
  tw.done?.()
  return true
}

/** Drag on the desk rotates the rig: .005 rad per px, clamped to ±.4 (L1216). */
export const dragYaw = (yaw0, dx) => clamp(yaw0 + dx * 0.005, -0.4, 0.4)

/** Pointer parallax damping: .08 of the remaining distance per frame (L1250). */
export const stepParallax = (cur, target) => cur + (target - cur) * 0.08
