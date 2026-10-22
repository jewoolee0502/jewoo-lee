// Live prefers-reduced-motion store. The prototype read it once (L433); this
// follows `change` events until dispose().
import { createStore } from './store.js'

const QUERY = '(prefers-reduced-motion: reduce)'

export function createMotion({ matchMedia = globalThis.matchMedia?.bind(globalThis) } = {}) {
  const mql = typeof matchMedia === 'function' ? matchMedia(QUERY) : null
  const store = createStore({ reduce: Boolean(mql?.matches) })
  const onChange = (e) => store.set({ reduce: Boolean(e?.matches ?? mql.matches) })
  if (mql) {
    if (mql.addEventListener) mql.addEventListener('change', onChange)
    else mql.addListener?.(onChange)
  }
  return {
    store,
    reduce: () => store.get().reduce,
    dispose() {
      if (!mql) return
      if (mql.removeEventListener) mql.removeEventListener('change', onChange)
      else mql.removeListener?.(onChange)
    },
  }
}
