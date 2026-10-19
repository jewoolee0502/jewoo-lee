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
})
