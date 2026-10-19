// Snake rules (L962–976), pure with an injected rand. States are never mutated.
import { SKILLS } from '../../../content/skills.js'

export const CW = 19
export const CH = 15

const onSnake = (snake, c) => snake.some((s) => s.x === c.x && s.y === c.y)

/** A random free cell (L967). */
export function placeFood(snake, rand = Math.random) {
  let food
  do food = { x: Math.floor(rand() * CW), y: Math.floor(rand() * CH) }
  while (onSnake(snake, food))
  return food
}

/** The state after reset() (L968). */
export function createGame(rand = Math.random) {
  const snake = [
    { x: 6, y: 7 },
    { x: 5, y: 7 },
    { x: 4, y: 7 },
  ]
  const dir = { x: 1, y: 0 }
  return { snake, dir, nd: dir, food: placeFood(snake, rand), fi: 0, eaten: [] }
}

/** The skill the current food stands for (food cycles through SKILLS in order). */
export const foodSkill = (state) => SKILLS[state.fi % SKILLS.length]

/** L976: queue a turn, ignoring the exact reverse of the last applied direction. */
export function turn(state, dx, dy) {
  if (dx === -state.dir.x && dy === -state.dir.y) return state
  return { ...state, nd: { x: dx, y: dy } }
}

/** L973–975: one tick. Returns {state, event: 'move' | 'eat' | 'die'}. */
export function step(state, rand = Math.random) {
  const dir = state.nd
  const head = { x: state.snake[0].x + dir.x, y: state.snake[0].y + dir.y }
  if (head.x < 0 || head.y < 0 || head.x >= CW || head.y >= CH || onSnake(state.snake, head)) {
    return { state: { ...state, dir }, event: 'die' }
  }
  if (head.x === state.food.x && head.y === state.food.y) {
    const snake = [head, ...state.snake]
    return {
      state: {
        ...state,
        dir,
        snake,
        eaten: [...state.eaten, foodSkill(state).name],
        fi: state.fi + 1,
        food: placeFood(snake, rand),
      },
      event: 'eat',
    }
  }
  return { state: { ...state, dir, snake: [head, ...state.snake.slice(0, -1)] }, event: 'move' }
}
