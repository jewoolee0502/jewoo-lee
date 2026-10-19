// Pure Paint helpers (L986–1004): the 24×24 grid, hit-testing and the PNG export (D10).
import { DRAWING_SIZE, gridToPngDataUrl } from '../../../lib/png.js'

export const N = DRAWING_SIZE
/** The 9 colours and the eraser (null), in palette order (L990). */
export const COLS = ['#122030', '#FFFFFF', '#E8452E', '#FF8A3D', '#FFD15C', '#3BB273', '#4AA6EE', '#8A62D6', '#F4A7C0', null]
const COLOURS = COLS.filter(Boolean)

export const emptyGrid = () => Array(N * N).fill(null)

/** The grid cell under a client point (L994), or null outside the canvas. */
export function cellFromPoint(rect, clientX, clientY) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null
  const x = Math.floor(((clientX - rect.left) / rect.width) * N)
  const y = Math.floor(((clientY - rect.top) / rect.height) * N)
  if (!(x >= 0 && y >= 0 && x < N && y < N)) return null
  return { x, y }
}

/** Every grid cell on the Bresenham line from a to b, both ends included, so fast strokes leave no gaps. */
export function cellsBetween(a, b) {
  const dx = Math.abs(b.x - a.x)
  const dy = -Math.abs(b.y - a.y)
  const sx = a.x < b.x ? 1 : -1
  const sy = a.y < b.y ? 1 : -1
  let { x, y } = a
  let err = dx + dy
  const cells = [{ x, y }]
  while (x !== b.x || y !== b.y) {
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
    cells.push({ x, y })
  }
  return cells
}

/** 24×24 indexed PNG data URL; empty and erased cells are transparent. */
export function exportPng(grid) {
  return gridToPngDataUrl(grid, N, COLOURS)
}

export function isEmpty(grid) {
  return !grid.some(Boolean)
}
