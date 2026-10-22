// jaysh commands (plan Phase 4 TEST LIST; prototype L893–930). Each test runs a full line
// through the runner with fake os, ctrl, scene, ach and wallpaper objects.
// Assumed API: commands.js exports createCommands(ctx) -> Map and createRunner(ctx) -> { run(raw) }.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCommands, createRunner } from './commands.js'
import { createWallpaperStore } from '../../../wallpaper/wallpaperStore.js'
import { MODES } from '../../../wallpaper/modes.js'
import { createTimers } from '../../../core/timers.js'
import { PROJECTS, ROLES, SKILLS, PROFILE } from '../../../content/index.js'

const ECHO = 'jay@jay-os:~$ '

const HELP = [
  'whoami        who is Jay',
  'neofetch      system info, but make it a flex',
  'ls            list the desktop',
  'projects      list projects   (open p1 … p9)',
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

const COMMAND_KEYS = [
  'help', 'whoami', 'neofetch', 'ls', 'projects', 'open', 'cat', 'skills', 'experience', 'contact',
  'snake', 'bugs', 'matrix', 'weather', 'lamp', 'wallpaper', 'salute', 'sudo', 'coffee',
  'date', 'pwd', 'cd', 'echo', 'hello', 'hi', '안녕', 'git', 'vim', 'rm', 'cheat', 'history',
  'clear', 'exit', 'shutdown',
]

function makeTerm(overrides = {}) {
  const lines = [] // [text, cls]; `pre` entries use cls 'pre'
  const wallpaper = createWallpaperStore({ now: () => new Date('2026-10-18T15:04:00Z') }) // 11:04 in Montréal
  vi.spyOn(wallpaper, 'setChoice')
  const ctx = {
    say: vi.fn((text, cls) => lines.push([text, cls])),
    pre: vi.fn((text) => lines.push([text, 'pre'])),
    clear: vi.fn(() => {
      lines.length = 0
    }),
    history: [],
    os: { openApp: vi.fn(), matrix: vi.fn(), confetti: vi.fn(), shutdown: vi.fn() },
    ctrl: { exit: vi.fn(), enter: vi.fn() },
    scene: () => null,
    ach: { unlock: vi.fn() },
    wallpaper,
    content: { PROJECTS, ROLES, SKILLS, PROFILE },
    timers: createTimers(),
    ...overrides,
  }
  const runner = createRunner(ctx)
  // Output of one run, without the echoed prompt line.
  const visible = () => lines.filter(([t]) => !t.startsWith(ECHO))
  const run = (line) => {
    const start = lines.length
    runner.run(line)
    return lines.slice(start).filter(([t]) => !t.startsWith(ECHO))
  }
  return { ctx, run, lines, visible }
}

describe('command table', () => {
  it('keeps the prototype insertion order, so Tab and suggestions match', () => {
    const { ctx } = makeTerm()
    expect([...createCommands(ctx).keys()]).toEqual(COMMAND_KEYS)
  })
})

describe('help and information commands', () => {
  it('help prints exactly 14 lines, with line 4 derived from the project count', () => {
    const { run } = makeTerm()
    const out = run('help')
    expect(out).toHaveLength(14)
    expect(out.map(([t]) => t)).toEqual(HELP)
  })

  it('whoami prints the L897 text', () => {
    const { run } = makeTerm()
    expect(run('whoami')).toEqual([
      [
        'Jewoo (Jay) Lee: full-stack developer, McGill Computer Engineering, former ROKMC Sergeant. Builds with Vue/Nuxt, React, GraphQL and Firebase.',
        undefined,
      ],
    ])
  })

  it('neofetch prints one pre block and unlocks Show-off', () => {
    const { ctx, run } = makeTerm()
    const out = run('neofetch')
    expect(out).toHaveLength(1)
    expect(out[0][1]).toBe('pre')
    expect(out[0][0]).toContain('OS: JAY-OS 2.0 (Montréal ed.)')
    expect(ctx.ach.unlock).toHaveBeenCalledWith('neofetch')
  })

  it('projects prints one line per project, the last being p9 Joblog in class b', () => {
    const { run } = makeTerm()
    const out = run('projects')
    expect(out).toHaveLength(9)
    expect(out[0]).toEqual(['  p1  RecycleWise', 'b'])
    expect(out[8]).toEqual(['  p9  Joblog', 'b'])
  })

  it('skills joins the 16 names with " · "', () => {
    const { run } = makeTerm()
    expect(run('skills')).toEqual([
      [
        'Python · Java · JavaScript · TypeScript · CSS · Vue.js · Nuxt · React · Spring Boot · Tailwind · Firebase · PostgreSQL · MongoDB · NumPy · Git · Figma',
        undefined,
      ],
    ])
  })

  it('experience prints 7 lines, the first being 2025-08 Wholesale Express', () => {
    const { run } = makeTerm()
    const out = run('experience')
    expect(out).toHaveLength(7)
    expect(out[0][0]).toBe('  2025-08  Wholesale Express')
  })

  it('contact prints the L909 text and opens mail', () => {
    const { ctx, run } = makeTerm()
    expect(run('contact')[0][0]).toBe('github.com/jewoolee0502 · linkedin.com/in/jewoo-lee · instagram @jwuu_lee')
    expect(ctx.os.openApp).toHaveBeenCalledWith('mail')
  })
})

describe('open and cat', () => {
  it('open p1 opens p:0 and prints the project title', () => {
    const { ctx, run } = makeTerm()
    expect(run('open p1')).toEqual([['opening RecycleWise …', 'b']])
    expect(ctx.os.openApp).toHaveBeenCalledWith('p:0')
  })

  it('open snake.exe prints the normalised name and opens snake', () => {
    const { ctx, run } = makeTerm()
    expect(run('open snake.exe')).toEqual([['opening snake …', 'b']])
    expect(ctx.os.openApp).toHaveBeenCalledWith('snake')
  })

  it('open nothing-here prints the not-found message in class w', () => {
    const { run } = makeTerm()
    expect(run('open nothing-here')).toEqual([['open: no such thing: nothing-here. Try "ls".', 'w']])
  })

  it('open p10 and open with no argument are not found', () => {
    const { run } = makeTerm()
    expect(run('open p10')).toEqual([['open: no such thing: p10. Try "ls".', 'w']])
    expect(run('open')).toEqual([['open: no such thing: (nothing). Try "ls".', 'w']])
  })

  it('open __proto__ and open constructor are rejected without opening anything', () => {
    const { ctx, run } = makeTerm()
    expect(run('open __proto__')).toEqual([['open: no such thing: __proto__. Try "ls".', 'w']])
    expect(run('open constructor')).toEqual([['open: no such thing: constructor. Try "ls".', 'w']])
    expect(ctx.os.openApp).not.toHaveBeenCalled()
  })

  it('cat about opens about', () => {
    const { ctx, run } = makeTerm()
    run('cat about')
    expect(ctx.os.openApp).toHaveBeenCalledWith('about')
  })
})

describe('app and effect commands', () => {
  it('snake and bugs open their apps', () => {
    const { ctx, run } = makeTerm()
    expect(run('snake')).toEqual([['good luck. it eats skills.', 'b']])
    expect(run('bugs')).toEqual([['grab a newspaper.', 'b']])
    expect(ctx.os.openApp).toHaveBeenCalledWith('snake')
    expect(ctx.os.openApp).toHaveBeenCalledWith('bugs')
  })

  it('matrix calls os.matrix and prints the line in class d', () => {
    const { ctx, run } = makeTerm()
    expect(run('matrix')).toEqual([['wake up, recruiter…', 'd']])
    expect(ctx.os.matrix).toHaveBeenCalledTimes(1)
  })

  it('weather calls scene.snow(10) when a 3D scene exists, and only prints otherwise', () => {
    const snow = vi.fn()
    const withScene = makeTerm({ scene: () => ({ snow }) })
    expect(withScene.run('weather')).toEqual([['Montréal: snowing. Look out the window.', 'b']])
    expect(snow).toHaveBeenCalledWith(10)

    const flat = makeTerm({ scene: () => null })
    expect(flat.run('weather')).toEqual([['Montréal: snowing. Look out the window.', 'b']])
  })

  it('lamp prints off when the scene reports the lamp is off', () => {
    const { run } = makeTerm({ scene: () => ({ lamp: () => false }) })
    expect(run('lamp')).toEqual([['lamp: off', 'b']])
  })

  it('lamp prints the flat-mode message in class w when there is no scene', () => {
    const { run } = makeTerm({ scene: () => null })
    expect(run('lamp')).toEqual([['no lamp in flat mode.', 'w']])
  })

  it('salute prints the L915 text and unlocks Once a Marine', () => {
    const { ctx, run } = makeTerm()
    expect(run('salute')).toEqual([['필승! (Pilseung: "certain victory", the ROK Marine Corps salute)', 'c']])
    expect(ctx.ach.unlock).toHaveBeenCalledWith('tags')
  })

  it('sudo with a hire match prints two lines, confetti, opens resume and unlocks hire', () => {
    const { ctx, run } = makeTerm()
    expect(run('sudo hire-jay')).toEqual([
      ['[sudo] password for recruiter: ********', 'd'],
      ['Access granted. Excellent decision. 🎉', 'c'],
    ])
    expect(ctx.os.confetti).toHaveBeenCalledTimes(1)
    expect(ctx.os.openApp).toHaveBeenCalledWith('resume')
    expect(ctx.ach.unlock).toHaveBeenCalledWith('hire')
  })

  it('sudo without a hire match says Nice try.', () => {
    const { ctx, run } = makeTerm()
    expect(run('sudo rm')).toEqual([['Nice try.', 'w']])
    expect(ctx.os.confetti).not.toHaveBeenCalled()
  })

  it('git prints the branch line with 9 projects', () => {
    const { run } = makeTerm()
    expect(run('git')).toEqual([['On branch feat/website-revamp. 9 projects, 0 regrets.', undefined]])
  })

  it('date prints two lines for Montréal and Seoul', () => {
    const { run } = makeTerm()
    const out = run('date')
    expect(out).toHaveLength(2)
    expect(out[0][0].startsWith('Montréal  ')).toBe(true)
    expect(out[1][0].startsWith('Seoul     ')).toBe(true)
  })
})

describe('wallpaper', () => {
  it('wallpaper golden sets the choice and prints the mode name, without touching localStorage', () => {
    const { ctx, run } = makeTerm()
    expect(run('wallpaper golden')).toEqual([['wallpaper: Golden hour', 'b']])
    expect(ctx.wallpaper.setChoice).toHaveBeenCalledWith('golden')
    expect(localStorage.length).toBe(0)
  })

  it('wallpaper auto names the mode that is current in Montréal (11:04 is Snow day)', () => {
    const { ctx, run } = makeTerm()
    expect(run('wallpaper auto')).toEqual([['wallpaper: auto (Snow day)', 'b']])
    expect(ctx.wallpaper.setChoice).toHaveBeenCalledWith('auto')
    expect(MODES[ctx.wallpaper.current()].name).toBe('Snow day')
  })

  it('wallpaper constructor and bare wallpaper print usage and open display', () => {
    const { ctx, run } = makeTerm()
    expect(run('wallpaper constructor')).toEqual([['usage: wallpaper auto | night | golden | day', 'd']])
    expect(run('wallpaper')).toEqual([['usage: wallpaper auto | night | golden | day', 'd']])
    expect(ctx.wallpaper.setChoice).not.toHaveBeenCalled()
    expect(ctx.os.openApp).toHaveBeenCalledWith('display')
  })
})

describe('history, clear, exit and shutdown', () => {
  it('ls lists the desktop without Paint or Visitor Wall', () => {
    const { run } = makeTerm()
    const text = run('ls').map(([t]) => t).join('\n')
    expect(text).toContain('Snake.exe')
    expect(text).toContain('Wallpaper')
    expect(text).not.toMatch(/Paint/)
    expect(text).not.toMatch(/Visitor ?Wall/)
  })

  it('history lists the entries after two commands, including history itself', () => {
    const { run } = makeTerm()
    run('ls')
    run('pwd')
    expect(run('history')).toEqual([
      ['  1  ls', 'd'],
      ['  2  pwd', 'd'],
      ['  3  history', 'd'],
    ])
  })

  it('clear empties the output but keeps the history', () => {
    const { run, visible } = makeTerm()
    run('ls')
    run('clear')
    expect(visible()).toEqual([])
    expect(run('history')).toEqual([
      ['  1  ls', 'd'],
      ['  2  clear', 'd'],
      ['  3  history', 'd'],
    ])
  })

  describe('with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('exit prints the L924 text and calls ctrl.exit after 400 ms', () => {
      const { ctx, run } = makeTerm()
      expect(run('exit')).toEqual([['logging out … stepping back from the desk.', 'd']])
      vi.advanceTimersByTime(399)
      expect(ctx.ctrl.exit).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(ctx.ctrl.exit).toHaveBeenCalledTimes(1)
    })

    it('shutdown calls os.shutdown after 500 ms with a callback that calls ctrl.exit', () => {
      const { ctx, run } = makeTerm()
      expect(run('shutdown')).toEqual([['shutting down …', 'd']])
      vi.advanceTimersByTime(499)
      expect(ctx.os.shutdown).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(ctx.os.shutdown).toHaveBeenCalledWith(expect.any(Function))
      ctx.os.shutdown.mock.calls[0][0]()
      expect(ctx.ctrl.exit).toHaveBeenCalledTimes(1)
    })
  })
})

