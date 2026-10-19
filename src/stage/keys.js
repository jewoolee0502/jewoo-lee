// Global keys (L1038–1042): the 3D keyboard, key clicks, the Konami code and Escape.
export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
const KONAMI_STR = KONAMI.join()

/** Pushes one key name; returns the new buffer (last 10 keys) and whether it spelled the code. */
export function pushKonami(buf, key) {
  const next = [...buf, key.length === 1 ? key.toLowerCase() : key].slice(-KONAMI.length)
  if (next.join() === KONAMI_STR) return { buf: [], matched: true }
  return { buf: next, matched: false }
}

export function createKeyHandler({ app }) {
  let buf = []
  return function onKeyDown(e) {
    const key = typeof e.key === 'string' ? e.key : ''
    app.scene?.api?.pressKey?.(key)
    if (app.snd.store.get().on && key.length === 1) app.snd.click()
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
  }
}
