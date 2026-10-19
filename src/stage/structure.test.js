// Phase 3 TEST LIST: stage/structure.test.js. Reads files with node:fs.
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Vitest runs from the project root (vite.config.js sits there).
const root = process.cwd()
const abs = (rel) => resolve(root, rel)

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

  // Non-test source files under src/ (test files may mock or name the banned packages).
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

  it('@supabase/supabase-js is imported only by src/wall/supabaseWallClient.js', () => {
    expect(filesImporting(/['"]@supabase\/supabase-js['"]/)).toEqual(['src/wall/supabaseWallClient.js'])
  })
})
