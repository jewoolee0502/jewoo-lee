// Phase 5 TEST LIST: os/apps/snake/Snake.test.jsx (fake timers, controlled Math.random for food).
// Food is placed with x = floor(rand * 19) then y = floor(rand * 15). queueFood() feeds that
// sequence; any extra placement falls back to rand 0, which is cell (0,0), far from the snake's path.
// The head is found by its fillRect at (x*20+1, y*20+1) with size 18 (L969–972).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StrictMode } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithApp } from '../../../test/renderWithApp.jsx'
import { setReducedMotion } from '../../../test/setup.js'
import * as logic from './snakeLogic.js'
import Snake from './Snake.jsx'

vi.mock('./snakeLogic.js', async (importOriginal) => {
  const mod = await importOriginal()
  return { ...mod, turn: vi.fn(mod.turn) }
})

const SZ = 20
const ATE_IDLE = 'Arrow keys / WASD, swipe, or the pad below.'

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

function queueFood(cells) {
  const vals = cells.flatMap(([x, y]) => [(x + 0.5) / 19, (y + 0.5) / 15])
  let i = 0
  vi.spyOn(Math, 'random').mockImplementation(() => (i < vals.length ? vals[i++] : 0))
}

function renderSnake(overrides = {}) {
  const result = renderWithApp(<Snake win={{ id: 'snake' }} />, overrides)
  const canvas = result.container.querySelector('canvas')
  const ctx = canvas.getContext('2d')
  return { ...result, canvas, ctx }
}

const drewText = (ctx, text, x, y) =>
  ctx.calls.some((c) => c[0] === 'fillText' && c[1] === text && c[2] === x && c[3] === y)
const drewHeadAt = (ctx, cx, cy) =>
  ctx.calls.some(
    (c) => c[0] === 'fillRect' && c[1] === cx * SZ + 1 && c[2] === cy * SZ + 1 && c[3] === SZ - 2 && c[4] === SZ - 2,
  )
const startButton = () => screen.getByRole('button', { name: 'Start' })
const ateText = (container) => container.querySelector('.sn-ate').textContent

describe('Snake before and after start', () => {
  it('shows PRESS START on the canvas before the first game', () => {
    const { ctx } = renderSnake()
    expect(drewText(ctx, 'PRESS START', 190, 150)).toBe(true)
  })

  it('Start becomes Restart and focuses the canvas', () => {
    const { canvas } = renderSnake()
    fireEvent.click(startButton())
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument()
    expect(document.activeElement).toBe(canvas)
  })

  it('moves one cell every 120 ms', () => {
    const { ctx } = renderSnake()
    fireEvent.click(startButton())
    vi.advanceTimersByTime(120)
    expect(drewHeadAt(ctx, 7, 7)).toBe(true)
  })

  it('with reduced motion, moves every 160 ms instead', () => {
    setReducedMotion(true)
    const { ctx } = renderSnake()
    fireEvent.click(startButton())
    vi.advanceTimersByTime(120)
    expect(drewHeadAt(ctx, 7, 7)).toBe(false)
    vi.advanceTimersByTime(40)
    expect(drewHeadAt(ctx, 7, 7)).toBe(true)
  })
})

describe('Snake controls', () => {
  it('ArrowDown turns the head down, so after one step it is at y 8', () => {
    const { canvas, ctx } = renderSnake()
    fireEvent.click(startButton())
    fireEvent.keyDown(canvas, { key: 'ArrowDown' })
    vi.advanceTimersByTime(120)
    expect(drewHeadAt(ctx, 6, 8)).toBe(true)
  })

  it('the D-pad Up button calls turn even while the snake is dead', () => {
    renderSnake()
    fireEvent.click(startButton())
    vi.advanceTimersByTime(120 * 14) // runs into the right wall
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    logic.turn.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Up' }))
    expect(logic.turn).toHaveBeenCalledWith(expect.anything(), 0, -1)
  })
})

