// Phase 3 TEST LIST: stage/ticker.test.js. Single rAF loop (D6), with a manual rAF queue.
// Item 3 uses the real Stage and the IntersectionObserver mock from src/test/setup.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { createTicker } from './ticker.js'
import { renderWithApp } from '../test/renderWithApp.jsx'
import { triggerIntersection } from '../test/setup.js'
import Stage from './Stage.jsx'

function manualRaf() {
  let next = 1
  const queue = new Map()
  return {
    raf: vi.fn((cb) => {
      const id = next++
      queue.set(id, cb)
      return id
    }),
    caf: vi.fn((id) => {
      queue.delete(id)
    }),
    flush(t) {
      const cbs = [...queue.values()]
      queue.clear()
      for (const cb of cbs) cb(t)
    },
    pending: () => queue.size,
  }
}

describe('stage/ticker', () => {
  it('1. start() schedules a frame; dt is .016 on the first frame and clamped to .05 after a 1 s gap', () => {
    let time = 1000
    const q = manualRaf()
    const onFrame = vi.fn()
    const ticker = createTicker({ raf: q.raf, caf: q.caf, now: () => time, onFrame })
    ticker.start()
    expect(q.raf).toHaveBeenCalledTimes(1)
    expect(ticker.running).toBe(true)

    q.flush(1000)
    expect(onFrame).toHaveBeenCalledTimes(1)
    expect(onFrame.mock.calls[0][0]).toBe(1000)
    expect(onFrame.mock.calls[0][1]).toBe(0.016)

    q.flush(2000) // 1 s later
    expect(onFrame.mock.calls[1][1]).toBe(0.05)
  })

  it('2. stop() cancels the pending frame and no further frames run', () => {
    const q = manualRaf()
    const onFrame = vi.fn()
    const ticker = createTicker({ raf: q.raf, caf: q.caf, now: () => 0, onFrame })
    ticker.start()
    ticker.stop()
    expect(q.caf).toHaveBeenCalledTimes(1)
    expect(ticker.running).toBe(false)
    expect(q.pending()).toBe(0)
    q.flush(16)
    expect(onFrame).not.toHaveBeenCalled()
  })
})

describe('stage/ticker: stage visibility (real Stage)', () => {
  let rafSpy, cafSpy

  beforeEach(() => {
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    rafSpy.mockRestore()
    cafSpy.mockRestore()
  })

  it('3. the stage IntersectionObserver (threshold 0) stops the loop and restarts it with the flag set', () => {
    const { app, container } = renderWithApp(createElement(Stage), {
      loadScene: vi.fn(() => new Promise(() => {})),
    })
    const stage = container.querySelector('#stage')

    triggerIntersection(stage, true)
    expect(app.ui.store.get().stageVisible).toBe(true)
    const startedAt = rafSpy.mock.calls.length
    expect(startedAt).toBeGreaterThan(0)

    triggerIntersection(stage, false)
    expect(app.ui.store.get().stageVisible).toBe(false)
    expect(cafSpy).toHaveBeenCalled()
    const stoppedAt = rafSpy.mock.calls.length

    triggerIntersection(stage, true)
    expect(app.ui.store.get().stageVisible).toBe(true)
    expect(rafSpy.mock.calls.length).toBeGreaterThan(stoppedAt)
  })
})
