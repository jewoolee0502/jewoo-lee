// Safe own-key lookup: never returns inherited Object.prototype members (fix B1).
export function own(map, key) {
  if (map == null) return undefined
  return Object.hasOwn(map, key) ? map[key] : undefined
}
