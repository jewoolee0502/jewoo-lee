// Guards the terminal input: the global :focus-visible outline (tokens.css) must not reach it.
// The .t-in rule loses on stylesheet order unless a focus rule with higher specificity clears it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(process.cwd(), 'src/styles/apps.css'), 'utf8')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }))

describe('styles/apps.css terminal input focus', () => {
  it('a .t-in focus rule removes the outline when the input is focused', () => {
    const focusRule = rules.find((r) => /\.t-in:focus(-visible)?(?![\w-])/.test(r.selector))
    expect(focusRule).toBeDefined()
    expect(focusRule.body).toMatch(/outline:\s*(0|none)\b/)
  })

  // Round 2 Phase 2 TEST LIST item 9: the terminal output lets the page scroll at its edge.
  // Gap B (desktop wheel chaining, plan V15): containment applies to fine pointers only; touch keeps the chaining.
  const FINE = /\(\s*hover\s*:\s*hover\s*\)\s*and\s*\(\s*pointer\s*:\s*fine\s*\)/
  const mediaBlocks = [...css.matchAll(/@media([^{]*)\{((?:[^{}]*\{[^{}]*\})*)\}/g)]
  const fineInner = mediaBlocks.filter((m) => FINE.test(m[1])).map((m) => m[2]).join('\n')
  const otherInner = mediaBlocks.filter((m) => !FINE.test(m[1])).map((m) => m[2]).join('\n')
  const outsideMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*\}/g, '')
  const tOutRules = (text) =>
    [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map((m) => ({ selector: m[1].trim(), body: m[2] }))
      .filter((r) => r.selector.split(',').some((p) => /\.t-out(?![\w-])/.test(p.trim())))

  it('.t-out sets overscroll-behavior-y: contain only inside a (hover:hover) and (pointer:fine) block', () => {
    const inside = tOutRules(fineInner).filter((r) => /overscroll-behavior/.test(r.body))
    expect(inside.length).toBeGreaterThan(0)
    expect(inside.some((r) => /overscroll-behavior-y\s*:\s*contain\b/.test(r.body)), 'contain on the y axis').toBe(true)
  })

  it('.t-out declares no overscroll-behavior outside that fine-pointer block (touch keeps the chaining)', () => {
    for (const text of [outsideMedia, otherInner]) {
      for (const r of tOutRules(text)) expect(r.body, r.selector).not.toMatch(/overscroll-behavior/)
    }
  })

  // Phase 5 TEST LIST item 5: the project window shows the whole screenshot, not a cropped strip.
  const ruleFor = (cls) => rules.filter((r) => r.selector.split(',').some((p) => new RegExp('\\.' + cls + '(?![\\w-])').test(p.trim())))

  it('.shot declares object-fit: contain and never cover', () => {
    const shot = ruleFor('shot')
    expect(shot.length).toBeGreaterThan(0)
    const body = shot.map((r) => r.body).join(';')
    expect(body).toMatch(/object-fit:\s*contain\b/)
    expect(body).not.toMatch(/object-fit:\s*cover/)
  })

  it('.shot no longer caps the height at 250px', () => {
    for (const r of ruleFor('shot')) expect(r.body, r.selector).not.toMatch(/max-height:\s*250px/)
  })

  it('.shot-link is a block link with the pointer cursor', () => {
    const link = ruleFor('shot-link')
    expect(link.length).toBeGreaterThan(0)
    const body = link.map((r) => r.body).join(';')
    expect(body).toMatch(/display:\s*block/)
    expect(body).toMatch(/cursor:\s*pointer\b/)
    expect(body).not.toMatch(/cursor:\s*zoom-in/)
  })

  it('the Projects grid thumbnails still crop to 16:10 with cover', () => {
    const thumb = rules.filter((r) => /^\.pcard img$/.test(r.selector))
    expect(thumb.length).toBeGreaterThan(0)
    expect(thumb.map((r) => r.body).join(';')).toMatch(/object-fit:\s*cover/)
  })
})

// Round 2 §7 6B TEST LIST item 6 (U14): thumbnails take their height from the width, so the
// width/height attributes cannot make them thousands of pixels tall; the Bin item styles live in CSS.
describe('styles/apps.css thumbnails and the Bin item (plan §7 6B)', () => {
  const rulesFor = (selector) => rules.filter((r) => r.selector === selector).map((r) => r.body).join(';')

  it('.pcard img keeps the 16:10 box, crops with cover and takes its height from the width', () => {
    const body = rulesFor('.pcard img')
    expect(body).toMatch(/height:\s*auto/)
    expect(body).toMatch(/aspect-ratio:\s*16\s*\/\s*10/)
    expect(body).toMatch(/object-fit:\s*cover/)
  })

  it('.pcard.bin-item is a flex row that fills the width', () => {
    const body = rulesFor('.pcard.bin-item')
    expect(body).toMatch(/display:\s*flex/)
    expect(body).toMatch(/width:\s*100%/)
  })

  it('.pcard.bin-item img is 110px wide with its height from the width', () => {
    const body = rulesFor('.pcard.bin-item img')
    expect(body).toMatch(/width:\s*110px/)
    expect(body).toMatch(/height:\s*auto/)
  })

  // Guard: any image rule that sets an aspect-ratio must also set height:auto, so a width/height
  // attribute can never win over the ratio. `.pol img` is exempt: About.jsx gives it no attributes.
  it('every img rule with aspect-ratio in apps.css and resume.css also declares height:auto', () => {
    const exempt = new Set(['.pol img'])
    const offenders = []
    for (const file of ['apps.css', 'resume.css']) {
      const text = readFileSync(resolve(process.cwd(), 'src/styles', file), 'utf8')
      for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selectors = m[1].split(',').map((x) => x.trim())
        const isImg = selectors.some((s) => /img$/.test(s) && !exempt.has(s))
        if (isImg && /aspect-ratio\s*:/.test(m[2]) && !/height\s*:\s*auto/.test(m[2])) offenders.push(file + ': ' + m[1].trim())
      }
    }
    expect(offenders).toEqual([])
  })
})
