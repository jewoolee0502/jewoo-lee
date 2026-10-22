// jaysh command table and runner (L893–930). Commands live in a Map (fix B1), in the
// prototype's insertion order, because Tab completion and suggestions depend on it.
import * as CONTENT from '../../../content/index.js'
import { MODES } from '../../../wallpaper/modes.js'
import { own } from '../../../core/own.js'
import { formatZoneDay, ZONES } from '../../../core/clock.js'
import { NEOFETCH } from './neofetch.js'
import { parseLine, resolveOpen, suggest } from './parse.js'

export const PROMPT = 'jay@jay-os:~$'

/** `open` aliases (L894). */
export const NAMES = new Map([
  ['about', 'about'],
  ['projects', 'projects'],
  ['experience', 'exp'],
  ['exp', 'exp'],
  ['skills', 'skills'],
  ['terminal', 'term'],
  ['resume', 'resume'],
  ['cv', 'resume'],
  ['mail', 'mail'],
  ['contact', 'mail'],
  ['bughunt', 'bugs'],
  ['bugs', 'bugs'],
  ['snake', 'snake'],
  ['service', 'service'],
  ['wallpaper', 'display'],
  ['display', 'display'],
  ['trophies', 'ach'],
  ['achievements', 'ach'],
  ['bin', 'bin'],
  ['recyclebin', 'bin'],
])

const LS =
  'About.txt  Projects/  Experience.log  Skills.inv  Terminal  Resume.pdf  Mail  BugHunt.exe  Snake.exe  Wallpaper  Service.txt  Trophies  Recycle Bin'

const helpLines = (n) => [
  'whoami        who is Jay',
  'neofetch      system info, but make it a flex',
  'ls            list the desktop',
  `projects      list projects   (open p1 … p${n})`,
  'open <thing>  open an app or project',
  'skills        what Jay works with',
  'experience    the career log',
  'contact       ways to reach Jay',
  'snake · bugs     play',
  'matrix · weather · lamp  mess with the room',
  'wallpaper     pick a Montréal desktop scene',
  'salute        Marine Corps salute',
  'sudo hire-jay ...you know you want to',
  'clear · history · exit · shutdown',
]

/**
 * ctx = {say(text, cls), pre(text), clear(), history[], os, ctrl, scene: () => api | null,
 *        ach, wallpaper, content: {PROJECTS, ROLES, SKILLS}, timers}
 */