describe('Snake keys while not running', () => {
  it('before Start, ArrowDown is default-prevented but does not turn or start the game', () => {
    const { canvas, ctx, container } = renderSnake()
    logic.turn.mockClear()
    const callsBefore = ctx.calls.length
    const dispatchResult = fireEvent.keyDown(canvas, { key: 'ArrowDown' })
    expect(dispatchResult).toBe(false)
    expect(logic.turn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(ctx.calls.length).toBe(callsBefore)
    expect(startButton()).toBeInTheDocument()
    expect(ateText(container)).toBe(ATE_IDLE)
  })

  it('after game over, ArrowDown is default-prevented and does not turn the dead snake', () => {
    const { canvas } = renderSnake()
    fireEvent.click(startButton())
    vi.advanceTimersByTime(120 * 14) // runs into the right wall
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    logic.turn.mockClear()
    const dispatchResult = fireEvent.keyDown(canvas, { key: 'ArrowDown' })
    expect(dispatchResult).toBe(false)
    expect(logic.turn).not.toHaveBeenCalled()
  })

  it('while alive, ArrowDown is default-prevented and turns the snake', () => {
    const { canvas } = renderSnake()
    fireEvent.click(startButton())
    logic.turn.mockClear()
    const dispatchResult = fireEvent.keyDown(canvas, { key: 'ArrowDown' })
    expect(dispatchResult).toBe(false)
    expect(logic.turn).toHaveBeenCalledWith(expect.anything(), 0, 1)
  })
})

describe('Snake game over and reset', () => {
  it('after eating one skill and dying, draws GAME OVER · 1 SKILLS and the button reads Retry', () => {
    queueFood([[7, 7]])
    const { ctx } = renderSnake()
    fireEvent.click(startButton())
    vi.advanceTimersByTime(120 * 20)
    expect(drewText(ctx, 'GAME OVER · 1 SKILLS', 190, 150)).toBe(true)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('after eating, dying and Retry, the Ate line is back to the idle hint (B2)', () => {
    queueFood([[7, 7]])
    const { container } = renderSnake()
    fireEvent.click(startButton())
    vi.advanceTimersByTime(120)
    expect(ateText(container)).toBe('Ate: Python')
    vi.advanceTimersByTime(120 * 20)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(ateText(container)).toBe(ATE_IDLE)
  })

  it('eating 5 skills unlocks snake exactly once', () => {
    queueFood([
      [7, 7],
      [8, 7],
      [9, 7],
      [10, 7],
      [11, 7],
    ])
    const { app } = renderSnake()
    const unlock = vi.spyOn(app.ach, 'unlock')
    fireEvent.click(startButton())
    vi.advanceTimersByTime(120 * 5)
    expect(unlock).toHaveBeenCalledTimes(1)
    expect(unlock).toHaveBeenCalledWith('snake')
    vi.advanceTimersByTime(120 * 20)
    expect(unlock).toHaveBeenCalledTimes(1)
  })

  it('unmounting clears the interval, so later time draws nothing', () => {
    const { unmount, ctx } = renderSnake()
    fireEvent.click(startButton())
    unmount()
    const before = ctx.calls.length
    vi.advanceTimersByTime(1000)
    expect(ctx.calls.length).toBe(before)
  })

  it('under StrictMode, runs a single interval and stops it on unmount', () => {
    const result = renderWithApp(
      <StrictMode>
        <Snake win={{ id: 'snake' }} />
      </StrictMode>,
    )
    const ctx = result.container.querySelector('canvas').getContext('2d')
    fireEvent.click(startButton())
    const heads = () => ctx.calls.filter((c) => c[0] === 'fillRect' && c[3] === SZ - 2 && c[4] === SZ - 2).length
    const before = heads()
    vi.advanceTimersByTime(120)
    // One tick redraws food + 3 segments once; a second interval would double that.
    expect(heads() - before).toBe(4)
    result.unmount()
    const calls = ctx.calls.length
    vi.advanceTimersByTime(1000)
    expect(ctx.calls.length).toBe(calls)
  })
})
