// Phase 3 TEST LIST: stage/structure.test.js. Reads files with node:fs.
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Vitest runs from the project root (vite.config.js sits there).
const root = process.cwd()
const abs = (rel) => resolve(root, rel)

// Non-test source files under a directory (test files may mock or name the banned packages).
function sourceFiles(dir = abs('src')) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(p))
    else if (/\.(m?js|jsx|css)$/.test(entry.name) && !/\.test\.[a-z]+$/.test(entry.name)) out.push(p)
  }
  return out
}
const rel = (p) => p.slice(root.length + 1)
const filesImporting = (re) => sourceFiles().filter((f) => re.test(readFileSync(f, 'utf8'))).map(rel)

describe('phase 3 structure', () => {
  it('src/components does not exist', () => {
    expect(existsSync(abs('src/components'))).toBe(false)
  })

  it('package.json has no gsap, lenis, tailwindcss or prop-types', () => {
    const pkg = JSON.parse(readFileSync(abs('package.json'), 'utf8'))
    const all = { ...pkg.dependencies, ...pkg.devDependencies }
    for (const name of ['gsap', '@gsap/react', 'lenis', 'tailwindcss', 'prop-types', 'tailwind-scrollbar', 'postcss', 'autoprefixer']) {
      expect(all, name).not.toHaveProperty(name)
    }
  })

  it('tailwind.config.js does not exist', () => {
    expect(existsSync(abs('tailwind.config.js'))).toBe(false)
  })
})

// Phase 8 TEST LIST: structure additions (skip link, SEO, robots, prerender files, import bans).
describe('phase 8 structure', () => {
  const html = () => readFileSync(abs('index.html'), 'utf8')


  it('index.html has the résumé outlet, description meta and the skip link to #resume', () => {
    const text = html()
    expect(text).toContain('<!--resume-outlet-->')
    expect(text).toContain('name="description"')
    expect(text).toMatch(/<a class="skip" href="#resume"[^>]*>Skip to résumé<\/a>/)
  })

  it('index.html and public/ never mention the unresolved jewoolee.dev domain', () => {
    expect(html()).not.toMatch(/jewoolee\.dev/)
    expect(sourceFiles().filter((f) => /jewoolee\.dev/.test(readFileSync(f, 'utf8')))).toEqual([])
    expect(existsSync(abs('public/robots.txt')) ? readFileSync(abs('public/robots.txt'), 'utf8') : '').not.toMatch(/jewoolee\.dev/)
  })

  it('public/robots.txt exists and has a User-agent rule', () => {
    expect(existsSync(abs('public/robots.txt'))).toBe(true)
    expect(readFileSync(abs('public/robots.txt'), 'utf8')).toMatch(/User-agent:/)
  })

  it('the prerender pieces exist and the build chains the SSR build and prerender', () => {
    expect(existsSync(abs('src/resume/entry-server.jsx'))).toBe(true)
    expect(existsSync(abs('scripts/prerender.mjs'))).toBe(true)
    expect(existsSync(abs('scripts/prerender-lib.mjs'))).toBe(true)
    const build = JSON.parse(readFileSync(abs('package.json'), 'utf8')).scripts.build
    expect(build).toContain('vite build --ssr src/resume/entry-server.jsx')
    expect(build).toContain('node scripts/prerender.mjs')
  })

  it('no non-test source imports gsap, lenis, prop-types or tailwind', () => {
    expect(filesImporting(/['"](gsap|@gsap\/react|lenis|prop-types|tailwindcss|tailwind-scrollbar)(\/[^'"]*)?['"]/)).toEqual([])
  })

  it('three is imported only by src/scene/createScene.js', () => {
    expect(filesImporting(/['"]three(\/[^'"]*)?['"]/)).toEqual(['src/scene/createScene.js'])
  })
})

