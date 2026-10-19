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
