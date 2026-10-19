// Phase 5 TEST LIST: os/apps/snake/snakeLogic.test.js (pure, injected rand). Grid CW 19 × CH 15 (L962–975).
// Cells are {x, y}. turn and step return the next state and do not mutate their input.
import { describe, it, expect } from 'vitest'
import { createGame, turn, step, placeFood } from './snakeLogic.js'
import { SKILLS } from '../../../content/skills.js'

const CW = 19
const CH = 15
const zero = () => 0

// A state with a given snake and direction, with food parked in the corner away from the snake.
function withSnake(snake, dir) {
  return { ...createGame(zero), snake, dir, nd: dir, food: { x: 0, y: 0 } }
}

describe('createGame', () => {
  it('starts with the snake at (6,7), (5,7), (4,7) moving right', () => {
    const g = createGame(zero)
    expect(g.snake).toEqual([
      { x: 6, y: 7 },
      { x: 5, y: 7 },
      { x: 4, y: 7 },
    ])
    expect(g.dir).toEqual({ x: 1, y: 0 })
  })
})

describe('turn', () => {
  it('ignores the exact reverse of the current direction', () => {
    const g = createGame(zero)
    const reversed = turn(g, -1, 0)
    const { state } = step(reversed, zero)
    expect(state.snake[0]).toEqual({ x: 7, y: 7 })
  })

  it('accepts a turn at right angles', () => {
    const g = createGame(zero)
    const { state } = step(turn(g, 0, 1), zero)
    expect(state.snake[0]).toEqual({ x: 6, y: 8 })
  })
})

describe('step', () => {
  it('a plain step moves the head one cell and keeps the length (event move)', () => {
    const { state, event } = step(withSnake(createGame(zero).snake, { x: 1, y: 0 }), zero)
    expect(event).toBe('move')
    expect(state.snake).toHaveLength(3)
    expect(state.snake[0]).toEqual({ x: 7, y: 7 })
  })

  it('eating: food on the next cell gives eat, length 4, eaten [Python], and the next skill is Java', () => {
    const g = { ...createGame(zero), food: { x: 7, y: 7 } }
    const { state, event } = step(g, zero)
    expect(event).toBe('eat')
    expect(state.snake).toHaveLength(4)
    expect(state.snake[0]).toEqual({ x: 7, y: 7 })
    expect(state.eaten).toEqual(['Python'])
    expect(SKILLS[state.fi % SKILLS.length].name).toBe('Java')
  })

  it('a head moving right from x 18 leaves the board and dies', () => {
    const g = withSnake(
      [
        { x: 18, y: 7 },
        { x: 17, y: 7 },
        { x: 16, y: 7 },
      ],
      { x: 1, y: 0 },
    )
    expect(step(g, zero).event).toBe('die')
  })

  it('running into the body (not the tail) dies', () => {
    const g = withSnake(
      [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
        { x: 5, y: 6 },
        { x: 4, y: 6 },
      ],
      { x: 0, y: 1 },
    )
    expect(step(g, zero).event).toBe('die')
  })

  it('running into the tail on a non-eating step dies', () => {
    const g = withSnake(
      [
        { x: 5, y: 6 },
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
      ],
      { x: 1, y: 0 },
    )
    expect(step(g, zero).event).toBe('die')
  })
})

describe('placeFood', () => {
  it('never lands on the snake and always stays on the board', () => {
    let seed = 7
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const snake = []
    for (let x = 0; x < CW; x++) snake.push({ x, y: 7 })
    for (let i = 0; i < 300; i++) {
      const f = placeFood(snake, rand)
      expect(snake.some((s) => s.x === f.x && s.y === f.y)).toBe(false)
      expect(f.x).toBeGreaterThanOrEqual(0)
      expect(f.x).toBeLessThan(CW)
      expect(f.y).toBeGreaterThanOrEqual(0)
      expect(f.y).toBeLessThan(CH)
    }
  })
})
