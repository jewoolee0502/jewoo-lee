// Wallpaper choice, in memory only (D14: Auto on every load, never persisted).
import { createStore } from '../core/store.js'
import { autoWp, isMode } from './modes.js'

export const AUTO_REFRESH_MS = 60000

export function createWallpaperStore({ now = () => new Date() } = {}) {
  const store = createStore({ choice: 'auto', mode: autoWp(now()) })

  const current = (date = now()) => {
    const { choice } = store.get()
    return choice === 'auto' ? autoWp(date) : choice
  }

  function setChoice(k) {
    if (k !== 'auto' && !isMode(k)) return false
    store.set({ choice: k })
    store.set({ mode: current() })
    return true
  }

  /** Re-resolves the auto mode; subscribers hear about it when the mode changes. */
  function refresh() {
    store.set({ mode: current() })
  }

  /** Starts the 60 s auto refresh (L612) on a timers group; returns the stop function. */
  function start(timers) {
    return timers.interval(() => {
      if (store.get().choice === 'auto') refresh()
    }, AUTO_REFRESH_MS)
  }

  return { store, setChoice, current, refresh, start }
}
