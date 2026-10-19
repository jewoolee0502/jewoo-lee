// Wallpaper secrets (L575–588). Found secrets live in memory only; the achievement persists.
import { CROSS } from './modes.js'
import { own } from '../core/own.js'

export const SECRETS = {
  moon: ['That’s a bagel now', 'Sesame, Montréal-style. St-Viateur or Fairmount? Choose wisely.'],
  sun: ['Deal with it', 'Even the sun needs shades on a snow day.'],
  cross: ['The Mont-Royal cross', 'The real one changes colour for special occasions too.'],
  wheel: ['Wheee', 'La Grande Roue, on turbo.'],
  boat: ['Toot toot', 'The ferry to Parc Jean-Drapeau, running late as usual.'],
  raccoon: ['Raccoon spotted', 'Mont-Royal’s raccoons are basically locals.'],
  bld: ['Lights out', 'Someone in there was pulling an all-nighter. Now they’re asleep.'],
}

/** L583: the first find of each secret toasts `Secret N · title`; the third distinct one unlocks `local`. */
export function createSecretTracker({ toast, unlock }) {
  const seen = new Set()
  return {
    found(k) {
      const s = own(SECRETS, k)
      if (!s || seen.has(k)) return
      seen.add(k)
      toast('Secret ' + seen.size + ' · ' + s[0], s[1], 'info')
      if (seen.size === 3) unlock('local') // unlock is idempotent; call it once
    },
    get size() {
      return seen.size
    },
  }
}

/** L584–588: what a click on a hot spot does to the animation state. */
export function act(state, hit, { snd, W = 240 } = {}) {
  snd?.tone?.(660, 0.05, 'square', 0.04)
  switch (hit.k) {
    case 'moon':
      state.bagel = !state.bagel
      break
    case 'sun':
      state.shades = !state.shades
      break
    case 'cross':
      state.cross = (state.cross + 1) % CROSS.length
      break
    case 'wheel':
      state.wheelV = 4
      break
    case 'boat':
      state.boatV = 26
      snd?.tone?.(150, 0.35, 'sawtooth', 0.05)
      break
    case 'raccoon':
      state.rac.run = true
      state.rac.dir = state.rac.x > W * 0.3 ? 1 : -1
      break
    case 'bld':
      state.off[hit.i] = !state.off[hit.i]
      break
  }
}