// Round 2 Phase 2 TEST LIST item 10: the wheel hijack, the tween flags and the focus-leave are gone.
describe('phase 2 removals (round 2)', () => {
  it('src/stage/wheel.js does not exist', () => {
    expect(existsSync(abs('src/stage/wheel.js'))).toBe(false)
  })

  it('no non-test source imports wheel.js or references WHEEL_EXIT or WHEEL_GAP_MS', () => {
    expect(filesImporting(/wheel\.js|WHEEL_EXIT|WHEEL_GAP_MS/)).toEqual([])
  })

  it('no non-test source references ctrl.tw or ctrl?.tw, armed, suppress or .leave(', () => {
    expect(filesImporting(/\bctrl\??\.tw\b|\barmed\b|\bsuppress\b|\.leave\(/)).toEqual([])
  })

  it('createScene.js has no willChange assignment other than the reset to empty', () => {
    const text = readFileSync(abs('src/scene/createScene.js'), 'utf8')
    expect(text.match(/willChange\s*=(?!\s*'')/g) ?? []).toEqual([])
  })
})

// Phase 1 TEST LIST (round 2): Paint, the Visitor Wall, Supabase, the corkboard and the edh.dev credit are gone.
describe('phase 1 removals', () => {
  const pkg = () => JSON.parse(readFileSync(abs('package.json'), 'utf8'))

  it('package.json has neither @supabase/supabase-js nor @electric-sql/pglite in any dependency field', () => {
    const p = pkg()
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      expect(p[field] ?? {}, field).not.toHaveProperty('@supabase/supabase-js')
      expect(p[field] ?? {}, field).not.toHaveProperty('@electric-sql/pglite')
    }
  })

  it('the removed directories and files do not exist', () => {
    for (const rel of [
      'supabase',
      'src/wall',
      'src/os/apps/paint',
      'src/os/apps/VisitorWall.jsx',
      'src/os/apps/Art.jsx',
      'src/test/fakeSupabase.js',
    ]) {
      expect(existsSync(abs(rel)), rel).toBe(false)
    }
  })

  it('the Phase 1 props module exists (src/scene/props.js)', () => {
    expect(existsSync(abs('src/scene/props.js'))).toBe(true)
  })

  // Scanned: every non-test source file under src/ and scripts/, plus the top-level files named in the plan.
  // Test files are skipped (they may name the removed features while asserting their absence).
  const TOP_LEVEL = ['README.md', 'index.html', '.env.example', 'package.json', 'vite.config.js', 'eslint.config.js']
  const BANNED = [
    /supabase/i,
    /pglite/i,
    /Visitor ?Wall/,
    /wallStore/,
    /corkboard|drawCork/i,
    /edh\.dev/i,
    /Hinrichsen/,
    /ED-Linux/,
    /Artist in Residence/,
    /paintLogic/,
    /my-art-/,
  ]
  function scanFiles() {
    const files = [...sourceFiles(), ...sourceFiles(abs('scripts')).filter((f) => !/\.test\.[a-z]+$/.test(f))]
    return [...files, ...TOP_LEVEL.map(abs).filter((f) => existsSync(f))]
  }

  // RecycleWise's and Joblog's tech tags name Supabase (their real stack): only that pattern skips projects.js.
  const ALLOWED = new Map([['src/content/projects.js', [String(/supabase/i)]]])

  it('no file under src/, scripts/ or the top-level scan list matches a removed-feature pattern', () => {
    const hits = []
    for (const f of scanFiles()) {
      const text = readFileSync(f, 'utf8')
      for (const re of BANNED) {
        if (ALLOWED.get(rel(f))?.includes(String(re))) continue
        if (re.test(text)) hits.push(`${rel(f)} ${re}`)
      }
    }
    expect(hits).toEqual([])
  })
})

// Round 2 Phase 4 TEST LIST 7: the McGill mug label is set in EB Garamond, loaded by the page's own font link.
describe('round 2 phase 4 structure', () => {
  it('index.html Google Fonts link includes EB Garamond at weight 500', () => {
    const text = readFileSync(abs('index.html'), 'utf8')
    expect(text).toMatch(/fonts\.googleapis\.com\/css2\?[^"]*family=EB\+Garamond:wght@500/)
  })
})
