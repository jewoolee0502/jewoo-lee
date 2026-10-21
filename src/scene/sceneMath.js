// Pure maths from the scene frame loop (L1239–1262) and the pointer handlers (L1214–1219).
// Every value is the prototype's, including its per-frame (not dt-based) smoothing factors.
import { clamp, ss, easeQuad } from '../core/math.js'
import { OS_W, OS_H, CAM_NARROW_ASPECT } from '../core/constants.js'
import { PEEK } from './props.js'
import { SCREEN } from './laptop.js'

const DEG = Math.PI / 180

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

/** R12: the holder widens over the last 3 % of the dive. */
export const WIDEN_FROM = 0.97
/** R12: the desktop widens to fill the stage late in the dive. At z = 1 it is exactly the flat
 *  layout (w/k, h/k with k = min(w/OS_W, h/OS_H)), so the swap to the flat OS is invisible (R4). */
export function widenSize(z, w, h) {
  const g = ss(WIDEN_FROM, 1, z)
  const k = Math.min(w / OS_W, h / OS_H)
  return { w: OS_W + (w / k - OS_W) * g, h: OS_H + (h / k - OS_H) * g }
}

/** Opacity of the screen vignette in 3D: gone before the widen starts, so neither the widen nor
 *  the swap to the flat OS (which has none) shows it popping off. */
export const vignetteAlpha = (z) => 1 - ss(0.86, WIDEN_FROM, z)

/** Opacity of the DOM screen over the drawn WebGL mirror while the lid opens (a crossfade). */
export const holderAlpha = (le) => ss(0.42, 0.6, le)

export const camFov = (aspect) => (aspect < CAM_NARROW_ASPECT ? 46 : 35)

/** Distance at which the SCREEN.w × SCREEN.h screen (the OS_W × OS_H OS on the lid) fills the view (L1247). */
export function camDistance(fov, aspect) {
  const tv = Math.tan((fov * DEG) / 2)
  return Math.max(SCREEN.h / 2 / tv, SCREEN.w / 2 / (tv * aspect))
}

const NARROW_WP = [0.5, 4.4, 13.8]
const NARROW_WL = [0.1, 1.3, 0]
/** Top corners of the desk slab (7 × 3.2, top at y 0), which the phone wide shot must contain. */
const DESK_CORNERS = [
  [-3.5, 0, -1.6],
  [3.5, 0, -1.6],
  [-3.5, 0, 1.6],
  [3.5, 0, 1.6],
]
/** The desk corners stay inside this fraction of the half-frame (NDC), with room for its edge. */
export const WIDE_FIT_NDC = 0.95
/** How far the look target drops per unit of pull-back, so the room is centred, not the wall. */
const LOOK_DROP = 0.6

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit3 = (a) => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** The narrow wide shot pulled back by `k`: the look target drops a little, and the camera keeps
 *  the base pose's direction from it. k = 1 is the base pose. */
function narrowPose(k) {
  const wl = [NARROW_WL[0], NARROW_WL[1] - LOOK_DROP * (k - 1), NARROW_WL[2]]
  return { wp: NARROW_WP.map((v, i) => wl[i] + (v - NARROW_WL[i]) * k), wl }
}

/** The largest |NDC| of the desk corners seen from `pose` (the look-at basis by hand). */
function deskNdc(aspect, { wp, wl }) {
  const tv = Math.tan((camFov(aspect) * DEG) / 2)
  const f = unit3(sub3(wl, wp))
  const r = unit3(cross3(f, [0, 1, 0]))
  const u = cross3(r, f)
  let m = 0
  for (const c of DESK_CORNERS) {
    const p = sub3(c, wp)
    const depth = dot3(p, f)
    if (!(depth > 0)) return Infinity
    m = Math.max(m, Math.abs(dot3(p, r) / depth / (tv * aspect)), Math.abs(dot3(p, u) / depth / tv))
  }
  return m
}

let fitAspect = NaN
let fitK = 1
/** Smallest pull-back that frames the whole desk within WIDE_FIT_NDC (bisection, cached per aspect).
 *  Capped at k 16, which still fits down to an aspect of about 0.04 (far narrower than any phone). */
function narrowFitK(aspect) {
  if (aspect === fitAspect) return fitK
  let k = 1
  if (deskNdc(aspect, narrowPose(1)) > WIDE_FIT_NDC) {
    let lo = 1
    let hi = 16
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (deskNdc(aspect, narrowPose(mid)) > WIDE_FIT_NDC) lo = mid
      else hi = mid
    }
    k = hi
  }
  fitAspect = aspect
  fitK = k
  return k
}

/** The wide room shot and its look target (L1248). On tall screens the camera pulls back by `k`
 *  (the look target dropping a little) until the whole desk, mug and plant included, is in frame;
 *  `k` is 1 when it already is. */
export function widePose(aspect) {
  if (aspect >= CAM_NARROW_ASPECT) return { wp: [1.4, 3.6, 10.2], wl: [0.2, 1.0, 0], k: 1 }
  const k = narrowFitK(aspect)
  if (k === 1) return { wp: [...NARROW_WP], wl: [...NARROW_WL], k }
  return { ...narrowPose(k), k }
}

/** Scene fog for a wide shot pulled back by `k`, so the room is not fogged out on phones. */
export const fogFor = (k) => ({ near: 16 * k, far: 34 * k })

/**
 * R11: the camera parameter that makes the screen's apparent size (∝ 1/distance) grow linearly
 * with `e` when the distance falls from `d0` to `d1`.
 */
export function perceptualE(e, d0, d1) {
  if (d0 <= d1) return e
  const inv = 1 / d0 + (1 / d1 - 1 / d0) * e
  return (d0 - 1 / inv) / (d0 - d1)
}

