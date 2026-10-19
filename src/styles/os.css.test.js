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
})
