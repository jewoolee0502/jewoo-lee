// Still frames of each wallpaper mode for the Display app (L603–605). Unlike the prototype, a
// snapshot uses its own layout and state, so it never touches the live engine, and each mode is
// drawn once per page load (B14).
import { CITY_H, isMode } from './modes.js'
import { buildLayout, createWallState } from './layout.js'
import { drawStatic, drawFrame } from './render.js'

export const SNAPSHOT_W = 240

const cache = new Map()

/** PNG data URL of `modeKey` (unknown keys draw night) at 240×180. */
export function snapshot(modeKey) {
  const mode = isMode(modeKey) ? modeKey : 'night'
  const hit = cache.get(mode)
  if (hit) return hit
  const W = SNAPSHOT_W
  const c = document.createElement('canvas')
  c.width = W
  c.height = CITY_H
  const g = c.getContext('2d')
  const L = buildLayout(W)
  drawStatic(g, L, mode, W)
  drawFrame(g, createWallState(), L, mode, W, 0, 0)
  const url = c.toDataURL('image/png')
  cache.set(mode, url)
  return url
}
