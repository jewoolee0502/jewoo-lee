// Round 3 Phase R3-2 TEST LIST: stage/views.test.js (plan-r3 §2.4, §3, V1–V19). The two views as a
// state machine: data-view, the history entries, the fade, focus and the parking order. The window
// is a fake (location, history, listeners); the document is real. Timers are faked for the fade.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createViews, viewForHash, RESUME_IDS } from './views.js'
import { createTimers } from '../core/timers.js'
import { VIEW_FADE_MS } from '../core/constants.js'

// A window stand-in: location and history update each other like the browser's (pushState and
// replaceState set the hash), scrollTo is a mock, and listeners live in a map that fire() drives.
function fakeWin() {
  const handlers = new Map()
  const location = { hash: '', pathname: '/', search: '' }
  const go = (url) => {
    const u = new URL(url, 'http://site.test/')
    location.pathname = u.pathname
    location.search = u.search
    location.hash = u.hash
  }
  const win = {
    location,
    history: {
      state: null,
      scrollRestoration: 'auto',
      back: vi.fn(),
      pushState: vi.fn((state, _title, url) => {
        win.history.state = state
        go(url)
      }),
      replaceState: vi.fn((state, _title, url) => {
        win.history.state = state
        if (url !== undefined) go(url)
      }),
    },
    scrollTo: vi.fn(),
    addEventListener(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set())
      handlers.get(type).add(fn)
    },
    removeEventListener(type, fn) {
      handlers.get(type)?.delete(fn)
    },
    fire(type, event = {}) {
      for (const fn of [...(handlers.get(type) ?? [])]) fn(event)
    },
    listeners: (type) => handlers.get(type)?.size ?? 0,
  }
  return win
}

// The page's real elements: the HUD buttons inside #app, the résumé inside #resume-root.
function setupDom() {
  document.body.innerHTML = `
    <div id="app">
      <button id="hud-rec">Recruiter view</button>
      <button id="hud-resume">Résumé</button>
      <button id="hud-exit">Read the résumé</button>
    </div>
    <div id="resume-root">
      <main id="resume">
        <h1 id="resume-title" tabindex="-1">Jewoo (Jay) Lee</h1>
        <section id="projects"><h2>Projects</h2></section>
      </main>
    </div>`
}

let created
let visible

/** A views instance over the fake window and a fake laptop. `hash` and `state` are set before init. */
function make({ reduce = false, hash = '', state, ...rest } = {}) {
  const win = fakeWin()
  win.location.hash = hash
  if (state !== undefined) win.history.state = state
  const laptop = {
    park: vi.fn(() => 'desk'),
    unpark: vi.fn((where) => where ?? 'desk'),
    beforeLeave: vi.fn(),
  }
  const views = createViews({
    doc: document,
    win,
    laptop,
    reduce: () => reduce,
    timers: createTimers(),
    isVisible: (el) => visible.has(el),
    ...rest,
  })
  created.push(views)
  return { win, laptop, views, doc: document }
}

/** make(), then init(): the page as the browser first shows it. */
function start(opts) {
  const h = make(opts)
  h.views.init()
  return h
}

/** Counts every add or toggle of the class `on` on any element (the veil's fade-in). */
function spyVeilOn() {
  const add = vi.spyOn(DOMTokenList.prototype, 'add')
  const toggle = vi.spyOn(DOMTokenList.prototype, 'toggle')
  return () => [...add.mock.calls, ...toggle.mock.calls].filter(([c]) => c === 'on').length
}

const veil = () => document.querySelector('.view-veil')
const view = () => document.documentElement.getAttribute('data-view')
const order = (mock) => mock.mock.invocationCallOrder[0]

