// Global keys (L1038–1042): the 3D keyboard, key clicks, the Konami code and Escape.
export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
const KONAMI_STR = KONAMI.join()
/** The idle settle is held once this many keys of the code are in, until it completes or breaks. */
const KONAMI_HOLD_AT = 2
/** ...or until this long passes with no key. */
export const KONAMI_IDLE_MS = 1500

const norm = (key) => (key.length === 1 ? key.toLowerCase() : key)

/** Pushes one key name; returns the new buffer (last 10 keys) and whether it spelled the code. */
export function pushKonami(buf, key) {
  const next = [...buf, norm(key)].slice(-KONAMI.length)
  if (next.join() === KONAMI_STR) return { buf: [], matched: true }
  return { buf: next, matched: false }
}

/**
 * `hold(on)` (optional) is told while the Konami code is being typed, so its arrow keys do not
 * settle the page into the laptop halfway through; `timers` (createTimers-shaped) runs the
 * KONAMI_IDLE_MS release. The returned handler returns whether this key completed the code.
 */
export function createKeyHandler({ app, hold, timers }) {
  let buf = []
  // How many keys from the start of the code are in, and whether `hold` was last told true.
  let run = 0
  let held = false
  let cancelIdle = null
  const setHeld = (on) => {
    if (on === held) return
    held = on
    hold?.(on)
  }
  const unhold = () => {
    cancelIdle?.()
    cancelIdle = null
    setHeld(false)
  }
  // The wait ran out: the code is abandoned, so the next key starts it over.
  const giveUp = () => {
    run = 0
    unhold()
  }
  function track(key) {
    const k = norm(key)
    if (k === KONAMI[run]) run += 1
    else run = k === KONAMI[0] ? 1 : 0
    if (run >= KONAMI.length) run = 0
    if (run < KONAMI_HOLD_AT) {
      unhold()
      return
    }
    setHeld(true)
    cancelIdle?.()
    cancelIdle = timers ? timers.timeout(giveUp, KONAMI_IDLE_MS) : null
  }

  return function onKeyDown(e) {
    const key = typeof e.key === 'string' ? e.key : ''
    app.scene?.api?.pressKey?.(key)
    if (app.snd.store.get().on && key.length === 1) app.snd.click()
    if (hold) track(key)
    const r = pushKonami(buf, key)
    buf = r.buf
    if (r.matched) {
      app.ach.unlock('konami')
      app.toasts.toast('Cheat code', 'Disco mode enabled. You’re welcome.', 'info')
      if (app.os.state === 'on') app.os.disco()
      else if (!app.motion.reduce()) app.scene?.api?.disco?.(6) // B11
    }
    if (key === 'Escape') {
      // plan-r2 §7 U12: the recruiter view, then the ◆ menu, then the laptop.
      if (app.ui.store.get().recOpen) app.ui.store.set({ recOpen: false })
      else if (app.os.store?.get().menuOpen) {
        const inMenu = document.activeElement?.closest?.('#menu-pop')
        app.os.setMenu(false)
        if (inMenu) document.getElementById('mb-logo')?.focus()
      } else if (app.scene?.store.get().status === 'ready' && app.ctrl.store.get().phase !== 'desk') app.ctrl.exit()
    }
    return r.matched
  }
}
