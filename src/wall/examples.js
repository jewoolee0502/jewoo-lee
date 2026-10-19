// The three example drawings (L768–770): 12×12 on white, shown only while nothing is approved (D16).
import { gridToPngDataUrl } from '../lib/png.js'
import { PAL } from '../lib/pixelIcons.js'

const SIZE = 12
const WHITE = '#FFFFFF'

const ROWS = [
  ['............', '..RR...RR...', '.RRRR.RRRR..', '.RRRRRRRRR..', '.RRRRRRRRR..', '..RRRRRRR...', '...RRRRR....', '....RRR.....', '.....R......', '............', '............', '............'],
  ['............', '.....B......', '..B..B..B...', '...B.B.B....', '....BBB.....', '.BBBBBBBBB..', '....BBB.....', '...B.B.B....', '..B..B..B...', '.....B......', '............', '............'],
  ['............', '...YYYYY....', '..YYYYYYY...', '.YYKYYYKYY..', '.YYYYYYYYY..', '.YYYYYYYYY..', '.YKYYYYYKY..', '.YYKKKKKYY..', '..YYYYYYY...', '...YYYYY....', '............', '............'],
]

const PALETTE = [WHITE, ...new Set(Object.values(PAL).filter((c) => c !== WHITE))]

function toDataUrl(rows) {
  const grid = []
  for (const row of rows) for (let i = 0; i < SIZE; i++) grid.push(PAL[row[i]] ?? WHITE)
  return gridToPngDataUrl(grid, SIZE, PALETTE)
}

export const EXAMPLES = Object.freeze(ROWS.map(toDataUrl))
