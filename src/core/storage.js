// Safe JSON localStorage access (L436). Never throws: private windows, blocked
// storage and quota errors fall back to the default or are ignored.
export const storage = {
  get(key, fallback) {
    try {
      const v = globalThis.localStorage.getItem(key)
      return v == null ? fallback : JSON.parse(v)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      globalThis.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* ignore */
    }
  },
}
