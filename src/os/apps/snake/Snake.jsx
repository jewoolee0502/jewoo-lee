// Snake.exe (L962–982): eat the skills. The game is the pure snakeLogic state; this component
// draws it and runs the tick on a tracked interval (cleared on close). Score, the "Ate:" line and
// the button label are written straight to the DOM from the tick, never through React state.
// Retry restores the idle hint under the board (B2).
import { useEffect, useRef } from 'react'
import { useApp } from '../../../app/AppContext.jsx'
import { CAT } from '../../../content/skills.js'
import { own } from '../../../core/own.js'
import { CW, CH, createGame, turn, step, foodSkill } from './snakeLogic.js'

const SZ = 20
const ATE_IDLE = 'Arrow keys / WASD, swipe, or the pad below.'
const KEYS = new Map([
  ['arrowup', [0, -1]],
  ['arrowdown', [0, 1]],
  ['arrowleft', [-1, 0]],
  ['arrowright', [1, 0]],
  ['w', [0, -1]],
  ['s', [0, 1]],
  ['a', [-1, 0]],
  ['d', [1, 0]],
])
const PAD = [
  ['Up', '▲', 0, -1],
  ['Left', '◀', -1, 0],
  ['Down', '▼', 0, 1],
  ['Right', '▶', 1, 0],
]
const rand = () => Math.random()

export default function Snake() {
  const app = useApp()
  const cvRef = useRef(null)
  const scoreRef = useRef(null)
  const ateRef = useRef(null)
  const goRef = useRef(null)
  const gameRef = useRef(null)
  const swipe = useRef(null)

  useEffect(() => {
    const cv = cvRef.current
    const x = cv.getContext('2d')
    let g = createGame(rand)
    let alive = false
    let played = false
    let stopTimer = null
    const setText = (ref, text) => {
      if (ref.current) ref.current.textContent = text
    }

    function draw() {
      x.fillStyle = '#0E1A12'
      x.fillRect(0, 0, 380, 300)
      x.fillStyle = 'rgba(124,255,160,.06)'
      for (let i = 0; i < CW; i++) for (let j = 0; j < CH; j++) if ((i + j) % 2) x.fillRect(i * SZ, j * SZ, SZ, SZ)
      const sk = foodSkill(g)
      x.fillStyle = own(CAT, sk.cat)?.color ?? '#2F7FD0'
      x.fillRect(g.food.x * SZ + 1, g.food.y * SZ + 1, SZ - 2, SZ - 2)
      x.fillStyle = '#fff'
      x.font = '9px Silkscreen, monospace'
      x.textAlign = 'center'
      x.fillText(sk.name.slice(0, 2).toUpperCase(), g.food.x * SZ + 10, g.food.y * SZ + 14)
      g.snake.forEach((s, i) => {
        x.fillStyle = i ? '#3BB273' : '#7CFFA0'
        x.fillRect(s.x * SZ + 1, s.y * SZ + 1, SZ - 2, SZ - 2)
      })
      if (!alive) {
        x.fillStyle = 'rgba(0,0,0,.55)'
        x.fillRect(0, 0, 380, 300)
        x.fillStyle = '#fff'
        x.font = '16px Silkscreen, monospace'
        x.fillText(played ? 'GAME OVER · ' + g.eaten.length + ' SKILLS' : 'PRESS START', 190, 150)
      }
      x.textAlign = 'left'
    }

    function stopTicking() {
      stopTimer?.()
      stopTimer = null
    }

    function tick() {
      const r = step(g, rand)
      g = r.state
      if (r.event === 'die') {
        alive = false
        stopTicking()
        setText(goRef, 'Retry')
        app.snd.off()
      } else if (r.event === 'eat') {
        setText(scoreRef, String(g.eaten.length))
        setText(ateRef, 'Ate: ' + g.eaten.join(', '))
        app.snd.tone(880, 0.06, 'square', 0.04)
        if (g.eaten.length === 5) app.ach.unlock('snake')
      }
      draw()
    }

    function start() {
      // The board shown before the first game is already a fresh game; later starts reset (L968).
      if (played) g = createGame(rand)
      else g = { ...g, dir: { x: 1, y: 0 }, nd: { x: 1, y: 0 } }
      played = true
      setText(scoreRef, '0')
      setText(ateRef, ATE_IDLE)
      alive = true
      stopTicking()
      stopTimer = app.timers.interval(tick, app.motion.reduce() ? 160 : 120)
      setText(goRef, 'Restart')
      cv.focus({ preventScroll: true })
      draw()
    }

    gameRef.current = {
      start,
      turn(dx, dy) {
        g = turn(g, dx, dy)
      },
      alive: () => alive,
    }
    draw()
    return () => {
      stopTicking()
      gameRef.current = null
    }
  }, [app])

  function onKeyDown(e) {
    const k = KEYS.get(String(e.key || '').toLowerCase())
    if (!k) return
    // Arrow keys and WASD never scroll the page while focus is in Snake; they steer only while alive.
    e.preventDefault()
    const game = gameRef.current
    if (game?.alive()) game.turn(k[0], k[1])
  }

  function onSwipeEnd(e) {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) <= 20) return
    if (Math.abs(dx) > Math.abs(dy)) gameRef.current?.turn(Math.sign(dx), 0)
    else gameRef.current?.turn(0, Math.sign(dy))
  }

  return (
    <div onKeyDown={onKeyDown}>
      <div className="game-row">
        <span>
          SCORE{' '}
          <b className="sn-s" ref={scoreRef}>
            0
          </b>
        </span>
        <button type="button" className="btn sn-go" ref={goRef} onClick={() => gameRef.current?.start()}>
          Start
        </button>
      </div>
      <canvas
        ref={cvRef}
        className="snake-cv"
        width={380}
        height={300}
        tabIndex={0}
        aria-label="Snake game. Use arrow keys or WASD."
        onPointerDown={(e) => {
          swipe.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerUp={onSwipeEnd}
        onPointerCancel={() => {
          swipe.current = null
        }}
      />
      <p className="muted sn-ate" ref={ateRef} style={{ marginTop: 8, fontSize: 14 }}>
        {ATE_IDLE}
      </p>
      <div className="dpad">
        <span />
        {PAD.slice(0, 1).map(([label, glyph, dx, dy]) => (
          <button key={label} type="button" aria-label={label} onClick={() => gameRef.current?.turn(dx, dy)}>
            {glyph}
          </button>
        ))}
        <span />
        {PAD.slice(1).map(([label, glyph, dx, dy]) => (
          <button key={label} type="button" aria-label={label} onClick={() => gameRef.current?.turn(dx, dy)}>
            {glyph}
          </button>
        ))}
      </div>
    </div>
  )
}
