// Phase 3 TEST LIST: stage/structure.test.js. Reads files with node:fs.
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
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
