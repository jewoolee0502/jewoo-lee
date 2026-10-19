// Guards the desktop icon columns: long labels such as EXPERIENCE.LOG must not clip at the screen edge.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(process.cwd(), 'src/styles/os.css'), 'utf8')
const ruleBody = (selector) => {
  const escaped = selector.replace(/\./g, '\\.')
  return css.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'))?.[1] ?? ''
}

describe('styles/os.css desktop icon columns', () => {
  it('the left column keeps at least 16px from the left edge', () => {
    const left = ruleBody('.icons.l').match(/left:\s*(-?\d+(?:\.\d+)?)px/)
    expect(left).not.toBeNull()
    expect(Number(left[1])).toBeGreaterThanOrEqual(16)
  })

  it('the right column keeps at least 16px from the right edge', () => {
    const right = ruleBody('.icons.r').match(/right:\s*(-?\d+(?:\.\d+)?)px/)
    expect(right).not.toBeNull()
    expect(Number(right[1])).toBeGreaterThanOrEqual(16)
  })

  // Round 2 Phase 2 TEST LIST item 9: the window bodies let the page scroll (no overscroll containment).
  const rulesMentioning = (text, cls) =>
    [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map((m) => ({ selector: m[1].trim(), body: m[2] }))
      .filter((r) => r.selector.split(',').some((part) => new RegExp(cls.replace('.', '\\.') + '(?![\\w-])').test(part)))

  it('.wb does not declare overscroll-behavior, so the page scrolls when a window reaches its edge', () => {
    const rules = rulesMentioning(css, '.wb')
    expect(rules.length).toBeGreaterThan(0)
    for (const r of rules) expect(r.body, r.selector).not.toMatch(/overscroll-behavior/)
  })

  // The menubar sound button is hidden on phones (compact) and in the no-WebGL fallback, and kept
  // in the desktop flat inside view (.os.flat).
  it('#mb-snd is hidden under .os.compact and .os.fallback, and no rule hides it under plain .os.flat', () => {
    const hidingSelectors = [...css.matchAll(/([^{}]+)\{([^{}]*display:\s*none[^{}]*)\}/g)]
      .flatMap((m) => m[1].split(',').map((s) => s.trim()))
      .filter((sel) => sel.includes('#mb-snd'))
    expect(hidingSelectors.some((sel) => /\.os\.compact\s+#mb-snd(?![\w-])/.test(sel))).toBe(true)
    expect(hidingSelectors.some((sel) => /\.os\.fallback\s+#mb-snd(?![\w-])/.test(sel))).toBe(true)
    for (const sel of hidingSelectors) expect(sel, sel).toMatch(/\.os\.(compact|fallback)\s+#mb-snd/)
    expect(css).not.toMatch(/\.os\.flat\s+#mb-snd/)
  })
})

// Round 2 Phase 3 TEST LIST 3 (R-vignette): the vignette fades in and out instead of popping when the OS goes live.
describe('styles/os.css vignette transition', () => {
  // Round 3: the base vignette has no transition, so the scroll-driven --vig tracks the scroll at once.
  it('the base .os::after has no opacity transition (transition none or absent)', () => {
    const body = ruleBody('.os::after')
    expect(body).not.toMatch(/transition:[^;]*opacity/)
  })

  it('the opacity transition lives on .os.live::after, the rule that fades the vignette out when the OS goes live', () => {
    expect(ruleBody('.os.live::after')).toMatch(/transition:[^;]*opacity/)
  })

  it('.os.live::after sets opacity 0 and does not use display: none, so the fade can run', () => {
    const body = ruleBody('.os.live::after')
    expect(body).toMatch(/opacity:\s*0(?![\d.])/)
    expect(body).not.toMatch(/display:\s*none/)
  })

  it('a reduced-motion block turns the vignette transition off', () => {
    const idx = css.indexOf('prefers-reduced-motion')
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(css.slice(idx)).toMatch(/\.os::after\s*\{[^}]*transition:\s*none/)
  })
})

// Round 3 TEST LIST 2 (phone menubar): at compact width the menubar must not truncate the clock.
describe('styles/os.css phone menubar', () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1].split(',').map((x) => x.trim()),
    body: m[2],
  }))
  const hides = (selector) =>
    rules.some((r) => r.selectors.includes(selector) && /display:\s*none/.test(r.body))

  it('under .os.compact the secondary (SEL) clock is hidden', () => {
    expect(hides('.os.compact .mb-sel')).toBe(true)
  })

  it('the SEL clock element carries the mb-sel class that the compact rule targets', () => {
    const jsx = readFileSync(resolve(process.cwd(), 'src/os/MenuBar.jsx'), 'utf8')
    expect(jsx).toMatch(/className="mb-sel"/)
  })

  it('the menubar does not wrap its items: .menubar sets white-space nowrap', () => {
    expect(ruleBody('.menubar')).toMatch(/white-space:\s*nowrap/)
  })
})
