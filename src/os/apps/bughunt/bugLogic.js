// BugHunt rules (L941–953), pure with an injected rand.

export const ROUND_S = 20

/** Seconds until the next spawn: faster as the round goes on, never under .25 s. */
export const spawnInterval = (left) => Math.max(0.25, 0.8 - (ROUND_S - left) * 0.03)

/** Bug speed in px/s for the random draw r in [0, 1). */
export const speed = (left, r) => 60 + r * 90 + (ROUND_S - left) * 6

/** A new bug just off a random edge of the desktop (size {w, h}), heading roughly to the centre. */
export function spawnBug(size, left, rand = Math.random) {
  const edge = Math.floor(rand() * 4)
  const W = size.w
  const H = size.h - 32
  const x = edge === 0 ? -20 : edge === 1 ? W + 20 : rand() * W
  const y = edge === 2 ? -20 : edge === 3 ? H + 20 : rand() * H
  const sp = speed(left, rand())
  const a = Math.atan2(H / 2 - y + (rand() - 0.5) * H * 0.6, W / 2 - x + (rand() - 0.5) * W * 0.6)
  return { x, y, a, sp, turn: 0, dead: false }
}

/** Wanders a little and moves along the heading (mutates and returns the bug). */
export function stepBug(bug, dt, rand = Math.random) {
  bug.turn += (rand() - 0.5) * 4 * dt
  bug.a += bug.turn * dt
  bug.x += Math.cos(bug.a) * bug.sp * dt
  bug.y += Math.sin(bug.a) * bug.sp * dt
  return bug
}

/** True once a bug has wandered off the desktop. */
export const isOut = (bug, size) => bug.x < -60 || bug.x > size.w + 60 || bug.y < -60 || bug.y > size.h + 30
