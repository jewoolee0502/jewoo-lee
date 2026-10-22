// Tiny external store read by React through useSyncExternalStore (D5).
import { useSyncExternalStore } from 'react'

function shallowSame(state, partial) {
  for (const k of Object.keys(partial)) {
    if (!Object.is(state[k], partial[k])) return false
  }
  return true
}

/**
 * createStore(initial) -> { get, set(partial | fn), subscribe(fn) -> unsubscribe, initial }
 * `set` merges a partial object (or the result of fn(state)) and notifies only
 * when a shallow comparison finds a change.
 */
export function createStore(initial) {
  let state = initial
  const listeners = new Set()
  return {
    initial,
    get: () => state,
    set(next) {
      const partial = typeof next === 'function' ? next(state) : next
      if (!partial || shallowSame(state, partial)) return
      state = { ...state, ...partial }
      for (const fn of [...listeners]) fn(state)
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}

const identity = (s) => s

/** Subscribes a component to `selector(store.get())`; re-renders only when that slice changes. */
export function useStore(store, selector = identity, getServerSnapshot) {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    getServerSnapshot ?? (() => selector(store.initial)),
  )
}
