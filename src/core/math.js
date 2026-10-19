// Small pure math helpers shared by the controller, scene and wallpaper.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/** Smoothstep from a to b (L435). */
export const ss = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** In-out cubic (L1011). */
export const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** In-out quadratic (L1254). */
export const easeQuad = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)

export const lerp = (a, b, t) => a + (b - a) * t
