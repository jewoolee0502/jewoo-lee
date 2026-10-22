import { describe, it, expect, vi } from 'vitest'
import { storage } from './storage.js'

describe('storage.get', () => {
  it('returns the default when the key is missing', () => {
    expect(storage.get('missing-key', ['fallback'])).toEqual(['fallback'])
  })

  it('returns the default when the stored JSON is invalid', () => {
    localStorage.setItem('bad-json', '{not json')
    expect(storage.get('bad-json', 7)).toBe(7)
  })
})

describe('storage.set', () => {
  it('swallows an exception from localStorage.setItem', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => storage.set('k', { a: 1 })).not.toThrow()
  })
})
