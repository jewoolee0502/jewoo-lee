import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { act, render, screen } from '@testing-library/react'
import { createStore, useStore } from './store.js'

describe('createStore', () => {
  it('set notifies subscribers', () => {
    const store = createStore({ a: 1, b: 2 })
    const listener = vi.fn()
    store.subscribe(listener)

    store.set({ a: 2 })

    expect(listener).toHaveBeenCalled()
    expect(store.get().a).toBe(2)
  })

  it('setting identical values does not notify', () => {
    const store = createStore({ a: 1, b: 2 })
    const listener = vi.fn()
    store.subscribe(listener)

    store.set({ a: 1 })

    expect(listener).not.toHaveBeenCalled()
  })

  it('unsubscribe stops notifications', () => {
    const store = createStore({ a: 1 })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    unsubscribe()
    store.set({ a: 2 })

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('useStore', () => {
  it('re-renders only when the selected slice changes', () => {
    const store = createStore({ a: 1, b: 2 })
    const onRender = vi.fn()

    function Probe() {
      onRender()
      const a = useStore(store, (s) => s.a)
      return createElement('span', null, String(a))
    }

    render(createElement(Probe))
    expect(onRender).toHaveBeenCalledTimes(1)

    act(() => {
      store.set({ b: 3 })
    })
    expect(onRender).toHaveBeenCalledTimes(1)

    act(() => {
      store.set({ a: 5 })
    })
    expect(onRender).toHaveBeenCalledTimes(2)
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