/** Camera position and look target between the wide shot (e=0) and the screen (e=1) (L1249–1253),
 *  moved along the path by perceptualE (R11). */
export function cameraPose({ e, aspect, sp, aPos, aN, d, reduce }) {
  const { wp, wl } = widePose(aspect)
  const par = reduce ? 0 : 1 - e
  const ax = wp[0] + sp.x * 1.1 * par
  const ay = wp[1] - sp.y * 0.7 * par
  const az = wp[2]
  const bx = aPos.x + aN.x * d
  const by = aPos.y + aN.y * d
  const bz = aPos.z + aN.z * d
  const k = perceptualE(e, Math.hypot(ax - aPos.x, ay - aPos.y, az - aPos.z), d)
  return {
    pos: { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, z: az + (bz - az) * k },
    look: { x: wl[0] + (aPos.x - wl[0]) * k, y: wl[1] + (aPos.y - wl[1]) * k, z: wl[2] + (aPos.z - wl[2]) * k },
  }
}

/** One frame of key depression (L1257): a press sets p to 1, and the key sits `travel` under `base`
 *  until p falls under 0.5, then rises back. R4-2 passes base 0 and KEYBOARD.travel (an offset). */
export function stepKey(p, dt, base = 0.19, travel = 0.035) {
  const np = Math.max(0, p - dt * 7)
  return { p: np, y: base - travel * Math.min(1, np * 2) }
}

const BACKLIGHT = { on: 1, boot: 0.6 }

/**
 * The keyboard backlight level (plan-r4 D3), 0..1: on 1, boot 0.6, otherwise dark, all scaled by
 * the lid opening `le`. A hovered keyboard keeps at least 0.45·le, and a lid peeking at the desk
 * leaks 0.3 from under it.
 */
export function backlightTarget({ osState, le, hovered, peeking }) {
  let v = (BACKLIGHT[osState] ?? 0) * le
  if (hovered) v = Math.max(v, 0.45 * le)
  if (peeking) v = Math.max(v, 0.3)
  return clamp(v, 0, 1)
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

/**
 * The scene's tween list. `tween(obj, {p, r}, dur, done)` starts at once, unless `obj` already has
 * a running or waiting tween: then it waits for those and starts (from wherever they left the
 * object) when they finish, so a chain issued in one go plays leg by leg instead of fighting.
 * `durFor(dur)` maps each duration when its tween starts (reduced motion shortens them all);
 * `step(dt)` runs one frame and `busy(obj)` says whether `obj` has a tween running or waiting.
 */
export function createTweenList(durFor = (d) => d) {
  const live = []
  const waiting = new Map()
  const xyz = (v) => ({ x: v.x, y: v.y, z: v.z })
  function start(obj, to, dur, done) {
    const fp = xyz(obj.position)
    const fr = xyz(obj.rotation)
    live.push({ obj, fp, tp: to.p ? xyz(to.p) : fp, fr, tr: to.r ? xyz(to.r) : fr, t: 0, dur: durFor(dur), done })
  }
  const busy = (obj) => waiting.has(obj) || live.some((q) => q.obj === obj && !q.finished)
  function tween(obj, to, dur, done) {
    if (!busy(obj)) return start(obj, to, dur, done)
    const queue = waiting.get(obj) ?? []
    queue.push([obj, to, dur, done])
    waiting.set(obj, queue)
  }
  function step(dt) {
    for (const q of live.slice()) {
      if (!stepTween(q, dt)) continue
      live.splice(live.indexOf(q), 1)
      const queue = waiting.get(q.obj)
      if (!queue) continue
      const next = queue.shift()
      if (!queue.length) waiting.delete(q.obj)
      start(...next)
    }
  }
  return { tween, step, busy }
}

/** Drag on the desk rotates the rig: .005 rad per px, clamped to ±.4 (L1216). */
export const dragYaw = (yaw0, dx) => clamp(yaw0 + dx * 0.005, -0.4, 0.4)

/** Pointer parallax damping: .08 of the remaining distance per frame (L1250). */
export const stepParallax = (cur, target) => cur + (target - cur) * 0.08

// ---------- hover play, lamp ease, steam and lid peek (round 2, R16) ----------

/** Frame-rate independent ease of `cur` toward `target`: what is left decays at `rate` per second. */
export const approach = (cur, target, dt, rate) => target + (cur - target) * Math.exp(-rate * dt)

/** A hovered floppy's wiggle angle at `t` ms, at most `amp` either way. */
export const wiggle = (t, amp) => amp * Math.sin(t * 0.014)

export const STEAM_Y0 = 0.45
export const STEAM_Y1 = 0.85

/** One steam particle's rise above the mug's base; wraps back to just above the rim at the top. */
export function stepSteam(y, v, dt) {
  const ny = y + v * dt
  return ny > STEAM_Y1 ? STEAM_Y0 : ny
}

/** How far the closed lid should peek open: PEEK while hovered at the desk (z < 0.02), unless reduced. */
export const peekTarget = ({ hovered, z, reduce }) => (!reduce && hovered && z < 0.02 ? PEEK : 0)

/** The hover glow for a material of colour `hex`: its own channels scaled by `k`, as 0..1 floats. */
export const glowColor = (hex, k) => [((hex >> 16) & 255) / 255 * k, ((hex >> 8) & 255) / 255 * k, (hex & 255) / 255 * k]

/**
 * Whether the lid stays peeked: a lid pick starts it, and it holds while the pointer is anywhere
 * on the laptop (so moving off the lifted front edge onto the base does not drop it and flicker).
 */
export const peekLatch = (prevPeeking, pickIsLid, pickIsLaptop) => pickIsLid || (prevPeeking && pickIsLaptop)
