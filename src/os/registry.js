// App registry. Later phases register {title, color, w, h, x?, y?, Component}.
// Lookups never touch inherited Object.prototype members (fix B1).
import { PROJECTS } from '../content/index.js'
import { own } from '../core/own.js'
import ProjectDetail from './apps/ProjectDetail.jsx'
import Art from './apps/Art.jsx'

export const registry = new Map()

const INDEX = /^(0|[1-9]\d*)$/ // no leading zeros: one id per window

/**
 * Dynamic windows (L868–874): `p:<n>` is a project, `art:<n>` a saved drawing.
 * `art` is the list of saved drawing data URLs (the controller's `art` field).
 */
export function dynApp(id, art = []) {
  if (typeof id !== 'string') return null
  if (id.startsWith('p:')) {
    const n = id.slice(2)
    if (!INDEX.test(n)) return null
    const p = PROJECTS[Number(n)]
    if (!p) return null
    return { title: p.title, color: '#FFD15C', w: 600, h: 540, Component: ProjectDetail }
  }
  if (id.startsWith('art:')) {
    const n = id.slice(4)
    if (!INDEX.test(n) || !art[Number(n)]) return null
    return { title: 'my-art-' + n + '.png', color: '#FFD15C', w: 320, h: 390, Component: Art }
  }
  return null
}

/** Registered app or dynamic app for `id`, or null. Works with a Map or a plain object. */
export function lookupApp(reg, id, art) {
  const def = reg instanceof Map ? reg.get(id) : own(reg, id)
  return def ?? dynApp(id, art)
}
