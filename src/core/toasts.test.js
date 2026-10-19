import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createToasts } from './toasts.js'

describe('createToasts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('a toast appears with its fields', () => {
    const toasts = createToasts()

    toasts.toast('Saved', 'Your drawing was saved', 'ok')

    const list = toasts.store.get().list
    expect(list).toHaveLength(1)
    expect(list[0]).toEqual({
      id: expect.anything(),
      title: 'Saved',
      body: 'Your drawing was saved',
      kind: 'ok',
      fading: false,
    })
  })

  it('starts fading at 3200 ms and is removed at 3600 ms', () => {
    const toasts = createToasts()
    toasts.toast('Title', 'Body')

    vi.advanceTimersByTime(3199)
    expect(toasts.store.get().list[0].fading).toBe(false)

    vi.advanceTimersByTime(1)
    expect(toasts.store.get().list[0].fading).toBe(true)

    vi.advanceTimersByTime(399)
    expect(toasts.store.get().list).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(toasts.store.get().list).toHaveLength(0)
  })
})
