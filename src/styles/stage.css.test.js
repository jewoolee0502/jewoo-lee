// Guards the overflow rule in stage.css: window bodies may only clip (and so stop scrolling)
// while the OS is not live. A bare selector would stop the bodies from scrolling in the
// no-WebGL fallback, where the OS is flat and still interactive.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
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

  // Phase 6A (plan-r2 section 7, U1–U3): mandatory snapping exists only with the rail (html.runway-snap),
  // the glide suspends it (snap-hold), and the only snap areas are the rail's markers and #resume-root.
  describe('snap rules (phase 6A)', () => {
    const styleDir = resolve(process.cwd(), 'src/styles')
    const styleFiles = readdirSync(styleDir).filter((f) => f.endsWith('.css'))
    const allRules = styleFiles.flatMap((f) => {
      const text = readFileSync(resolve(styleDir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      return text
        .split('}')
        .map((chunk) => {
          const i = chunk.lastIndexOf('{')
          return i < 0 ? null : { file: f, selector: chunk.slice(0, i).replace(/\s+/g, ' ').trim(), body: chunk.slice(i + 1) }
        })
        .filter(Boolean)
    })
    const norm = (sel) => sel.replace(/\s+/g, '')

    it('html.runway-snap is mandatory y snapping, and html.runway-snap.snap-hold turns it off', () => {
      expect(body(css, 'html.runway-snap')).toMatch(/scroll-snap-type:\s*y mandatory/)
      expect(body(css, 'html.runway-snap.snap-hold')).toMatch(/scroll-snap-type:\s*none/)
    })

    it('the rail is an absolute, click-through strip; its markers are snap points and the plateau marker is always-stop', () => {
      expect(body(css, '.snap-rail')).toMatch(/position:\s*absolute/)
      expect(body(css, '.snap-rail')).toMatch(/pointer-events:\s*none/)
      expect(body(css, '.snap-rail>i')).toMatch(/scroll-snap-align:\s*start/)
      expect(body(css, '.snap-rail>i.stop')).toMatch(/scroll-snap-stop:\s*always/)
    })

    it('#resume-root is a snap area only under html.runway-snap, so the résumé scrolls freely', () => {
      expect(body(css, 'html.runway-snap #resume-root')).toMatch(/scroll-snap-align:\s*start/)
      expect(body(css, '#resume-root')).not.toMatch(/scroll-snap-align/)
    })

    it('every rule that declares scroll-snap-type is gated by html.runway-snap, in every stylesheet', () => {
      const rules = allRules.filter((r) => /scroll-snap-type\s*:/.test(r.body))
      expect(rules.length).toBeGreaterThan(0)
      for (const r of rules) expect(norm(r.selector).startsWith('html.runway-snap'), `${r.file}: ${r.selector}`).toBe(true)
    })

    it('the only scroll-snap-align rules are the rail markers and #resume-root under runway-snap', () => {
      const allowed = ['.snap-rail>i', 'html.runway-snap#resume-root']
      for (const r of allRules.filter((r) => /scroll-snap-align\s*:/.test(r.body))) {
        expect(allowed, `${r.file}: ${r.selector}`).toContain(norm(r.selector))
      }
    })

    it('no stylesheet declares scroll-behavior (the page scrolls only by the glide and the native rules)', () => {
      for (const f of styleFiles) {
        expect(readFileSync(resolve(styleDir, f), 'utf8'), f).not.toMatch(/scroll-behavior\s*:/)
      }
    })
  })
})

// Round 2 §7 6B TEST LIST item 4 (U11): the no-WebGL layout is a grid, a top bar (notice + HUD) over the OS.
describe('styles/stage.css no-WebGL top bar (plan §7 6B)', () => {
  const bodiesOf = (selector) => {
    const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return [...css.matchAll(new RegExp('(?:^|[};\\n])\\s*' + esc + '\\s*\\{([^}]*)\\}', 'g'))].map((m) => m[1]).join(';')
  }
  const mediaBlocks600 = [...css.matchAll(/@media\s*\(max-width:\s*600px\)\s*\{((?:[^{}]*\{[^{}]*\})*)\}/g)].map((m) => m[1])

  it('.track.flat-runway .stage is a grid whose areas are a note and HUD row over the OS row', () => {
    const grid = bodiesOf('.track.flat-runway .stage')
    expect(grid).toMatch(/display:\s*grid/)
    expect(grid).toMatch(/grid-template-areas:\s*"note hud"\s+"os os"/)
  })

  it('.track.flat-runway .hud is static inside the grid, in the hud area', () => {
    const hud = bodiesOf('.track.flat-runway .hud')
    expect(hud).toMatch(/position:\s*static/)
    expect(hud).toMatch(/grid-area:\s*hud/)
  })

  it('.track.flat-runway .flat-host is in-flow (relative) in the os area and stacks above the scene', () => {
    const host = bodiesOf('.track.flat-runway .flat-host')
    expect(host).toMatch(/position:\s*relative/)
    expect(host).toMatch(/grid-area:\s*os/)
  })

  it('.fallback-note is a grid item in the note area and declares no position', () => {
    const note = bodiesOf('.fallback-note')
    expect(note).toMatch(/grid-area:\s*note/)
    expect(note).not.toMatch(/position\s*:/)
  })

  it('the 600px block stacks the HUD row first, then the note, then the OS', () => {
    const stacked = mediaBlocks600.some((block) => {
      const m = block.match(/\.track\.flat-runway \.stage\{([^}]*)\}/)
      return Boolean(m) && /grid-template-areas:\s*"hud"\s+"note"\s+"os"/.test(m[1])
    })
    expect(stacked).toBe(true)
  })
})
