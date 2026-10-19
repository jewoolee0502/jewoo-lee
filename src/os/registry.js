// App registry: {title, color, w, h, x?, y?, Component} per id (L788–866).
// Lookups never touch inherited Object.prototype members (fix B1).
// Later phases add bugs, snake, paint, display and wall.
import { PROJECTS } from '../content/index.js'
import { own } from '../core/own.js'
import ProjectDetail from './apps/ProjectDetail.jsx'
import Art from './apps/Art.jsx'
import About from './apps/About.jsx'
import Projects from './apps/Projects.jsx'
import Experience from './apps/Experience.jsx'
import Skills from './apps/Skills.jsx'
import ResumeApp from './apps/ResumeApp.jsx'
import Mail from './apps/Mail.jsx'
import Service from './apps/Service.jsx'
import Trophies from './apps/Trophies.jsx'
import Bin from './apps/Bin.jsx'
import AboutOs from './apps/AboutOs.jsx'
import Terminal from './apps/terminal/Terminal.jsx'

export const registry = new Map([
  ['about', { title: 'About.txt', color: '#4AA6EE', w: 640, h: 470, Component: About }],
  ['projects', { title: `Projects  ·  ${PROJECTS.length} items`, color: '#FFD15C', w: 640, h: 500, Component: Projects }],
  ['exp', { title: 'Experience.log', color: '#7FE0A8', w: 680, h: 500, Component: Experience }],
  ['skills', { title: 'Skills.inv  ·  inventory', color: '#FF8A3D', w: 660, h: 450, Component: Skills }],
  ['term', { title: 'Terminal · jaysh', color: '#7CFFA0', w: 640, h: 420, Component: Terminal }],
  ['resume', { title: 'Resume.pdf', color: '#E8452E', w: 600, h: 500, Component: ResumeApp }],
  ['mail', { title: 'Mail · say hi', color: '#C9A7FF', w: 500, h: 470, Component: Mail }],
  ['service', { title: 'Service.txt', color: '#B9C3CD', w: 580, h: 430, Component: Service }],
  ['ach', { title: 'Trophies', color: '#FFD15C', w: 500, h: 500, Component: Trophies }],
  ['bin', { title: 'Recycle Bin', color: '#3BB273', w: 420, h: 290, Component: Bin }],
  ['aboutos', { title: 'About JAY-OS', color: '#4AA6EE', w: 420, h: 280, Component: AboutOs }],
])

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
