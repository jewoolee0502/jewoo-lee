// App registry: {title, color, w, h, x?, y?, Component} per id (L788–866).
// Lookups never touch inherited Object.prototype members (fix B1).
import { PROJECTS } from '../content/index.js'
import { own } from '../core/own.js'
import ProjectDetail from './apps/ProjectDetail.jsx'
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
import Display from './apps/Display.jsx'
import BugHunt from './apps/bughunt/BugHunt.jsx'
import Snake from './apps/snake/Snake.jsx'

export const registry = new Map([
  ['about', { title: 'About.txt', color: '#4AA6EE', w: 640, h: 470, Component: About }],
  ['projects', { title: `Projects  ·  ${PROJECTS.length} items`, color: '#FFD15C', w: 640, h: 500, Component: Projects }],
  ['exp', { title: 'Experience.log', color: '#7FE0A8', w: 680, h: 500, Component: Experience }],
  ['skills', { title: 'Skills.inv  ·  inventory', color: '#FF8A3D', w: 660, h: 450, Component: Skills }],
  ['term', { title: 'Terminal · jaysh', color: '#7CFFA0', w: 640, h: 420, Component: Terminal }],
  ['resume', { title: 'Resume.pdf', color: '#E8452E', w: 600, h: 500, Component: ResumeApp }],
  ['mail', { title: 'Mail · say hi', color: '#C9A7FF', w: 500, h: 470, Component: Mail }],
  ['bugs', { title: 'BugHunt.exe', color: '#E8452E', w: 340, h: 250, x: 520, y: 50, Component: BugHunt }],
  ['snake', { title: 'Snake.exe · eat the skills', color: '#3BB273', w: 440, h: 530, Component: Snake }],
  ['service', { title: 'Service.txt', color: '#B9C3CD', w: 580, h: 430, Component: Service }],
  ['display', { title: 'Desktop Background', color: '#5FCDE4', w: 620, h: 470, Component: Display }],
  ['ach', { title: 'Trophies', color: '#FFD15C', w: 500, h: 500, Component: Trophies }],
  ['bin', { title: 'Recycle Bin', color: '#3BB273', w: 420, h: 290, Component: Bin }],
  ['aboutos', { title: 'About JAY-OS', color: '#4AA6EE', w: 420, h: 280, Component: AboutOs }],
])

const INDEX = /^(0|[1-9]\d*)$/ // no leading zeros: one id per window

/** Dynamic windows (L868–874): `p:<n>` is a project. */
export function dynApp(id) {
  if (typeof id !== 'string') return null
  if (id.startsWith('p:')) {
    const n = id.slice(2)
    if (!INDEX.test(n)) return null
    const p = PROJECTS[Number(n)]
    if (!p) return null
    return { title: p.title, color: '#FFD15C', w: 600, h: 540, Component: ProjectDetail }
  }
  return null
}

/** Registered app or dynamic app for `id`, or null. Works with a Map or a plain object. */
export function lookupApp(reg, id) {
  const def = reg instanceof Map ? reg.get(id) : own(reg, id)
  return def ?? dynApp(id)
}
