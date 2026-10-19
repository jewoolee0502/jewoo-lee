import { describe, it, expect } from 'vitest'
import { dynApp } from './registry.js'

describe('dynApp', () => {
  it('rejects project indexes with leading zeros', () => {
    expect(dynApp('p:01')).toBeNull()
  })

  it('still resolves a plain project index', () => {
    expect(dynApp('p:1')).toMatchObject({ title: expect.any(String), w: 600, h: 540 })
  })
})
