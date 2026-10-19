// Guards the overflow rule in stage.css: window bodies may only clip (and so stop scrolling)
// while the OS is not live. A bare selector would stop the bodies from scrolling in the
// no-WebGL fallback, where the OS is flat and still interactive.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RUNWAY, TRACK_VH } from '../core/constants.js'

const css = readFileSync(resolve(process.cwd(), 'src/styles/stage.css'), 'utf8')
const tokens = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')
const resumeCss = readFileSync(resolve(process.cwd(), 'src/styles/resume.css'), 'utf8')
// Round 2 Phase 2 TEST LIST item 9: the runway is a CSS variable, the trap is gone, and the exit pill is css-only.
const body = (text, selector) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Anchored to the start of a rule, so `.stage.zoomed .exit-pill{` does not match `.exit-pill{`.
  return text.match(new RegExp('(?:^|[};\\n])\\s*' + esc + '\\s*\\{([^}]*)\\}'))?.[1] ?? ''
}

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

  it('the track is var(--track-h) and tokens.css sets --track-h to 290vh, equal to TRACK_VH and the runway sum', () => {
    expect(body(css, '.track')).toMatch(/height:\s*var\(--track-h\)/)
    expect(tokens).toMatch(/--track-h:\s*290vh/)
    expect(TRACK_VH).toBe(290)
    expect(TRACK_VH).toBeCloseTo(100 * (1 + Object.values(RUNWAY).reduce((a, b) => a + b, 0)), 6)
  })

  it('the no-WebGL runway collapses: .track.flat-runway is height auto, and its stage is not sticky', () => {
    expect(body(css, '.track.flat-runway')).toMatch(/height:\s*auto/)
    expect(css).toMatch(/\.track\.flat-runway\s+\.stage\s*\{[^}]*position:\s*relative/)
  })

  it('the résumé placeholder reserves the same runway: #app:empty uses var(--track-h)', () => {
    expect(body(resumeCss, '#app:empty')).toMatch(/height:\s*var\(--track-h\)/)
  })

  it('has no touch trap rule (.trap is gone with the wheel hijack)', () => {
    expect(css).not.toMatch(/\.trap\b/)
  })

  it('the exit pill is hidden by default and shown only while the stage is zoomed', () => {
    expect(body(css, '.exit-pill')).toMatch(/display:\s*none/)
    expect(body(css, '.stage.zoomed .exit-pill')).toMatch(/display:\s*inline-flex/)
  })

  // Round 3 TEST LIST 6 (HUD): below half visible (--hud < .5) the HUD cannot be clicked; the stage
  // gets .hud-dim from createApp's setHud, and this rule turns the pointer off for the HUD.
  it('.stage.hud-dim .hud has pointer-events none, so a faded HUD cannot take clicks', () => {
    expect(body(css, '.stage.hud-dim .hud')).toMatch(/pointer-events:\s*none/)
  })
})
