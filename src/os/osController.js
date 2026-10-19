// JAY-OS state machine and window manager (L673–764). React reads `store`; the
// imperative host is driven directly. Every timer lives in one child timer group.
import { createStore } from '../core/store.js'
import { PROJECTS, ROLES } from '../content/index.js'
import { lookupApp } from './registry.js'
import { openRect, fitWindows } from './windowMath.js'

/** Boot log lines (L679–681), with the drive and role counts derived from content (B16). */
export function BOOT_LINES({ projects = PROJECTS, roles = ROLES } = {}) {
  return [
    ['JAY-BIOS (C) 2001-2026 · Montréal Edition', ''],
    ['CPU: Full-Stack Engineer @ McGill ............ ', 'OK'],
    ['Memory test: 640K ............................ ', 'OK'],
    [`Detecting drives:  A: 3½" floppy   C: projects (${projects.length})`, ''],
    ['Loading languages: 한국어, English ............. ', 'OK'],
    [`Mounting /experience (${roles.length} roles) ................ `, 'OK'],
    ['Checking coffee level ........................ ', 'LOW'],
    ['Starting JAY-OS 2.0 …', ''],
  ].map(([text, tag]) => ({ text, tag }))
}

const DEFAULT_COLOR = '#4AA6EE'

// deps: {host, registry, ach, snd, motion, timers, scene: () => api}.
export function createOsController({ host, registry, ach, snd, motion, timers, scene }) {
  const t = timers.child()
  const reduce = () => Boolean(motion?.reduce?.())
  const sceneApi = () => (typeof scene === 'function' ? scene() : null)

  const store = createStore({
    state: 'standby',
    bootLines: [],
    splashing: false,
    barFull: false,
    collapsing: false,
    disco: false,
    fx: null,
    wins: [],
    focusedId: null,
    menuOpen: false,
    art: [],
    flat: false,
    compact: false,
    live: false,
  })

  let z = 20
  let cascade = 0
  let queue = []
  let cmdNonce = 0
  let fxNonce = 0
  let stopDisco = null

  const get = () => store.get()
  const findWin = (id) => get().wins.find((w) => w.id === id)
  const patchWin = (id, fields) =>
    store.set((s) => ({ wins: s.wins.map((w) => (w.id === id ? { ...w, ...fields } : w)) }))

  /* ---------- boot / shutdown ---------- */

  function boot() {
    const { state } = get()
    if (state === 'boot' || state === 'on') return
    store.set({ state: 'boot', bootLines: [], splashing: false, barFull: false })
    const lines = BOOT_LINES()
    let i = 0
    const tick = () => {
      if (get().state !== 'boot') return
      if (i < lines.length) {
        const line = lines[i++]
        store.set((s) => ({ bootLines: [...s.bootLines, line] }))
        sceneApi()?.drive?.(0.2)
        t.timeout(tick, reduce() ? 30 : 150)
        return
      }
      store.set({ splashing: true })
      t.timeout(() => store.set({ barFull: true }), 16)
      t.timeout(() => {
        if (get().state !== 'boot') return
        store.set({ state: 'on' })
        snd?.chime?.()
        ach?.unlock?.('boot')
        for (const { id, opts } of queue.splice(0)) openApp(id, opts)
      }, reduce() ? 150 : 1000)
    }
    tick()
  }

  function shutdown(then) {
    if (get().state !== 'on' || get().collapsing) return
    store.set({ wins: [], focusedId: null, menuOpen: false, fx: null, collapsing: true })
    snd?.off?.()
    t.timeout(() => {
      store.set({ collapsing: false, state: 'off' })
      ach?.unlock?.('shutdown')
      if (then) t.timeout(then, 900)
    }, reduce() ? 50 : 600)
  }

  /* ---------- windows ---------- */

  function getDef(id) {
    return lookupApp(registry, id, get().art) ?? null
  }

  function focus(id) {
    const win = findWin(id)
    if (!win) return
    if (get().focusedId === id && win.z === z) return
    z += 1
    patchWin(id, { z })
    store.set({ focusedId: id })
  }

  function openApp(id, opts = {}) {
    const { state, collapsing } = get()
    // During the shutdown collapse the desk is going away: drop the request.
    if (state === 'on' && collapsing) return null
    if (state !== 'on') {
      queue.push({ id, opts })
      if (state === 'off' || state === 'standby') boot()
      return null
    }
    const open = findWin(id)
    if (open) {
      z += 1
      const fields = { z, shakeNonce: open.shakeNonce + 1 }
      if (opts.cmd) fields.cmd = { text: opts.cmd, nonce: ++cmdNonce }
      patchWin(id, fields)
      store.set({ focusedId: id })
      return findWin(id)
    }
    const def = getDef(id)
    if (!def) return null
    const rect = openRect(def, host.size(), cascade)
    cascade = (cascade + 1) % 6
    z += 1
    const rec = {
      id,
      title: def.title,
      color: def.color ?? DEFAULT_COLOR,
      ...rect,
      z,
      opening: true,
      shakeNonce: 0,
      cmd: opts.cmd ? { text: opts.cmd, nonce: ++cmdNonce } : null,
    }
    store.set((s) => ({ wins: [...s.wins, rec], focusedId: id }))
    snd?.tone?.(520, 0.05, 'square', 0.03)
    t.timeout(() => {
      if (findWin(id)?.opening) patchWin(id, { opening: false })
    }, 220)
    return rec
  }

  function closeApp(id) {
    if (!findWin(id)) return
    store.set((s) => ({
      wins: s.wins.filter((w) => w.id !== id),
      focusedId: s.focusedId === id ? null : s.focusedId,
    }))
  }

  function moveWindow(id, x, y) {
    const win = findWin(id)
    if (!win || (win.x === x && win.y === y)) return
    patchWin(id, { x, y })
  }

  /** Saves a drawing; returns its index `n` (opened as `art:n`). */
  function addArt(dataUrl) {
    const n = get().art.length
    store.set((s) => ({ art: [...s.art, dataUrl] }))
    return n
  }

  function setMenu(open) {
    store.set({ menuOpen: Boolean(open) })
  }

  /* ---------- fx ---------- */

  function disco() {
    if (reduce()) return
    stopDisco?.()
    store.set({ disco: true })
    sceneApi()?.disco?.(6)
    stopDisco = t.timeout(() => {
      stopDisco = null
      store.set({ disco: false })
    }, 6000)
  }

  const matrix = () => store.set({ fx: { kind: 'matrix', nonce: ++fxNonce } })
  const confetti = () => store.set({ fx: { kind: 'confetti', nonce: ++fxNonce } })
  const stopFx = () => store.set({ fx: null })

  /* ---------- size / flat / live ---------- */

  function setSize(w, h) {
    const { shrunk } = host.setSize(w, h)
    if (!shrunk) return
    const wins = get().wins
    const next = fitWindows(wins, { w: Math.round(w), h: Math.round(h) })
    if (next !== wins) store.set({ wins: next })
  }

  function setFlat(v, compact) {
    // The host reports what it actually did (it stays out of flat mode without a flat host).
    const flat = host.setFlat(v, compact)
    store.set({ flat, compact: Boolean(compact) })
  }

  function setLive(v) {
    host.setLive(v)
    store.set({ live: Boolean(v) })
  }

  function dispose() {
    t.clearAll()
    queue = []
    stopDisco = null
  }

  return {
    store,
    get state() {
      return get().state
    },
    boot,
    shutdown,
    openApp,
    closeApp,
    focus,
    moveWindow,
    getDef,
    addArt,
    setMenu,
    disco,
    matrix,
    confetti,
    stopFx,
    setSize,
    setFlat,
    setLive,
    size: () => host.size(),
    dispose,
  }
}
