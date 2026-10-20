// Global test setup (vitest setupFiles). jsdom has no canvas drawing, no
// matchMedia, no observers, no layout and no font loading, so this file stubs
// them and exports small helpers to drive the stubs from tests.
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { act, cleanup } from '@testing-library/react'
import { createRecordingContext } from './fakeCanvas.js'

// Files with `// @vitest-environment node` have no DOM: skip the stubs.
const DOM = typeof window !== 'undefined'

/* ---------- canvas ---------- */

const contexts = new WeakMap()

function installCanvas() {
  HTMLCanvasElement.prototype.getContext = function getContext(type) {
    // jsdom has no WebGL: only the 2D context is faked, like a browser without WebGL.
    if (type !== '2d') return null
    let ctx = contexts.get(this)
    if (!ctx) {
      ctx = createRecordingContext(this)
      contexts.set(this, ctx)
    }
    return ctx
  }

  HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
    return 'data:image/png;base64,TEST'
  }
}
if (DOM) installCanvas()

/* ---------- matchMedia (controllable reduced motion) ---------- */

let reducedMotion = false
const mediaLists = new Map()

function evaluateQuery(query) {
  const q = String(query).replace(/\s+/g, ' ').trim()
  if (q.includes('prefers-reduced-motion')) {
    if (q.includes('no-preference')) return !reducedMotion
    if (q.includes('reduce')) return reducedMotion
  }
  return false
}

function createMediaQueryList(query) {
  const listeners = new Set()
  const mql = {
    media: query,
    onchange: null,
    get matches() {
      return evaluateQuery(query)
    },
    addEventListener(type, fn) {
      if (type === 'change' && fn) listeners.add(fn)
    },
    removeEventListener(type, fn) {
      if (type === 'change') listeners.delete(fn)
    },
    addListener(fn) {
      if (fn) listeners.add(fn)
    },
    removeListener(fn) {
      listeners.delete(fn)
    },
    dispatchEvent(event) {
      for (const fn of [...listeners]) fn.call(mql, event)
      if (typeof mql.onchange === 'function') mql.onchange.call(mql, event)
      return true
    },
  }
  return mql
}

function matchMedia(query) {
  let mql = mediaLists.get(query)
  if (!mql) {
    mql = createMediaQueryList(query)
    mediaLists.set(query, mql)
  }
  return mql
}

if (DOM) Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: matchMedia,
})

/** Sets prefers-reduced-motion and fires `change` on every affected MediaQueryList. */
export function setReducedMotion(value) {
  const next = Boolean(value)
  if (next === reducedMotion) return
  const before = new Map(
    [...mediaLists].map(([q, mql]) => [q, mql.matches]),
  )
  reducedMotion = next
  act(() => {
    for (const [q, mql] of mediaLists) {
      if (!q.includes('prefers-reduced-motion')) continue
      if (mql.matches === before.get(q)) continue
      mql.dispatchEvent({ type: 'change', matches: mql.matches, media: q })
    }
  })
}

/* ---------- IntersectionObserver / ResizeObserver ---------- */

const intersectionObservers = new Set()
const resizeObservers = new Set()

class MockIntersectionObserver {
  constructor(callback, options = {}) {
    this.callback = callback
    this.options = options
    this.root = options.root ?? null
    this.rootMargin = options.rootMargin ?? '0px'
    this.thresholds = [].concat(options.threshold ?? 0)
    this.targets = new Set()
    intersectionObservers.add(this)
  }
  observe(el) {
    this.targets.add(el)
  }
  unobserve(el) {
    this.targets.delete(el)
  }
  disconnect() {
    this.targets.clear()
    intersectionObservers.delete(this)
  }
  takeRecords() {
    return []
  }
}

class MockResizeObserver {
  constructor(callback) {
    this.callback = callback
    this.targets = new Set()
    resizeObservers.add(this)
  }
  observe(el) {
    this.targets.add(el)
  }
  unobserve(el) {
    this.targets.delete(el)
  }
  disconnect() {
    this.targets.clear()
    resizeObservers.delete(this)
  }
}

function rect(width = 0, height = 0) {
  return { x: 0, y: 0, top: 0, left: 0, width, height, right: width, bottom: height }
}

/** Calls every IntersectionObserver observing `el`. Returns how many were called. */
export function triggerIntersection(el, isIntersecting) {
  const hit = [...intersectionObservers].filter((o) => o.targets.has(el))
  const entry = {
    target: el,
    isIntersecting: Boolean(isIntersecting),
    intersectionRatio: isIntersecting ? 1 : 0,
    boundingClientRect: rect(),
    intersectionRect: rect(),
    rootBounds: null,
    time: performance.now(),
  }
  act(() => {
    for (const o of hit) o.callback([entry], o)
  })
  return hit.length
}

/** Calls every ResizeObserver observing `el`. Returns how many were called. */
export function triggerResize(el, { width = 0, height = 0 } = {}) {
  const hit = [...resizeObservers].filter((o) => o.targets.has(el))
  const size = [{ inlineSize: width, blockSize: height }]
  const entry = {
    target: el,
    contentRect: rect(width, height),
    borderBoxSize: size,
    contentBoxSize: size,
    devicePixelContentBoxSize: size,
  }
  act(() => {
    for (const o of hit) o.callback([entry], o)
  })
  return hit.length
}

for (const [name, value] of DOM ? [
  ['IntersectionObserver', MockIntersectionObserver],
  ['ResizeObserver', MockResizeObserver],
] : []) {
  Object.defineProperty(window, name, { configurable: true, writable: true, value })
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
}

/* ---------- scrolling, pointer capture, fonts, rAF ---------- */

function installScrollMocks() {
  window.scrollTo = vi.fn()
  window.scrollBy = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
}
function installDomMocks() {
  installScrollMocks()

  Element.prototype.setPointerCapture = function setPointerCapture() {}
  Element.prototype.releasePointerCapture = function releasePointerCapture() {}
  Element.prototype.hasPointerCapture = function hasPointerCapture() {
    return false
  }

  Object.defineProperty(document, 'fonts', {
    configurable: true,
    writable: true,
    value: { ready: Promise.resolve(), load: () => Promise.resolve([]) },
  })

  if (typeof window.requestAnimationFrame !== 'function') {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16)
  }
  if (typeof window.cancelAnimationFrame !== 'function') {
    window.cancelAnimationFrame = (id) => clearTimeout(id)
  }
}
if (DOM) installDomMocks()

/* ---------- per-test lifecycle ---------- */

beforeEach(() => {
  if (!DOM) return
  // Fresh mocks so call history never leaks between tests.
  installScrollMocks()
})

afterEach(() => {
  if (!DOM) return
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  vi.useRealTimers()
  setReducedMotion(false)
  intersectionObservers.clear()
  resizeObservers.clear()
  // Round 3 Phase R3-2 (plan-r3 V1, V9): a test's view, its fade veil and its history entry do not leak.
  document.documentElement.removeAttribute('data-view')
  document.querySelectorAll('.view-veil').forEach((el) => el.remove())
  history.replaceState(null, '', '/')
})
