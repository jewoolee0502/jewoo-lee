// Round 3 Phase R3-2 TEST LIST: styles/views.css (plan-r3 V1, V9, V13). The two views are CSS
// switches on <html data-view>: the laptop view hides #resume-root, the résumé view hides #app,
// the way back is pinned in the corner, and the veil fades in its destination's background.
// Round 3 Phase R3-3 TEST LIST (plan-r3 V18): the print block shows the résumé from either view,
// placed after the laptop rule it overrides.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Comments are dropped first, so a comment above a rule is not read as part of its selector.
const css = readFileSync(resolve(process.cwd(), 'src/styles/views.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// Drops the `@media print { … }` block, so the screen rules are checked on their own.
function withoutPrint(text) {
  const at = text.indexOf('@media print')
  if (at < 0) return text
  let depth = 0
  for (let i = text.indexOf('{', at); i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return text.slice(0, at) + text.slice(i + 1)
  }
  return text.slice(0, at)
}

// Every flat rule as { selectors, body }, with quotes and whitespace normalised so that
// [data-view="laptop"] and [data-view=laptop] compare equal.
const norm = (s) => s.replace(/["']/g, '').replace(/\s+/g, ' ').trim()
function rulesOf(text) {
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1].trim().split(',').map(norm),
    body: m[2],
  }))
}
/** The declarations of every rule whose selector list names `selector`, joined. */
function declarations(selector, text = css) {
  const want = norm(selector)
  return rulesOf(text)
    .filter((r) => r.selectors.includes(want))
    .map((r) => r.body)
    .join(';')
}

const screen = withoutPrint(css)

// The inside of the `@media print { … }` block (empty when there is none).
function printBlock(text) {
  const at = text.indexOf('@media print')
  if (at < 0) return ''
  const open = text.indexOf('{', at)
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i)
  }
  return ''
}
const print = printBlock(css)

describe('styles/views.css', () => {
  it('the laptop view hides the résumé root', () => {
    expect(declarations('html[data-view="laptop"] #resume-root')).toMatch(/display:\s*none/)
  })

  it('the résumé view hides the app and the skip link', () => {
    expect(declarations('html[data-view="resume"] #app')).toMatch(/display:\s*none/)
    expect(declarations('html[data-view="resume"] .skip')).toMatch(/display:\s*none/)
  })

  it('the laptop view paints the page in the scene colour', () => {
    expect(declarations('html[data-view="laptop"] body')).toMatch(/background:\s*var\(--scene\)/)
  })

  it('the way back is hidden by default and fixed in the top-left corner only in the résumé view (V13)', () => {
    expect(declarations('.r-back')).toMatch(/display:\s*none/)
    const shown = declarations('html[data-view="resume"] .r-back')
    expect(shown).toMatch(/display:\s*inline-flex/)
    expect(shown).toMatch(/position:\s*fixed/)
    expect(shown).toMatch(/top:\s*max\(12px,\s*env\(safe-area-inset-top/)
    expect(shown).toMatch(/left:\s*max\(12px,\s*env\(safe-area-inset-left/)
  })

  it('the résumé view clears the way back above the header, and resume.css sets no other top padding for .r-head in a media query', () => {
    expect(declarations('html[data-view="resume"] .r-head')).toMatch(/padding-top:\s*max\(72px,\s*calc\(max\(12px,\s*env\(safe-area-inset-top/)
    const resumeCss = readFileSync(resolve(process.cwd(), 'src/styles/resume.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const media = [...resumeCss.matchAll(/@media[^{]*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)].map((m) => m[1]).join('')
    const overrides = rulesOf(media).filter((r) => r.selectors.includes('.r-head') && /padding(-top|-block)?\s*:/.test(r.body))
    expect(overrides).toEqual([])
  })

  it('the veil is a fixed, transparent, click-through layer that fades over .15 s (V9)', () => {
    const veilRule = declarations('.view-veil')
    expect(veilRule).toMatch(/position:\s*fixed/)
    expect(veilRule).toMatch(/opacity:\s*0(?![.\d])/)
    expect(veilRule).toMatch(/pointer-events:\s*none/)
    expect(veilRule).toMatch(/transition:[^;]*opacity\s+(\.15s|150ms)/)
  })

  it('the veil shows fully when it is on', () => {
    expect(declarations('.view-veil.on')).toMatch(/opacity:\s*1(?![.\d])/)
  })

  it('the veil takes the résumé background when it fades toward the résumé', () => {
    expect(declarations('.view-veil[data-to="resume"]')).toMatch(/background:\s*var\(--bg\)/)
  })

  it('no rule outside @media print shows #resume-root unconditionally', () => {
    const unconditional = rulesOf(screen).filter(
      (r) => r.selectors.includes('#resume-root') && /display:\s*(?!none)/.test(r.body),
    )
    expect(unconditional).toEqual([])
  })
})

// Round 3 Phase R3-3 TEST LIST (plan-r3 V18): print shows the résumé, without the scene, the way back
// or the veil.
describe('styles/views.css print (V18)', () => {
  it('the print block exists', () => {
    expect(print.trim()).not.toBe('')
  })

  it('print shows #resume-root', () => {
    expect(declarations('html[data-view] #resume-root', print)).toMatch(/display:\s*block/)
  })

  it('print hides the app (the scene) from either view', () => {
    expect(declarations('html[data-view] #app', print)).toMatch(/display:\s*none/)
  })

  // Same specificity as the screen rule, so it must come later in the file to win.
  it('the print block comes after the laptop view rule that hides #resume-root (cascade order)', () => {
    const hide = css.indexOf('html[data-view="laptop"] #resume-root')
    expect(hide).toBeGreaterThanOrEqual(0)
    expect(css.indexOf('@media print')).toBeGreaterThan(hide)
  })

  it('print hides the way back and the veil', () => {
    expect(declarations('.r-back', print)).toMatch(/display:\s*none/)
    expect(declarations('.view-veil', print)).toMatch(/display:\s*none/)
  })
})
