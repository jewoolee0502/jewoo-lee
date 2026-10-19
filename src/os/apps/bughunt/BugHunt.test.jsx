// Phase 5 TEST LIST: os/apps/bughunt/BugHunt.test.jsx (L941–958). The round is driven by a manual
// rAF (injected through app.timers) and fake setTimeout/performance, so frames are exact:
// each frame runs at 16 ms. The bug layer is a portal into the desktop element (DesktopContext).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithApp } from '../../../test/renderWithApp.jsx'
import { createTimers } from '../../../core/timers.js'
import { DesktopContext } from '../../DesktopContext.js'
import BugHunt from './BugHunt.jsx'

let desk
let pending
let pendingId
let nextId
let raf
let caf

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'],
  })
  // Math.random 0.5: every bug spawns from the top edge at the same spot (deterministic).
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  desk = document.createElement('div')
  desk.id = 'l-desk'
  document.body.appendChild(desk)
  pending = null
  pendingId = 0
  nextId = 0
  raf = vi.fn((cb) => {
    pending = cb
    pendingId = ++nextId
    return pendingId
  })
  caf = vi.fn((id) => {
    if (id === pendingId) pending = null
  })
})

afterEach(() => {
  desk.remove()
})

function renderBugHunt(overrides = {}) {
  const timers = createTimers({ raf, caf })
  return renderWithApp(
    <DesktopContext.Provider value={desk}>
      <BugHunt win={{ id: 'bugs' }} />
    </DesktopContext.Provider>,
    { timers, ...overrides },
  )
}

// Advances the fake clock in 16 ms frames and runs the pending animation frame each time.
function frames(ms, onFrame) {
  for (let t = 0; t < ms; t += 16) {
    vi.advanceTimersByTime(16)
    if (onFrame) onFrame()
    const cb = pending
    pending = null
    cb?.(performance.now())
  }
}

const startButton = () => screen.getByRole('button', { name: 'Start hunt' })
const score = (container) => container.querySelector('.bh-s').textContent
const liveBug = () => document.querySelector('button[aria-label="Squash bug"]:not(.splat)')

describe('BugHunt round', () => {
  it('Start hunt disables the button as Hunting… and creates the layer in the desktop element', () => {
    renderBugHunt()
    fireEvent.click(startButton())
    const busy = screen.getByRole('button', { name: 'Hunting…' })
    expect(busy).toBeDisabled()
    expect(desk.querySelector('.bug-layer')).not.toBeNull()
  })

  it('spawns bugs; one pointerdown squashes once, and a second pointerdown on the same bug is ignored', () => {
    const { container } = renderBugHunt()
    fireEvent.click(startButton())
    frames(1000)
    const bug = document.querySelector('button[aria-label="Squash bug"]')
    expect(bug).not.toBeNull()
    fireEvent.pointerDown(bug)
    expect(score(container)).toBe('1')
    fireEvent.pointerDown(bug)
    expect(score(container)).toBe('1')
  })

  it('removes a squashed bug after 400 ms', () => {
    renderBugHunt()
    fireEvent.click(startButton())
    frames(1000)
    const bug = document.querySelector('button[aria-label="Squash bug"]')
    fireEvent.pointerDown(bug)
    expect(bug.classList.contains('splat')).toBe(true)
    frames(400)
    expect(bug.isConnected).toBe(false)
  })

  it('shows the time left, counting down from 20 s', () => {
    const { container } = renderBugHunt()
    expect(container.querySelector('.bh-t').textContent).toBe('20')
    fireEvent.click(startButton())
    frames(1100)
    expect(container.querySelector('.bh-t').textContent).toBe('19')
  })

  it('at 20 s, reads Play again and toasts the result with one squash', () => {
    const { app, container } = renderBugHunt()
    fireEvent.click(startButton())
    frames(1000)
    fireEvent.pointerDown(document.querySelector('button[aria-label="Squash bug"]'))
    frames(19100)
    const btn = screen.getByRole('button', { name: 'Play again' })
    expect(btn).toBeEnabled()
    expect(score(container)).toBe('1')
    expect(app.toasts.store.get().list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'BugHunt',
          body: 'You squashed 1 bugs. The bugs win this round.',
          kind: 'info',
        }),
      ]),
    )
  })

  it('with 10 squashes, unlocks bugs once and toasts Exterminator-level work', () => {
    const { app } = renderBugHunt()
    const unlock = vi.spyOn(app.ach, 'unlock')
    fireEvent.click(startButton())
    frames(20100, () => {
      const current = Number(document.querySelector('.bh-s')?.textContent ?? 0)
      if (current < 10) {
        const bug = liveBug()
        if (bug) fireEvent.pointerDown(bug)
      }
    })
    expect(unlock).toHaveBeenCalledTimes(1)
    expect(unlock).toHaveBeenCalledWith('bugs')
    expect(app.toasts.store.get().list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: 'You squashed 10 bugs. Exterminator-level work.',
        }),
      ]),
    )
  })

  it('closing the window mid-round removes the layer and leaves no animation frame behind', () => {
    const { unmount } = renderBugHunt()
    fireEvent.click(startButton())
    frames(1000)
    expect(desk.querySelector('.bug-layer')).not.toBeNull()
    unmount()
    expect(desk.querySelector('.bug-layer')).toBeNull()
    expect(caf).toHaveBeenCalled()
    const rafCalls = raf.mock.calls.length
    frames(2000)
    expect(raf.mock.calls.length).toBe(rafCalls)
  })

  it('clamps a first frame stamped before the start time, so the clock does not go above 20', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
    try {
      const { container } = renderBugHunt()
      fireEvent.click(startButton())
      const cb = pending
      pending = null
      cb(990)
      expect(container.querySelector('.bh-t').textContent).toBe('20')
    } finally {
      now.mockRestore()
    }
  })

  it('under StrictMode, one round runs one frame loop and unmount leaves nothing behind', () => {
    const timers = createTimers({ raf, caf })
    const { unmount } = renderWithApp(
      <StrictMode>
        <DesktopContext.Provider value={desk}>
          <BugHunt win={{ id: 'bugs' }} />
        </DesktopContext.Provider>
      </StrictMode>,
      { timers },
    )
    fireEvent.click(startButton())
    expect(desk.querySelectorAll('.bug-layer')).toHaveLength(1)
    const before = raf.mock.calls.length
    frames(160) // 10 frames: exactly one rAF request per frame
    expect(raf.mock.calls.length - before).toBe(10)
    unmount()
    expect(desk.querySelector('.bug-layer')).toBeNull()
    const after = raf.mock.calls.length
    frames(500)
    expect(raf.mock.calls.length).toBe(after)
  })
})