export function createCommands(ctx) {
  const { say, pre } = ctx
  const content = ctx.content ?? CONTENT
  const PROJECTS = content.PROJECTS ?? CONTENT.PROJECTS
  const ROLES = content.ROLES ?? CONTENT.ROLES
  const SKILLS = content.SKILLS ?? CONTENT.SKILLS
  const openApp = (id) => ctx.os?.openApp?.(id)
  const unlock = (id) => ctx.ach?.unlock?.(id)
  const scene = () => (typeof ctx.scene === 'function' ? ctx.scene() : null) ?? null
  const later = (fn, ms) => (ctx.timers ? ctx.timers.timeout(fn, ms) : setTimeout(fn, ms))
  const hello = () => say('안녕하세요! Hello! Bonjour!', 'c')

  function open(a) {
    const r = resolveOpen(a, { projects: PROJECTS, names: NAMES })
    if (r.kind === 'project') {
      openApp('p:' + r.index)
      say('opening ' + PROJECTS[r.index].title + ' …', 'b')
    } else if (r.kind === 'app') {
      openApp(r.id)
      say('opening ' + r.name + ' …', 'b')
    } else {
      say('open: no such thing: ' + r.shown + '. Try "ls".', 'w')
    }
  }

  function wallpaper(a) {
    const k = (a || '').toLowerCase()
    const mode = k === 'auto' ? null : own(MODES, k)
    if (k !== 'auto' && !mode) {
      say('usage: wallpaper auto | night | golden | day', 'd')
      openApp('display')
      return
    }
    ctx.wallpaper?.setChoice?.(k)
    if (k === 'auto') {
      const cur = own(MODES, ctx.wallpaper?.current?.())
      say('wallpaper: auto (' + (cur ? cur.name : '?') + ')', 'b')
    } else {
      say('wallpaper: ' + mode.name, 'b')
    }
  }

  return new Map([
    ['help', () => helpLines(PROJECTS.length).forEach((l) => say(l))],
    [
      'whoami',
      () =>
        say(
          'Jewoo (Jay) Lee: full-stack developer, McGill Computer Engineering, former ROKMC Sergeant. Builds with Vue/Nuxt, React, GraphQL and Firebase.',
        ),
    ],
    [
      'neofetch',
      () => {
        pre(NEOFETCH)
        unlock('neofetch')
      },
    ],
    ['ls', () => say(LS, 'b')],
    ['projects', () => PROJECTS.forEach((p, i) => say('  p' + (i + 1) + '  ' + p.title, 'b'))],
    ['open', open],
    ['cat', open],
    ['skills', () => say(SKILLS.map((s) => s.name).join(' · '))],
    ['experience', () => ROLES.forEach((r) => say('  ' + r.dates.slice(0, 7) + '  ' + r.company))],
    [
      'contact',
      () => {
        say('github.com/jewoolee0502 · linkedin.com/in/jewoo-lee · instagram @jwuu_lee')
        openApp('mail')
      },
    ],
    [
      'snake',
      () => {
        openApp('snake')
        say('good luck. it eats skills.', 'b')
      },
    ],
    [
      'bugs',
      () => {
        openApp('bugs')
        say('grab a newspaper.', 'b')
      },
    ],
    [
      'matrix',
      () => {
        ctx.os?.matrix?.()
        say('wake up, recruiter…', 'd')
      },
    ],
    [
      'weather',
      () => {
        say('Montréal: snowing. Look out the window.', 'b')
        scene()?.snow?.(10)
      },
    ],
    [
      'lamp',
      () => {
        const s = scene()
        if (s) say('lamp: ' + (s.lamp?.() ? 'on' : 'off'), 'b')
        else say('no lamp in flat mode.', 'w')
      },
    ],
    ['wallpaper', wallpaper],
    [
      'salute',
      () => {
        say('필승! (Pilseung: "certain victory", the ROK Marine Corps salute)', 'c')
        unlock('tags')
      },
    ],
    [
      'sudo',
      (a) => {
        if (/hire/.test(a || '')) {
          say('[sudo] password for recruiter: ********', 'd')
          say('Access granted. Excellent decision. 🎉', 'c')
          ctx.os?.confetti?.()
          openApp('resume')
          unlock('hire')
        } else say('Nice try.', 'w')
      },
    ],
    ['coffee', () => say('brewing… ☕ done. Productivity +10%. (The boot log said coffee was LOW.)', 'c')],
    [
      'date',
      () => {
        const now = new Date()
        say('Montréal  ' + formatZoneDay(now, ZONES.MTL))
        say('Seoul     ' + formatZoneDay(now, ZONES.SEL))
      },
    ],
    ['pwd', () => say('/home/jay')],
    ['cd', () => say("there's nowhere to go. you're already home.")],
    ['echo', (a) => say(a || '')],
    ['hello', hello],
    ['hi', hello],
    ['안녕', hello],
    ['git', () => say(`On branch feat/website-revamp. ${PROJECTS.length} projects, 0 regrets.`)],
    ['vim', () => say('you would never find your way out. try "open about".', 'w')],
    ['rm', () => say('permission denied: this portfolio is load-bearing.', 'w')],
    ['cheat', () => say('↑ ↑ ↓ ↓ ← → ← → B A', 'd')],
    ['history', () => ctx.history.forEach((h, i) => say('  ' + (i + 1) + '  ' + h, 'd'))],
    ['clear', () => ctx.clear()],
    [
      'exit',
      () => {
        say('logging out … stepping back from the desk.', 'd')
        later(() => ctx.ctrl?.exit?.(), 400)
      },
    ],
    [
      'shutdown',
      () => {
        say('shutting down …', 'd')
        later(() => ctx.os?.shutdown?.(() => ctx.ctrl?.exit?.()), 500)
      },
    ],
  ])
}

/** Returns {run(raw), commands, names}. `ctx.history` is appended to by `run`. */
export function createRunner(ctx) {
  const commands = createCommands(ctx)
  const names = [...commands.keys()]

  function run(raw) {
    const { line, cmd, args, c0 } = parseLine(raw)
    ctx.say(PROMPT + ' ' + line, 'c')
    if (!line) return
    ctx.history.push(line)
    ctx.ach?.unlock?.('term')
    const fn = commands.get(cmd)
    if (fn) {
      fn(args)
      return
    }
    const best = suggest(cmd, names)
    ctx.say('jaysh: command not found: ' + c0 + (best ? '. Did you mean "' + best + '"?' : '. Try "help".'), 'w')
  }

  return { run, commands, names }
}
