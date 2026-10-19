// Achievements (L655–664). Only `jayos-ach` is persisted (D14).
import { createStore } from './store.js'
import { storage as defaultStorage } from './storage.js'

export const ACH_KEY = 'jayos-ach'

export const ACH = [
  ['boot', 'Power User', 'Boot JAY-OS', 'term'],
  ['floppy', 'Floppy Handler', 'Slide a floppy disk into the drive', 'folder'],
  ['term', 'Hacker Voice', 'Run any command in the terminal', 'term'],
  ['neofetch', 'Show-off', 'Run neofetch', 'doc'],
  ['hire', 'sudo make me an offer', 'Find the command that hires Jay', 'pdf'],
  ['bugs', 'Exterminator', 'Squash 10 bugs in one round of BugHunt', 'bug'],
  ['snake', 'Ssssskills', 'Eat 5 skills in Snake', 'snake'],
  ['tags', 'Once a Marine', 'Find Jay’s dog tags', 'tag'],
  ['lamp', 'Night Owl', 'Turn off the desk lamp', 'trophy'],
  ['konami', 'Cheat Code', 'An old cheat code works here. Try it with arrow keys.', 'trophy'],
  ['shutdown', 'Safe to Turn Off', 'Shut the computer down properly', 'term'],
  ['local', 'Local Knowledge', 'Find 3 secrets hidden in the Montréal wallpaper', 'display'],
].map(([id, title, desc, icon]) => ({ id, title, desc, icon }))

const BY_ID = new Map(ACH.map((a) => [a.id, a]))

export function createAchievements({ toast, snd, storage = defaultStorage } = {}) {
  const saved = storage.get(ACH_KEY, [])
  const initial = new Set(Array.isArray(saved) ? saved.filter((id) => BY_ID.has(id)) : [])
  const store = createStore({ got: initial })

  function unlock(id) {
    const a = BY_ID.get(id)
    const got = store.get().got
    if (!a || got.has(id)) return false // fix B13: unknown ids are ignored
    const next = new Set(got)
    next.add(id)
    store.set({ got: next })
    storage.set(ACH_KEY, [...next])
    toast?.('★ Achievement unlocked', a.title)
    snd?.ach?.()
    return true
  }

  return { list: ACH, store, unlock }
}
