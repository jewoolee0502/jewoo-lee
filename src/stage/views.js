// The two views (plan-r3 V1, V8–V12, §2.4): the laptop (the stage and its scroll track) and the
// résumé. Only the buttons, history traversal and the URL change the view; scrolling never does
// (I8). The view is written to <html data-view>, and views.css hides the other one; without JS
// there is no attribute, so both show.
//
// The URL is the view (I11): `#resume` or a résumé section id is the résumé, anything else is the
// laptop. A button entry pushes one `#resume` entry; the way back pops it with history.back() when
// this page pushed it, and otherwise (a deep link, a typed hash) pushes the bare URL, so repeated
// switching never stacks entries. popstate, hashchange and pageshow only re-sync the view from the
// hash and never write history. Button switches fade through a veil (VIEW_FADE_MS in, the swap,
// VIEW_FADE_MS out); history-driven switches and reduced motion are instant, since the browser's
// own back gesture already animates.
//
// The laptop is parked before it is hidden and unparked after it is shown (I13), so both measure a
// visible track. Focus never stays on a hidden element (V12): the résumé focuses its title, and the
// return focuses the control that left (the opener) or a HUD fallback for where the laptop landed.
import { createStore } from '../core/store.js'
import { createTimers } from '../core/timers.js'
import { VIEW_FADE_MS } from '../core/constants.js'

/** V11: the hashes of the résumé view: the résumé itself and its sections. index.html's inline
 *  script and Resume.jsx's section ids must match (structure.test.js). */
export const RESUME_IDS = ['resume', 'about', 'experience', 'projects', 'skills', 'contact', 'trophies']

/** The view a URL hash shows. The raw hash is compared, exactly like index.html's inline script. */
export function viewForHash(hash) {
  const id = typeof hash === 'string' && hash.startsWith('#') ? hash.slice(1) : ''
  return RESUME_IDS.includes(id) ? 'resume' : 'laptop'
}

const defaultVisible = (el) => Boolean(el?.isConnected && el.getClientRects().length)

/** History and scroll-restoration calls throw in some sandboxed frames; the switch goes on. */
function attempt(fn) {
  try {
    fn()
  } catch {
    // The view still switches; only the URL or the restoration mode is left as it was.
  }
}

/**
 * `laptop` is `{ park(where?) → where, unpark(where?) → whereUsed, beforeLeave() }` (the controller
 * and the dialogs to close). unpark's place is 'open', 'desk', 'here' (exactly where it was parked)
 * or undefined (the controller's returnTo). `init()` reads the URL and attaches the history listeners; until then
 * (tests, createApp) the views touch neither the document nor history.
 */
