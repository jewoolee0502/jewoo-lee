// Paint (L986–1004): a 24×24 pixel canvas. Save to the desktop, or pin to the Visitor Wall.
// The grid lives in a ref and is drawn straight to the canvas (no React state per stroke).
// Each move paints every cell between the previous and current cell, so fast strokes stay
// continuous. A stroke ends on pointerup, pointercancel or lostpointercapture (B3); the canvas has
// touch-action:none in apps.css so painting never scrolls the page.
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../../app/AppContext.jsx'
import { N, COLS, cellFromPoint, cellsBetween, emptyGrid, exportPng, isEmpty } from './paintLogic.js'

const SZ = 14
const PX = N * SZ
const ERASER_BG = 'repeating-linear-gradient(45deg,#fff 0 4px,#ddd 4px 8px)'
const SEND_FAILED = 'That drawing couldn’t be sent.'
const PIN_ERRORS = new Map([
  ['rate_limited', 'Slow down a little. Try again later.'],
  ['queue_full', 'The queue is full right now. Try again later.'],
  ['bad_png', SEND_FAILED],
  ['too_large', SEND_FAILED],
  ['bad_size', SEND_FAILED],
])
const PIN_FAILED = 'Couldn’t reach the wall. Try again.'

export default function Paint() {
  const app = useApp()
  const cvRef = useRef(null)
  const gridRef = useRef(emptyGrid())
  const curRef = useRef(COLS[0])
  const drawRef = useRef(() => {})
  const [cur, setCur] = useState(COLS[0])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const cv = cvRef.current
    const x = cv.getContext('2d')
    const grid = gridRef.current
    let down = false
    let last = null

    function draw() {
      if (!x) return
      x.fillStyle = '#fff'
      x.fillRect(0, 0, PX, PX)
      grid.forEach((c, i) => {
        if (!c) return
        x.fillStyle = c
        x.fillRect((i % N) * SZ, Math.floor(i / N) * SZ, SZ, SZ)
      })
      x.strokeStyle = 'rgba(18,32,48,.08)'
      x.beginPath()
      for (let i = 1; i < N; i++) {
        x.moveTo(i * SZ + 0.5, 0)
        x.lineTo(i * SZ + 0.5, PX)
        x.moveTo(0, i * SZ + 0.5)
        x.lineTo(PX, i * SZ + 0.5)
      }
      x.stroke()
    }

    function paint(e) {
      const cell = cellFromPoint(cv.getBoundingClientRect(), e.clientX, e.clientY)
      if (!cell) {
        last = null // left the canvas: re-entering starts a new segment instead of bridging the gap
        return
      }
      const from = last ?? cell
      last = cell
      let changed = false
      for (const c of cellsBetween(from, cell)) {
        const i = c.y * N + c.x
        if (grid[i] === curRef.current) continue
        grid[i] = curRef.current
        changed = true
      }
      if (changed) draw()
    }

    const onDown = (e) => {
      down = true
      last = null
      try {
        cv.setPointerCapture?.(e.pointerId)
      } catch {
        // Capture can fail for a pointer that is already gone; painting still works.
      }
      paint(e)
    }
    const onMove = (e) => {
      if (down) paint(e)
    }
    const onEnd = () => {
      down = false
      last = null
    }

    cv.addEventListener('pointerdown', onDown)
    cv.addEventListener('pointermove', onMove)
    cv.addEventListener('pointerup', onEnd)
    cv.addEventListener('pointercancel', onEnd)
    cv.addEventListener('lostpointercapture', onEnd)
    drawRef.current = draw
    draw()
    return () => {
      cv.removeEventListener('pointerdown', onDown)
      cv.removeEventListener('pointermove', onMove)
      cv.removeEventListener('pointerup', onEnd)
      cv.removeEventListener('pointercancel', onEnd)
      cv.removeEventListener('lostpointercapture', onEnd)
      drawRef.current = () => {}
    }
  }, [])

  const pick = (c) => {
    curRef.current = c
    setCur(c)
  }

  /** The drawing as a PNG data URL, or null (and the empty toast) when nothing is drawn. */
  const takePng = () => {
    if (isEmpty(gridRef.current)) {
      app.toasts.toast('Paint', 'Draw something first!', 'info')
      return null
    }
    return exportPng(gridRef.current)
  }

  const save = () => {
    const png = takePng()
    if (!png) return
    const n = app.os.addArt(png)
    app.toasts.toast('Saved', 'my-art-' + n + '.png is on the desktop.', 'info')
    app.ach.unlock('paint')
  }

  const pin = async () => {
    if (sending) return
    const png = takePng()
    if (!png) return
    setSending(true)
    let result
    try {
      result = await app.wall.submit(png)
    } catch {
      result = { ok: false, code: 'network' }
    }
    setSending(false)
    if (result?.ok) {
      app.ach.unlock('paint')
      app.toasts.toast('Pinned!', 'It’s waiting for Jay’s approval.', 'info')
    } else {
      app.toasts.toast('Visitor Wall', PIN_ERRORS.get(result?.code) ?? PIN_FAILED, 'info')
    }
  }

  const clear = () => {
    gridRef.current.fill(null)
    drawRef.current()
  }

  return (
    <div>
      <canvas ref={cvRef} className="paint-cv" width={PX} height={PX} aria-label="Pixel canvas" />
      <div className="palette">
        {COLS.map((c) => (
          <button
            key={c ?? 'eraser'}
            type="button"
            className={c === cur ? 'on' : undefined}
            style={{ background: c ?? ERASER_BG }}
            aria-label={c ? 'Colour ' + c : 'Eraser'}
            onClick={() => pick(c)}
          />
        ))}
      </div>
      <div className="game-row">
        <button type="button" className="btn" onClick={save}>
          Save to desktop
        </button>
        <button type="button" className="btn" style={{ background: '#C8955E' }} disabled={sending} onClick={pin}>
          Pin to wall
        </button>
        <button type="button" className="btn" style={{ background: '#fff' }} onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  )
}
