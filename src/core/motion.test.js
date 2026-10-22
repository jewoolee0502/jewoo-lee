import { describe, it, expect, vi, afterEach } from 'vitest'
import { createMotion } from './motion.js'
import { setReducedMotion } from '../test/setup.js'

describe('createMotion', () => {
  afterEach(() => {
    setReducedMotion(false)
  })

  it('the initial value follows matchMedia', () => {
    setReducedMotion(true)

    const motion = createMotion()

    expect(motion.store.get().reduce).toBe(true)
    motion.dispose()
  })

  it('setReducedMotion(true) updates the store', () => {
    const motion = createMotion()
    expect(motion.store.get().reduce).toBe(false)

    setReducedMotion(true)

    expect(motion.store.get().reduce).toBe(true)
    motion.dispose()
  })

  it('dispose removes the listener, so later changes are ignored', () => {
    const motion = createMotion()
    motion.dispose()

    setReducedMotion(true)

    expect(motion.store.get().reduce).toBe(false)
  })
})
