import { describe, it, expect } from 'vitest'
import { dynApp, lookupApp, registry } from './registry.js'

describe('dynApp', () => {
  it('rejects project indexes with leading zeros', () => {
    expect(dynApp('p:01')).toBeNull()
  })

  it('still resolves a plain project index', () => {
    expect(dynApp('p:1')).toMatchObject({ title: expect.any(String), w: 600, h: 540 })
  })

  it('no longer resolves art:<n> saved drawings', () => {
    expect(dynApp('art:0')).toBeNull()
    expect(dynApp('art:0', ['data:image/png;base64,QQ=='])).toBeNull()
  })
})

describe('lookupApp', () => {
  it('returns null for the removed Paint and Visitor Wall ids', () => {
    expect(lookupApp(registry, 'paint')).toBeNull()
    expect(lookupApp(registry, 'wall')).toBeNull()
  })

  it('still resolves the remaining registry entries and project ids', () => {
    expect(lookupApp(registry, 'snake')).not.toBeNull()
    expect(lookupApp(registry, 'p:0')).toMatchObject({ title: 'RecycleWise' })
  })
})