export function createViews({
  doc = globalThis.document,
  win = globalThis.window,
  laptop,
  reduce = () => false,
  timers = createTimers(),
  fadeMs = VIEW_FADE_MS,
  isVisible = defaultVisible,
  fallbackFocus = { open: '#hud-exit', desk: '#hud-resume' },
} = {}) {
  const store = createStore({ view: 'laptop', switching: false })
  let parked = false
  let opener = null
  let veil = null
  // The scheduled swap of a button fade, cancelled by a traversal that lands first (I12).
  let cancelSwap = null
  const offs = []
  let inited = false

  function setView(v) {
    doc.documentElement.setAttribute('data-view', v)
    store.set({ view: v })
  }

  function park(where) {
    if (parked) return
    parked = true
    laptop.park(where)
  }

  function unpark(place) {
    if (!parked) return null
    parked = false
    return laptop.unpark(place)
  }

  function ensureVeil() {
    if (!veil || !veil.isConnected) {
      veil = doc.createElement('div')
      veil.className = 'view-veil'
      veil.setAttribute('aria-hidden', 'true')
      doc.body.appendChild(veil)
      // A style read before `on`, so the first fade transitions instead of popping in.
      veil.getBoundingClientRect()
    }
    return veil
  }

  /** V9: the veil in, then `swap` at fadeMs and the veil out. */
  function fade(to, swap) {
    const v = ensureVeil()
    v.dataset.to = to
    v.classList.add('on')
    store.set({ switching: true })
    cancelSwap = timers.timeout(() => {
      cancelSwap = null
      store.set({ switching: false })
      swap()
      v.classList.remove('on')
    }, fadeMs)
  }

  /** A pending fade is dropped: no swap, the veil off at once. */
  function stopFade() {
    cancelSwap?.()
    cancelSwap = null
    veil?.classList.remove('on')
    store.set({ switching: false })
  }

  /** The résumé at its top (title focused) or at a section (scroll only, V12). */
  function showResumeAt(hash) {
    win.scrollTo({ top: 0, behavior: 'instant' })
    const id = hash.slice(1)
    if (id === 'resume') doc.getElementById('resume-title')?.focus({ preventScroll: true })
    else doc.getElementById(id)?.scrollIntoView?.({ block: 'start' })
  }

  function swapToResume(hash) {
    laptop.beforeLeave?.()
    setView('resume')
    showResumeAt(hash)
  }

  /** Focus on the opener if it is visible, else on the HUD fallback for `where` (V12). */
  function restoreFocus(where) {
    const back = opener
    opener = null
    if (back && isVisible(back)) return back.focus({ preventScroll: true })
    const fallback = doc.querySelector(fallbackFocus[where === 'open' ? 'open' : 'desk'])
    if (fallback && isVisible(fallback)) fallback.focus({ preventScroll: true })
  }

  /** I13: shown first, then unparked, then the focus. */
  function swapToLaptop(place) {
    setView('laptop')
    restoreFocus(unpark(place))
  }

  /** The control that left the laptop: the one given, or the focused one inside #app. */
  function defaultOpener() {
    const el = doc.activeElement
    return el && el !== doc.body && doc.getElementById('app')?.contains(el) ? el : null
  }

  /** popstate, hashchange, pageshow: the view follows the hash, instantly, with no history write. */
  function sync() {
    stopFade()
    const v = viewForHash(win.location.hash)
    if (v === 'resume') {
      if (store.get().view === 'resume') return
      park()
      swapToResume(win.location.hash)
    } else if (store.get().view === 'resume') swapToLaptop()
    // A Back during a résumé fade-in: the laptop never left, but it was parked at the fade's start,
    // so it comes back exactly where it was (and focus is kept visible, as on any return).
    else if (parked) restoreFocus(unpark('here'))
  }

  const views = {
    store,
    get: () => store.get().view,

    init() {
      if (inited) return views.dispose
      inited = true
      const v = viewForHash(win.location.hash)
      const state = win.history.state
      attempt(() => win.history.replaceState({ ...(state && typeof state === 'object' ? state : {}), jwView: v }, ''))
      attempt(() => {
        win.history.scrollRestoration = 'manual'
      })
      if (v === 'resume') park('desk')
      setView(v)
      const onShow = (e) => {
        if (e?.persisted) sync()
      }
      for (const [type, fn] of [
        ['popstate', sync],
        ['hashchange', sync],
        ['pageshow', onShow],
      ]) {
        win.addEventListener(type, fn)
        offs.push(() => win.removeEventListener(type, fn))
      }
      return views.dispose
    },

    /** The résumé view, from a button: parks, pushes `hash`, then fades and swaps (§2.4). In the
     *  résumé already, it only replaces the hash and scrolls (to the top, or to the section). */
    toResume({ opener: from, hash = '#resume' } = {}) {
      if (store.get().switching) return
      if (store.get().view === 'resume') {
        // Already here: the URL follows the target without a new entry (the entry keeps `from`).
        if (win.location.hash !== hash) {
          const state = win.history.state
          attempt(() => win.history.replaceState({ ...(state && typeof state === 'object' ? state : {}), jwView: 'resume' }, '', hash))
        }
        return showResumeAt(hash)
      }
      opener = from ?? defaultOpener()
      park()
      attempt(() => win.history.pushState({ jwView: 'resume', from: 'laptop' }, '', hash))
      if (reduce()) swapToResume(hash)
      else fade('resume', () => swapToResume(hash))
    },

    /** The laptop view, from a button: back to where it was left, or `place` ('open' | 'desk'). The
     *  history call is made at the swap, so its popstate arrives after it and is a no-op (V9). */
    toLaptop({ place } = {}) {
      if (store.get().switching || store.get().view !== 'resume') return
      const go = () => {
        if (win.history.state?.from === 'laptop') attempt(() => win.history.back())
        else attempt(() => win.history.pushState({ jwView: 'laptop' }, '', win.location.pathname + win.location.search))
        swapToLaptop(place)
      }
      if (reduce()) go()
      else fade('laptop', go)
    },

    dispose() {
      for (const off of offs.splice(0)) off()
      inited = false
      cancelSwap?.()
      cancelSwap = null
      veil?.remove()
      veil = null
      store.set({ switching: false })
    },
  }
  return views
}
