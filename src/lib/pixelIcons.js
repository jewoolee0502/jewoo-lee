// 12×12 pixel icons (L615–635), encoded with the pure PNG encoder so they work
// without a canvas (SSR and jsdom included).
import { PNG_PREFIX, bytesToBase64, encodeIndexedPng, hexToRgb } from './png.js'

export const PAL = { K: '#122030', W: '#FFFFFF', Y: '#FFD15C', B: '#4AA6EE', R: '#E8452E', G: '#3BB273', O: '#FF8A3D', S: '#B9C3CD', D: '#2A3A4A', P: '#C9A7FF' }

export const BMP = {
  doc: ['KKKKKKKK....', 'KWWWWWWKK...', 'KWWWWWWKWK..', 'KWKKKKWKKKK.', 'KWWWWWWWWWK.', 'KWKKKKKKKWK.', 'KWWWWWWWWWK.', 'KWKKKKKKKWK.', 'KWWWWWWWWWK.', 'KWKKKKKWWWK.', 'KWWWWWWWWWK.', 'KKKKKKKKKKK.'],
  folder: ['............', 'KKKKK.......', 'KYYYYK......', 'KYYYYYKKKKKK', 'KYYYYYYYYYYK', 'KKKKKKKKKKKK', 'KYYYYYYYYYYK', 'KYYYYYYYYYYK', 'KYYYYYYYYYYK', 'KYYYYYYYYYYK', 'KYYYYYYYYYYK', 'KKKKKKKKKKKK'],
  log: ['...KKKKKK...', 'KKKKSSSSKKKK', 'KWWKKKKKKWWK', 'KWWWWWWWWWWK', 'KWBBWKKKKKWK', 'KWWWWWWWWWWK', 'KWBBWKKKKKWK', 'KWWWWWWWWWWK', 'KWBBWKKKKKWK', 'KWWWWWWWWWWK', 'KWWWWWWWWWWK', 'KKKKKKKKKKKK'],
  chest: ['............', '..KKKKKKKK..', '.KOOOOOOOOK.', 'KOOOOOOOOOOK', 'KOOOOOOOOOOK', 'KKKKKYYKKKKK', 'KOOOOYYOOOOK', 'KOOOOKKOOOOK', 'KOOOOOOOOOOK', 'KOOOOOOOOOOK', 'KKKKKKKKKKKK', '............'],
  term: ['KKKKKKKKKKKK', 'KDDDDDDDDDDK', 'KDGDDDDDDDDK', 'KDDGDDDDDDDK', 'KDDDGDDDDDDK', 'KDDGDDDDDDDK', 'KDGDDGGGGDDK', 'KDDDDDDDDDDK', 'KKKKKKKKKKKK', '....KKKK....', '..KKKKKKKK..', '............'],
  bug: ['..K......K..', '...K....K...', '....KKKK....', '...KRRRRK...', 'K.KRRKKRRK.K', '.KKRRRRRRKK.', '..KRKRRKRK..', 'K.KRRRRRRK.K', '.KKRKRRKRKK.', '..KRRRRRRK..', 'K..KRRRRK..K', '....KKKK....'],
  snake: ['............', '..KKKKKKK...', '.KGGGGGGGK..', '.KGKGGGKGK..', '.KGGGGGGGK..', '..KKKGGGK...', '....KGGGK...', '...KGGGK....', '..KGGGK.....', '.KGGGGKKKK..', '.KGGGGGGGGK.', '..KKKKKKKK..'],
  mail: ['............', 'KKKKKKKKKKKK', 'KKWWWWWWWWKK', 'KWKWWWWWWKWK', 'KWWKWWWWKWWK', 'KWWWKWWKWWWK', 'KWWWWKKWWWWK', 'KWWWWWWWWWWK', 'KWWWWWWWWWWK', 'KKKKKKKKKKKK', '............', '............'],
  pdf: ['KKKKKKKK....', 'KWWWWWWKK...', 'KWWWWWWKWK..', 'KWWWWWWKKKK.', 'KWWWWWWWWWK.', 'KRRRRRRRRRK.', 'KRWRWRRWRRK.', 'KRRRRRRRRRK.', 'KWWWWWWWWWK.', 'KWKKKKKKWWK.', 'KWWWWWWWWWK.', 'KKKKKKKKKKK.'],
  tag: ['...KKKKKK...', '..KSSSSSSK..', '.KSSKKSSSSK.', '.KSSKKSSSSK.', '.KSSSSSSSSK.', '.KSKKKKKKSK.', '.KSSSSSSSSK.', '.KSKKKKKSSK.', '.KSSSSSSSSK.', '.KSKKKKSSSK.', '..KSSSSSSK..', '...KKKKKK...'],
  bin: ['....KKKK....', 'KKKKKKKKKKKK', 'KGGGGGGGGGGK', 'KKKKKKKKKKKK', '.KGGGGGGGGK.', '.KGKGGKGGKK.', '.KGKGKGKGKK.', '.KGKGKGKGKK.', '.KGKGKGKGKK.', '.KGKGGKGGKK.', '.KGGGGGGGGK.', '..KKKKKKKK..'],
  display: ['KKKKKKKKKKKK', 'KBBBBBBBBBBK', 'KBBWBBBBBBBK', 'KBBBBBBYYBBK', 'KBBBBBBYYBBK', 'KBGGBBBBBBBK', 'KGGGGBBGGBBK', 'KGGGGGGGGGGK', 'KKKKKKKKKKKK', '....KKKK....', '..KKKKKKKK..', '............'],
  trophy: ['KKKKKKKKKKKK', 'KYKYYYYYYKYK', 'KYKYYYYYYKYK', '.KKYYYYYYKK.', '...KYYYYK...', '....KYYK....', '.....KK.....', '.....KK.....', '....KYYK....', '...KKKKKK...', '...KYYYYK...', '...KKKKKK...'],
}

const KEYS = Object.keys(PAL)
const INDEX = new Map(KEYS.map((k, i) => [k, i + 1]))
const PALETTE = [[0, 0, 0], ...KEYS.map((k) => hexToRgb(PAL[k]))]
const ALPHA = [0, ...KEYS.map(() => 255)]

/** Encodes a 12-row bitmap of PAL letters ('.' is transparent) as a PNG data URL. */
export function bitmapToDataUrl(rows) {
  const size = 12
  const indices = new Uint8Array(size * size)
  rows.forEach((row, j) => {
    for (let i = 0; i < size; i++) indices[j * size + i] = INDEX.get(row[i]) || 0
  })
  return PNG_PREFIX + bytesToBase64(encodeIndexedPng({ width: size, height: size, indices, palette: PALETTE, alpha: ALPHA }))
}

export const ICON = Object.fromEntries(Object.entries(BMP).map(([k, rows]) => [k, bitmapToDataUrl(rows)]))