describe('stage/views', () => {
  beforeEach(() => {
    created = []
    visible = new Set()
    setupDom()
    vi.useFakeTimers()
  })

  afterEach(() => {
    for (const v of created.splice(0)) v.dispose()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  describe('viewForHash', () => {
    it('the laptop for an empty hash, #top, an unknown id and a malformed escape', () => {
      for (const hash of ['', '#top', '#x', '#%E0%A4%A']) {
        expect(viewForHash(hash), JSON.stringify(hash)).toBe('laptop')
      }
    })

    it('the résumé for #resume and for a résumé section id (V11)', () => {
      expect(viewForHash('#resume')).toBe('resume')
      expect(viewForHash('#projects')).toBe('resume')
      for (const id of RESUME_IDS) expect(viewForHash('#' + id), id).toBe('resume')
    })
  })

  describe('init (V1–V4)', () => {
    it('V1: an empty hash sets data-view laptop, replaces the entry with {jwView: laptop}, takes manual scroll restoration and parks nothing', () => {
      const { win, laptop, views } = start({ hash: '' })
      expect(view()).toBe('laptop')
      expect(win.history.replaceState).toHaveBeenCalledTimes(1)
      expect(win.history.replaceState.mock.calls[0][0]).toEqual({ jwView: 'laptop' })
      expect(win.history.scrollRestoration).toBe('manual')
      expect(laptop.park).not.toHaveBeenCalled()
      expect(views.get()).toBe('laptop')
    })

    it('V2: a #resume hash sets data-view resume, parks the laptop at the desk, and moves no focus', () => {
      const { laptop, views } = start({ hash: '#resume' })
      expect(view()).toBe('resume')
      expect(laptop.park).toHaveBeenCalledTimes(1)
      expect(laptop.park).toHaveBeenCalledWith('desk')
      expect(views.get()).toBe('resume')
      expect(views.store.get()).toMatchObject({ view: 'resume' })
      expect(document.activeElement).toBe(document.body)
    })

    it('V3: the replaced entry keeps the from field of the entry it replaces', () => {
      const { win } = start({ hash: '#resume', state: { jwView: 'resume', from: 'laptop' } })
      expect(win.history.replaceState.mock.calls[0][0]).toEqual({ jwView: 'resume', from: 'laptop' })
    })

    it('V4: dispose removes the popstate, hashchange and pageshow listeners', () => {
      const { win, views } = start()
      expect(win.listeners('popstate')).toBe(1)
      expect(win.listeners('hashchange')).toBe(1)
      expect(win.listeners('pageshow')).toBe(1)
      views.dispose()
      expect(win.listeners('popstate')).toBe(0)
      expect(win.listeners('hashchange')).toBe(0)
      expect(win.listeners('pageshow')).toBe(0)
    })

    it('V4c: after dispose, init attaches the listeners again (once each)', () => {
      const { win, views } = start()
      views.dispose()
      views.init()
      expect(win.listeners('popstate')).toBe(1)
      expect(win.listeners('hashchange')).toBe(1)
      expect(win.listeners('pageshow')).toBe(1)
    })

    it('V4b: dispose removes a veil that a fade left on the page', () => {
      const { views } = start({ reduce: false })
      views.toResume()
      expect(veil()).not.toBeNull()
      views.dispose()
      expect(veil()).toBeNull()
    })
  })

  describe('toResume (V5–V9)', () => {
    it('V5 (reduced): park, then pushState {jwView: resume, from: laptop}, then beforeLeave, then the résumé shown, then scrolled to the top, with the title focused', () => {
      const { win, laptop, views, doc } = start({ reduce: true })
      const shownAtScroll = []
      win.scrollTo.mockImplementation(() => shownAtScroll.push(view()))

      views.toResume()

      expect(order(laptop.park)).toBeLessThan(order(win.history.pushState))
      expect(order(win.history.pushState)).toBeLessThan(order(laptop.beforeLeave))
      expect(order(laptop.beforeLeave)).toBeLessThan(order(win.scrollTo))
      expect(win.history.pushState).toHaveBeenCalledWith({ jwView: 'resume', from: 'laptop' }, '', '#resume')
      expect(shownAtScroll).toEqual(['resume'])
      expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
      expect(doc.activeElement).toBe(doc.getElementById('resume-title'))
    })

    it('V6: toResume while already in the résumé pushes nothing, scrolls to the top and focuses the title', () => {
      const { win, views, doc } = start({ reduce: true, hash: '#resume' })
      views.toResume()
      expect(win.history.pushState).not.toHaveBeenCalled()
      expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
      expect(doc.activeElement).toBe(doc.getElementById('resume-title'))
    })

    it('V6b: toResume with a section hash while already in the résumé replaces the hash (keeping from), pushes nothing and scrolls to the section', () => {
      const { win, views, doc } = start({ reduce: true, hash: '#resume', state: { jwView: 'resume', from: 'laptop' } })
      const projects = doc.getElementById('projects')
      projects.scrollIntoView = vi.fn()
      win.history.replaceState.mockClear()
      views.toResume({ hash: '#projects' })
      expect(win.history.pushState).not.toHaveBeenCalled()
      expect(win.history.replaceState).toHaveBeenCalledTimes(1)
      expect(win.history.replaceState).toHaveBeenCalledWith({ jwView: 'resume', from: 'laptop' }, '', '#projects')
      expect(win.location.hash).toBe('#projects')
      expect(projects.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    })

    it('V6c: toResume with the hash already in the URL writes no history at all', () => {
      const { win, views } = start({ reduce: true, hash: '#resume' })
      win.history.replaceState.mockClear()
      views.toResume()
      expect(win.history.replaceState).not.toHaveBeenCalled()
      expect(win.history.pushState).not.toHaveBeenCalled()
    })

    it('V7: toResume with a section hash pushes that hash, scrolls the section to its start and does not focus the title', () => {
      const { win, views, doc } = start({ reduce: true })
      const projects = doc.getElementById('projects')
      projects.scrollIntoView = vi.fn()
      views.toResume({ hash: '#projects' })
      expect(win.history.pushState).toHaveBeenCalledWith({ jwView: 'resume', from: 'laptop' }, '', '#projects')
      expect(projects.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
      expect(doc.activeElement).not.toBe(doc.getElementById('resume-title'))
    })

    it('V8 (fade): at 0 ms park and pushState run and the veil is on toward resume; the view is still laptop until VIEW_FADE_MS, then the résumé shows and the veil is off', () => {
      expect(VIEW_FADE_MS).toBe(150)
      const { laptop, win, views } = start({ reduce: false })
      views.toResume()
      expect(laptop.park).toHaveBeenCalledTimes(1)
      expect(win.history.pushState).toHaveBeenCalledTimes(1)
      expect(veil()).toHaveClass('on')
      expect(veil().dataset.to).toBe('resume')
      expect(view()).toBe('laptop')

      vi.advanceTimersByTime(149)
      expect(view()).toBe('laptop')

      vi.advanceTimersByTime(1)
      expect(view()).toBe('resume')
      expect(veil()).not.toHaveClass('on')
    })

    it('V9: a second toResume and a toLaptop during the fade-in are ignored: park and pushState run once and the swap happens once', () => {
      const { laptop, win, views } = start({ reduce: false })
      views.toResume()
      views.toResume()
      views.toLaptop()
      expect(laptop.park).toHaveBeenCalledTimes(1)
      expect(win.history.pushState).toHaveBeenCalledTimes(1)
      expect(laptop.unpark).not.toHaveBeenCalled()

      vi.advanceTimersByTime(VIEW_FADE_MS)
      expect(laptop.beforeLeave).toHaveBeenCalledTimes(1)
      expect(win.scrollTo).toHaveBeenCalledTimes(1)
      expect(view()).toBe('resume')
    })

    it('V10 (reduced): the veil never gets the class on, in either direction', () => {
      const count = spyVeilOn()
      const { views } = start({ reduce: true })
      views.toResume()
      views.toLaptop()
      expect(count()).toBe(0)
      expect(view()).toBe('laptop')
    })
  })

  describe('toLaptop (V11–V15)', () => {
    it('V11 (reduced): from the résumé entered by a button, it calls history.back once, pushes nothing new, shows the laptop, and unparks with the laptop already shown', () => {
      const { win, laptop, views } = start({ reduce: true })
      views.toResume()
      let shownAtUnpark = null
      laptop.unpark.mockImplementation((where) => {
        shownAtUnpark = view()
        return where ?? 'desk'
      })

      views.toLaptop()

      expect(win.history.back).toHaveBeenCalledTimes(1)
      expect(win.history.pushState).toHaveBeenCalledTimes(1)
      expect(view()).toBe('laptop')
      expect(laptop.unpark).toHaveBeenCalledTimes(1)
      expect(laptop.unpark.mock.calls[0][0]).toBeUndefined()
      expect(shownAtUnpark).toBe('laptop')
    })

    it('V12: from a résumé entered by a typed or deep-linked hash (no from), it pushes the bare laptop entry and does not go back', () => {
      const { win, views } = start({ reduce: true, hash: '#resume' })
      views.toLaptop()
      expect(win.history.pushState).toHaveBeenCalledWith({ jwView: 'laptop' }, '', '/')
      expect(win.history.back).not.toHaveBeenCalled()
      expect(view()).toBe('laptop')
    })

    it('V13: toLaptop({ place: open }) unparks at the open laptop', () => {
      const { laptop, views } = start({ reduce: true })
      views.toResume()
      views.toLaptop({ place: 'open' })
      expect(laptop.unpark).toHaveBeenCalledWith('open')
    })

    it('V14a: the opener is visible after the return: focus goes back to it', () => {
      const { views, doc } = start({ reduce: true })
      const rec = doc.getElementById('hud-rec')
      views.toResume({ opener: rec })
      visible.add(rec)
      views.toLaptop()
      expect(doc.activeElement).toBe(rec)
    })

    it('V14b: the opener is hidden and the laptop unparks open: focus goes to #hud-exit', () => {
      const { laptop, views, doc } = start({ reduce: true })
      laptop.unpark.mockImplementation(() => 'open')
      views.toResume({ opener: doc.getElementById('hud-rec') })
      visible.add(doc.getElementById('hud-exit'))
      views.toLaptop()
      expect(doc.activeElement).toBe(doc.getElementById('hud-exit'))
    })

    it('V14c: the opener is hidden and the laptop unparks at the desk: focus goes to #hud-resume', () => {
      const { views, doc } = start({ reduce: true })
      views.toResume({ opener: doc.getElementById('hud-rec') })
      visible.add(doc.getElementById('hud-resume'))
      views.toLaptop()
      expect(doc.activeElement).toBe(doc.getElementById('hud-resume'))
    })

    it('V14d: nothing is visible: focus stays where it was and nothing throws', () => {
      const { views, doc } = start({ reduce: true })
      views.toResume()
      const title = doc.getElementById('resume-title')
      expect(doc.activeElement).toBe(title)
      expect(() => views.toLaptop()).not.toThrow()
      expect(doc.activeElement).toBe(title)
    })

    it('V14e: with no opener given, the focused control inside #app is the opener', () => {
      const { views, doc } = start({ reduce: true })
      const exit = doc.getElementById('hud-exit')
      exit.focus()
      visible.add(exit)
      views.toResume()
      views.toLaptop()
      expect(doc.activeElement).toBe(exit)
    })

    it('V15b (fade): toLaptop turns the veil on toward the laptop at 0 ms and makes no history call before VIEW_FADE_MS; at VIEW_FADE_MS it goes back, shows the laptop, unparks and turns the veil off', () => {
      const { win, laptop, views } = start({ reduce: false })
      views.toResume()
      vi.advanceTimersByTime(VIEW_FADE_MS)
      expect(view()).toBe('resume')

      views.toLaptop()
      expect(veil()).toHaveClass('on')
      expect(veil().dataset.to).toBe('laptop')
      expect(views.store.get().switching).toBe(true)
      expect(view()).toBe('resume')
      expect(win.history.back).not.toHaveBeenCalled()
      expect(laptop.unpark).not.toHaveBeenCalled()

      vi.advanceTimersByTime(VIEW_FADE_MS - 1)
      expect(win.history.back).not.toHaveBeenCalled()
      expect(view()).toBe('resume')

      vi.advanceTimersByTime(1)
      expect(win.history.back).toHaveBeenCalledTimes(1)
      expect(view()).toBe('laptop')
      expect(laptop.unpark).toHaveBeenCalledTimes(1)
      expect(veil()).not.toHaveClass('on')
      expect(views.store.get().switching).toBe(false)
    })

    it('V15c: a popstate that stays on the résumé during the toLaptop fade cancels the pending back and keeps the résumé', () => {
      const { win, laptop, views } = start({ reduce: false })
      views.toResume()
      vi.advanceTimersByTime(VIEW_FADE_MS)
      views.toLaptop()
      vi.advanceTimersByTime(50)
      win.location.hash = '#projects'
      win.fire('popstate')
      expect(document.querySelector('.view-veil.on')).toBeNull()

      vi.advanceTimersByTime(VIEW_FADE_MS)
      expect(win.history.back).not.toHaveBeenCalled()
      expect(win.history.pushState).toHaveBeenCalledTimes(1)
      expect(laptop.unpark).not.toHaveBeenCalled()
      expect(view()).toBe('resume')
      expect(views.get()).toBe('resume')
    })

    it('V15: toLaptop in the laptop view does nothing', () => {
      const { win, laptop, views } = start({ reduce: true })
      views.toLaptop()
      expect(laptop.unpark).not.toHaveBeenCalled()
      expect(win.history.pushState).not.toHaveBeenCalled()
      expect(win.history.back).not.toHaveBeenCalled()
    })
  })

  describe('history traversal and page show (V16–V20)', () => {
    it('V16 (not reduced): Back from the résumé to the laptop is instant, unparks once and writes no history entry', () => {
      const count = spyVeilOn()
      const { win, laptop, views } = start({ reduce: false, hash: '#resume' })
      win.location.hash = ''
      win.fire('popstate')
      expect(view()).toBe('laptop')
      expect(laptop.unpark).toHaveBeenCalledTimes(1)
      expect(win.history.pushState).not.toHaveBeenCalled()
      expect(win.history.replaceState).toHaveBeenCalledTimes(1)
      expect(win.history.back).not.toHaveBeenCalled()
      expect(count()).toBe(0)
      expect(views.get()).toBe('laptop')
    })

    it('V17: a typed #resume (popstate, then hashchange) parks once, closes the laptop at once and pushes nothing', () => {
      const { win, laptop } = start({ reduce: false })
      win.location.hash = '#resume'
      win.fire('popstate')
      win.fire('hashchange')
      expect(laptop.park).toHaveBeenCalledTimes(1)
      expect(laptop.beforeLeave).toHaveBeenCalledTimes(1)
      expect(win.history.pushState).not.toHaveBeenCalled()
      expect(view()).toBe('resume')
    })

    it('V18: a Back during the fade-in cancels the pending swap, and the parked laptop comes back once, where it was', () => {
      const { win, laptop, views } = start({ reduce: false })
      views.toResume()
      vi.advanceTimersByTime(50)
      win.location.hash = ''
      win.fire('popstate')
      expect(laptop.unpark).toHaveBeenCalledTimes(1)
      // The laptop was never hidden, so it stays exactly where it was parked.
      expect(laptop.unpark).toHaveBeenCalledWith('here')

      vi.advanceTimersByTime(100)
      expect(laptop.beforeLeave).not.toHaveBeenCalled()
      expect(view()).toBe('laptop')
      expect(document.querySelector('.view-veil.on')).toBeNull()
      expect(views.get()).toBe('laptop')
    })

    it('V18b: a Back during the fade-in with the opener hidden and the laptop back open focuses #hud-exit', () => {
      const { win, laptop, views, doc } = start({ reduce: false })
      laptop.unpark.mockImplementation((where) => (where === 'here' ? 'open' : (where ?? 'desk')))
      views.toResume({ opener: doc.getElementById('hud-rec') })
      visible.add(doc.getElementById('hud-exit'))
      vi.advanceTimersByTime(50)
      win.location.hash = ''
      win.fire('popstate')
      expect(laptop.unpark).toHaveBeenCalledWith('here')
      expect(doc.activeElement).toBe(doc.getElementById('hud-exit'))
    })

    it('V19: a persisted pageshow during a fade forces the veil off, shows the laptop at once and clears switching', () => {
      const { laptop, win, views } = start({ reduce: false, hash: '#resume' })
      views.toLaptop()
      expect(veil()).toHaveClass('on')
      expect(view()).toBe('resume')

      win.location.hash = ''
      win.fire('pageshow', { persisted: true })
      expect(view()).toBe('laptop')
      expect(document.querySelector('.view-veil.on')).toBeNull()
      expect(views.store.get().switching).toBe(false)
      expect(laptop.unpark).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(VIEW_FADE_MS)
      expect(laptop.unpark).toHaveBeenCalledTimes(1)
      expect(laptop.beforeLeave).not.toHaveBeenCalled()
    })

    it('V20: after a button Back, a popstate to the laptop does not unpark a second time', () => {
      const { win, laptop, views } = start({ reduce: true })
      views.toResume()
      views.toLaptop()
      expect(laptop.unpark).toHaveBeenCalledTimes(1)
      win.location.hash = ''
      win.fire('popstate')
      expect(laptop.unpark).toHaveBeenCalledTimes(1)
    })

    it('V21: a history call that throws (a sandboxed frame) does not stop the switch', () => {
      const { win, views } = start({ reduce: true })
      win.history.pushState.mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(() => views.toResume()).not.toThrow()
      expect(view()).toBe('resume')
    })
  })
})
