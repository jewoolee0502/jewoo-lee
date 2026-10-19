// Guards the overflow rule in stage.css: window bodies may only clip (and so stop scrolling)
// while the OS is not live. A bare selector would stop the bodies from scrolling in the
// no-WebGL fallback, where the OS is flat and still interactive.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(process.cwd(), 'src/styles/stage.css'), 'utf8')

describe('styles/stage.css', () => {
  it('overflow hidden on .wb and .t-out is scoped to .os:not(.live) for both selectors', () => {
    expect(css).toContain('.os:not(.live) .wb')
    expect(css).toContain('.os:not(.live) .t-out')
  })

  it('has no bare .t-out overflow hidden rule that applies while the OS is live', () => {
    expect(css).not.toContain(',.t-out{overflow:hidden}')
    // Every rule whose selector targets .t-out with overflow:hidden must be gated by :not(.live).
    const rules = css.split('}').map((r) => r.trim())
    const clipping = rules.filter((r) => /\.t-out[^{]*\{[^}]*overflow:\s*hidden/.test(r + '}'))
    expect(clipping.length).toBeGreaterThan(0)
    for (const rule of clipping) {
      const selector = rule.slice(0, rule.indexOf('{'))
      expect(selector).toContain('.os:not(.live)')
    }
  })
})