describe('command not found and lookups', () => {
  it('suggests the closest command within distance 2', () => {
    const { run } = makeTerm()
    expect(run('hepl')).toEqual([['jaysh: command not found: hepl. Did you mean "help"?', 'w']])
  })

  it('paint, wall and visitorwall are no longer commands (Paint and the Visitor Wall are gone)', () => {
    const { ctx, run } = makeTerm()
    for (const name of ['paint', 'wall', 'visitorwall']) {
      expect(run(name), name).toEqual([[`jaysh: command not found: ${name}. Try "help".`, 'w']])
    }
    expect(ctx.os.openApp).not.toHaveBeenCalledWith('paint')
    expect(ctx.os.openApp).not.toHaveBeenCalledWith('wall')
  })

  it('says Try "help" when nothing is close', () => {
    const { run } = makeTerm()
    expect(run('Xyz')).toEqual([['jaysh: command not found: Xyz. Try "help".', 'w']])
  })

  it('does not treat inherited object keys or the bare name about as commands', () => {
    const { run } = makeTerm()
    expect(run('toString')).toEqual([['jaysh: command not found: toString. Try "help".', 'w']])
    expect(run('constructor')).toEqual([['jaysh: command not found: constructor. Try "help".', 'w']])
    expect(run('about')).toEqual([['jaysh: command not found: about. Try "help".', 'w']])
  })

  it('unlocks Hacker Voice for every non-empty line, and not for an empty one', () => {
    const { ctx, run } = makeTerm()
    run('help')
    run('hepl')
    expect(ctx.ach.unlock).toHaveBeenCalledTimes(2)
    expect(ctx.ach.unlock).toHaveBeenCalledWith('term')
    run('   ')
    expect(ctx.ach.unlock).toHaveBeenCalledTimes(2)
  })
})
