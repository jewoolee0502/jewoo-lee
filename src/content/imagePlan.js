// Responsive image plan shared by scripts/optimize-images.mjs and the components (R15).
// Pure and browser-safe: no node: imports.

/** Widths written for each project screenshot (never wider than the original). */
export const WIDTHS = [640, 1280, 1920]

/** The planned widths up to `naturalW`, or just `[naturalW]` when it is below the smallest one. */
export function planWidths(naturalW, widths = WIDTHS) {
  const fit = widths.filter((w) => w <= naturalW)
  return fit.length ? fit : [naturalW]
}

/** `[[width, url], …]` → `"url 640w, url 1280w"`. */
export const srcSetFrom = (files) => files.map(([w, url]) => `${url} ${w}w`).join(', ')

// Layout widths in OS px: the project window's image (600 px window, 18 px padding, 2 px border)
// and a Projects grid card. `sizes` ignores CSS transforms, so the flat OS scale is folded in.
const LAYOUT = {
  shot: { px: 560, compact: 'calc(100vw - 52px)' },
  thumb: { px: 200, compact: 'calc(50vw - 30px)' },
}

/** The `sizes` value for a `shot` or `thumb` image at the OS scale (CSS px). */
export function sizesFor(kind, { compact = false, scale = 1 } = {}) {
  const l = LAYOUT[kind]
  return compact ? l.compact : `${Math.ceil(l.px * scale)}px`
}
