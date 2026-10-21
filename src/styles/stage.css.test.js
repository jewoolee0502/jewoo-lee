// Guards the overflow rule in stage.css: window bodies may only clip (and so stop scrolling)
// while the OS is not live. A bare selector would stop the bodies from scrolling in the
// no-WebGL fallback, where the OS is flat and still interactive.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { TRACK_VH, PLATEAU_PX, OS_W, OS_H } from '../core/constants.js'

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

  it('the track is var(--track-h), and tokens.css sets --track-h to the dive plus the 120 px plateau (TRACK_VH 200, PLATEAU_PX 120)', () => {
    expect(body(css, '.track')).toMatch(/height:\s*var\(--track-h\)/)
    expect(tokens).toMatch(/--track-h:\s*calc\(200vh \+ 120px\)/)
    expect(TRACK_VH).toBe(200)
    expect(PLATEAU_PX).toBe(120)
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

  // Round 3 Phase R3-1 (plan-r3 V4): nothing in the stylesheets snaps the page or scripts its scroll.
  describe('no snapping and no scripted scroll (round 3)', () => {
    const styleDir = resolve(process.cwd(), 'src/styles')
    const styleFiles = readdirSync(styleDir).filter((f) => f.endsWith('.css'))
    const withoutComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '')

    it('no declaration in any stylesheet matches scroll-snap-', () => {
      for (const f of styleFiles) {
        expect(withoutComments(readFileSync(resolve(styleDir, f), 'utf8')), f).not.toMatch(/scroll-snap-/)
      }
    })

    it('no stylesheet declares scroll-behavior (the page scrolls only by the glide and the native rules)', () => {
      for (const f of styleFiles) {
        expect(withoutComments(readFileSync(resolve(styleDir, f), 'utf8')), f).not.toMatch(/scroll-behavior\s*:/)
      }
    })
  })
})

// Round 4 R4-1 (plan §3): the CSS3D holder is sized to the OS, so the drawn mirror and the DOM agree.
describe('styles/stage.css OS holder size (R4-1)', () => {
  it('#os-holder is OS_W × OS_H (1040px × 676px)', () => {
    const holder = body(css, '#os-holder')
    expect(holder).toMatch(new RegExp(`width:\\s*${OS_W}px`))
    expect(holder).toMatch(new RegExp(`height:\\s*${OS_H}px`))
    expect(holder).toMatch(/width:\s*1040px/)
    expect(holder).toMatch(/height:\s*676px/)
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
