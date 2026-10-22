import { describe, it, expect, vi } from 'vitest'
import { own } from './own.js'

describe('own', () => {
  it('returns an own property value', () => {
    expect(own({ a: 1 }, 'a')).toBe(1)
  })

  it('ignores inherited Object.prototype keys', () => {
    expect(own({}, 'constructor')).toBeUndefined()
    expect(own({}, 'toString')).toBeUndefined()
    expect(own({}, '__proto__')).toBeUndefined()
  })
})
