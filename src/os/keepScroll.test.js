// Round 2 §7 6B TEST LIST item 1: os/keepScroll.js. Window scroll offsets survive a DOM move (U10).
// Assumed API (plan §7 6B): KEEP_SCROLL = '.wb, .t-out'; keepScroll(root, fn, selector = KEEP_SCROLL)
// snapshots [el, scrollTop, scrollLeft] for each match with a non-zero offset, runs fn(), writes the
// changed values back and returns fn's result. root == null just calls fn().
// Assumed retry API (Round 2 §7 6B, added here): keepScroll(root, fn, selector, { raf } = {}). When a
// restored offset did not take and the element is still connected, the write is re-applied once on the
// next frame, via options.raf (default: globalThis.requestAnimationFrame). No retry when it took, or when
// the element is disconnected, either at the miss or by the time the frame runs.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { keepScroll, KEEP_SCROLL } from './keepScroll.js'

/** A div with a stored scroll offset whose setters are spies, so a test can count the writes. */
function scroller(className, top = 0, left = 0) {
  const el = document.createElement('div')
  el.className = className
  let t = top
  let l = left
  const setTop = vi.fn((v) => {
    t = v
  })
  const setLeft = vi.fn((v) => {
    l = v
  })
  Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => t, set: setTop })
  Object.defineProperty(el, 'scrollLeft', { configurable: true, get: () => l, set: setLeft })
  return { el, setTop, setLeft }
}

/** A div whose scrollTop setter silently drops the next N writes (a browser that did not take the offset). */
function flakyScroller(className, top = 0) {
  const el = document.createElement('div')
  el.className = className
  let t = top
  let drop = 0
  const setTop = vi.fn((v) => {
    if (drop > 0) {
      drop -= 1
      return
    }
    t = v
  })
  Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => t, set: setTop })
  return { el, setTop, dropNextWrites: (n) => (drop = n) }
}

describe('os/keepScroll', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('KEEP_SCROLL selects the window bodies and the terminal output', () => {
    expect(KEEP_SCROLL).toBe('.wb, .t-out')
  })

  it('restores a non-zero offset after fn moved it, and leaves a zero-offset element untouched', () => {
    const root = document.createElement('div')
    const a = scroller('wb', 120, 0)
    const b = scroller('wb', 0, 0)
    root.append(a.el, b.el)
    const fn = vi.fn(() => {
      a.el.scrollTop = 0
      return 'moved'
    })

    const r = keepScroll(root, fn)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(a.el.scrollTop).toBe(120)
    expect(b.setTop).not.toHaveBeenCalled()
    expect(b.setLeft).not.toHaveBeenCalled()
    expect(r).toBe('moved')
  })

  it('also restores scrollLeft and covers .t-out, not only .wb', () => {
    const root = document.createElement('div')
    const out = scroller('t-out', 40, 16)
    root.append(out.el)

    keepScroll(root, () => {
      out.el.scrollTop = 0
      out.el.scrollLeft = 0
    })

    expect(out.el.scrollTop).toBe(40)
    expect(out.el.scrollLeft).toBe(16)
  })

  it('passes the return value of fn through, including falsy values', () => {
    const root = document.createElement('div')
    expect(keepScroll(root, () => 0)).toBe(0)
    expect(keepScroll(root, () => false)).toBe(false)
  })

  it('with a null root it calls fn once and returns its value', () => {
    const fn = vi.fn(() => 'ok')
    expect(keepScroll(null, fn)).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  // Round 2 §7 6B (scroll restore retry): a restore that did not take is re-applied on the next frame.
  it('re-applies a restored offset on the next animation frame when the write did not take', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const a = flakyScroller('wb', 120)
    root.append(a.el)
    const raf = vi.fn()

    keepScroll(
      root,
      () => {
        a.el.scrollTop = 0
        a.dropNextWrites(1)
      },
      KEEP_SCROLL,
      { raf },
    )

    expect(a.el.scrollTop).toBe(0)
    expect(raf).toHaveBeenCalledTimes(1)
    raf.mock.calls[0][0]()
    expect(a.el.scrollTop).toBe(120)
  })

  it('does not schedule a retry when the restored offset took', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const a = scroller('wb', 120, 0)
    root.append(a.el)
    const raf = vi.fn()

    keepScroll(
      root,
      () => {
        a.el.scrollTop = 0
      },
      KEEP_SCROLL,
      { raf },
    )

    expect(a.el.scrollTop).toBe(120)
    expect(raf).not.toHaveBeenCalled()
  })

  it('does not schedule a retry when the element is disconnected after the miss', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const a = flakyScroller('wb', 120)
    root.append(a.el)
    const raf = vi.fn()

    keepScroll(
      root,
      () => {
        a.el.scrollTop = 0
        a.dropNextWrites(1)
        root.remove()
      },
      KEEP_SCROLL,
      { raf },
    )

    expect(a.el.isConnected).toBe(false)
    expect(raf).not.toHaveBeenCalled()
  })

  it('skips the frame retry when the element was disconnected before the frame runs', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const a = flakyScroller('wb', 120)
    root.append(a.el)
    const raf = vi.fn()

    keepScroll(
      root,
      () => {
        a.el.scrollTop = 0
        a.dropNextWrites(1)
      },
      KEEP_SCROLL,
      { raf },
    )
    expect(raf).toHaveBeenCalledTimes(1)
    const writesBefore = a.setTop.mock.calls.length
    root.remove()
    raf.mock.calls[0][0]()

    expect(a.setTop.mock.calls.length).toBe(writesBefore)
  })
})
