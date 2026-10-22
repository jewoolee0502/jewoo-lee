// BugHunt.exe (L940–958). Bugs crawl over the whole desktop, in a `.bug-layer` portalled into
// the desktop element. The round runs on tracked animation frames from app.timers; the score,
// clock and button are written straight to the DOM each frame, never through React state.
// Closing the window cancels the frame, every splat timeout and the layer (B5, B16).
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../../app/AppContext.jsx'
import { useDesktopEl } from '../../DesktopContext.js'
import { ICON } from '../../../lib/pixelIcons.js'
import { ROUND_S, spawnInterval, spawnBug, stepBug, isOut } from './bugLogic.js'

const rand = () => Math.random()

function resultText(n) {
  return 'You squashed ' + n + ' bugs. ' + (n >= 10 ? 'Exterminator-level work.' : 'The bugs win this round.')
}

export default function BugHunt() {
  const app = useApp()
  const desk = useDesktopEl()
  const [layerOn, setLayerOn] = useState(false)
  const layerRef = useRef(null)
  const scoreRef = useRef(null)
  const timeRef = useRef(null)
  const goRef = useRef(null)
  const gameRef = useRef(null)

  useEffect(() => {
    // Cancel functions of this window's pending frame and splat timeouts.
    const cancels = new Set()
    const later = (ms, fn) => {
      const cancel = app.timers.timeout(() => {
        cancels.delete(cancel)
        fn()
      }, ms)
      cancels.add(cancel)
    }
    const schedule = () => {
      const cancel = app.timers.raf((t) => {
        cancels.delete(cancel)
        frame(t)
      })
      cancels.add(cancel)
    }
    let bugs = []
    let left = 0
    let score = 0
    let spawnT = 0
    let last = 0

    function stop() {
      for (const cancel of [...cancels]) cancel()
      cancels.clear()
      for (const o of bugs) o.el.remove()
      bugs = []
    }

    function spawn() {
      const layer = layerRef.current
      if (!layer) return
      const o = spawnBug(app.os.size(), left, rand)
      const el = document.createElement('button')
      el.className = 'bugx'
      el.type = 'button'
      el.setAttribute('aria-label', 'Squash bug')
      const img = document.createElement('img')
      img.alt = ''
      img.src = ICON.bug
      el.appendChild(img)
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation()
        if (o.dead) return
        o.dead = true
        el.classList.add('splat')
        score++
        if (scoreRef.current) scoreRef.current.textContent = String(score)
        app.snd.pop()
        later(400, () => el.remove())
      })
      o.el = el
      layer.appendChild(el)
      bugs.push(o)
    }

    function frame(t) {
      // A frame stamped before the start time counts as no time (the clock never goes above 20).
      const dt = Math.min(0.05, Math.max(0, (t - last) / 1000 || 0.016))
      last = t
      left -= dt
      if (timeRef.current) timeRef.current.textContent = String(Math.max(0, Math.ceil(left)))
      spawnT -= dt
      if (spawnT <= 0) {
        spawn()
        spawnT = spawnInterval(left)
      }
      const size = app.os.size()
      for (const o of bugs) {
        if (o.dead) continue
        stepBug(o, dt, rand)
        if (isOut(o, size)) {
          o.dead = true
          o.el.remove()
        } else o.el.style.transform = 'translate(' + o.x + 'px,' + o.y + 'px) rotate(' + (o.a + Math.PI / 2) + 'rad)'
      }
      bugs = bugs.filter((o) => !o.dead || o.el.isConnected)
      if (left <= 0) {
        stop()
        const go = goRef.current
        if (go) {
          go.textContent = 'Play again'
          go.disabled = false
        }
        app.toasts.toast('BugHunt', resultText(score), 'info')
        if (score >= 10) app.ach.unlock('bugs')
        return
      }
      schedule()
    }

    function start() {
      stop()
      score = 0
      left = ROUND_S
      spawnT = 0
      if (scoreRef.current) scoreRef.current.textContent = '0'
      const go = goRef.current
      if (go) {
        go.disabled = true
        go.textContent = 'Hunting…'
      }
      last = performance.now()
      schedule()
    }

    gameRef.current = { start }
    return () => {
      stop()
      gameRef.current = null
    }
  }, [app])

  function onStart() {
    setLayerOn(true)
    gameRef.current?.start()
  }

  return (
    <div>
      <p style={{ marginBottom: 8 }}>
        Bugs are loose on the desktop. Squash as many as you can in <b>20 seconds</b>.
      </p>
      <div className="game-row">
        <span>
          SCORE{' '}
          <b className="bh-s" ref={scoreRef}>
            0
          </b>
        </span>
        <span>
          TIME{' '}
          <b className="bh-t" ref={timeRef}>
            20
          </b>
        </span>
      </div>
      <button type="button" className="btn bh-go" ref={goRef} onClick={onStart}>
        Start hunt
      </button>
      {layerOn && desk ? createPortal(<div className="bug-layer" ref={layerRef} />, desk) : null}
    </div>
  )
}
