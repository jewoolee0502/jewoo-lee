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
  it('.t-out does not declare overscroll-behavior', () => {
    const tOut = rules.filter((r) => r.selector.split(',').some((p) => /\.t-out(?![\w-])/.test(p)))
    expect(tOut.length).toBeGreaterThan(0)
    for (const r of tOut) expect(r.body, r.selector).not.toMatch(/overscroll-behavior/)
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
