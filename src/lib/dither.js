// Ordered (Bayer 4×4) dither to a fixed palette: the "90s screen" portrait look (L469–475).

export const PXPAL = [[16, 14, 24], [38, 43, 68], [58, 68, 102], [90, 105, 136], [139, 155, 180], [192, 203, 220], [244, 246, 250], [62, 39, 49], [115, 62, 57], [162, 92, 68], [184, 111, 80], [215, 140, 100], [228, 166, 114], [236, 196, 152], [246, 224, 196], [42, 58, 90]]

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** retroDither(rgba, w, h, pal, strength) -> new Uint8ClampedArray with every pixel snapped to `pal` and alpha 255. */
export function retroDither(data, w, h, pal, strength) {
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < w; i++) {
      const k = (y * w + i) * 4
      const t = (BAYER[(y % 4) * 4 + (i % 4)] / 16 - 0.5) * strength
      const r = data[k] + t
      const g = data[k + 1] + t
      const b = data[k + 2] + t
      let best = pal[0]
      let bd = 1e9
      for (const p of pal) {
        const dd = (r - p[0]) * (r - p[0]) * 0.3 + (g - p[1]) * (g - p[1]) * 0.59 + (b - p[2]) * (b - p[2]) * 0.11
        if (dd < bd) {
          bd = dd
          best = p
        }
      }
      out[k] = best[0]
      out[k + 1] = best[1]
      out[k + 2] = best[2]
      out[k + 3] = 255
    }
  }
  return out
}
