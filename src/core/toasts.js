// Toast list store (L653–654): a toast fades after 3200 ms and is removed at 3600 ms.
import { createStore } from './store.js'
import { createTimers } from './timers.js'

export const TOAST_FADE_MS = 3200
export const TOAST_REMOVE_MS = 3600

export function createToasts({ timers = createTimers() } = {}) {
  const store = createStore({ list: [] })
  let nextId = 1

  function patch(id, fields) {
    store.set((s) => ({ list: s.list.map((t) => (t.id === id ? { ...t, ...fields } : t)) }))
  }

  function toast(title, body, kind) {
    const id = nextId++
    store.set((s) => ({ list: [...s.list, { id, title, body, kind, fading: false }] }))
    timers.timeout(() => patch(id, { fading: true }), TOAST_FADE_MS)
    timers.timeout(() => store.set((s) => ({ list: s.list.filter((t) => t.id !== id) })), TOAST_REMOVE_MS)
    return id
  }

  return { store, toast }
}
