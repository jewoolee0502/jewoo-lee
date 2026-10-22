// Matrix rain and confetti overlays (L732–740), driven by tracked animation frames.
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../app/AppContext.jsx'
import { useStore } from '../core/store.js'

const MATRIX_CHARS = 'ジェウ제우JAY01アカサタナ'
const CONFETTI = ['#FFD15C', '#4AA6EE', '#E8452E', '#3BB273', '#C9A7FF']

function matrix(c, x) {
  const cols = Math.floor(c.width / 16)
  const ys = Array.from({ length: cols }, () => Math.random() * -40)
  return () => {
    x.fillStyle = 'rgba(0,8,2,.12)'
    x.fillRect(0, 0, c.width, c.height)
    x.fillStyle = '#7CFFA0'
    x.font = '16px VT323, monospace'
    ys.forEach((y, i) => {
      x.fillText(MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)], i * 16, y * 16)
      ys[i] = y * 16 > c.height && Math.random() > 0.97 ? 0 : y + 1
    })
  }
}

function confetti(c, x) {
  const P = Array.from({ length: 140 }, (_, i) => ({
    x: c.width / 2,
    y: c.height / 2,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 3,
    c: CONFETTI[i % 5],
    r: Math.random() * 6,
  }))
  return () => {
    x.clearRect(0, 0, c.width, c.height)
    P.forEach((p) => {
      p.vy += 0.35
      p.x += p.vx
      p.y += p.vy
      p.r += 0.2
      x.save()
      x.translate(p.x, p.y)
      x.rotate(p.r)
      x.fillStyle = p.c
      x.fillRect(-5, -3, 10, 6)
      x.restore()
    })
  }
}

const KINDS = new Map([
  ['matrix', { make: matrix, ms: 4500 }],
  ['confetti', { make: confetti, ms: 2600 }],
])

function FxCanvas({ kind }) {
  const app = useApp()
  const ref = useRef(null)
  const [size] = useState(() => app.host.size())

  useEffect(() => {
    const spec = KINDS.get(kind)
    const c = ref.current
    const x = c?.getContext('2d')
    if (!spec || !x) {
      app.os.stopFx()
      return undefined
    }
    const draw = spec.make(c, x)
    let t0 = null
    let cancel = null
    const frame = (t) => {
      if (t0 == null) t0 = t
      draw()
      if (t - t0 < spec.ms) cancel = app.timers.raf(frame)
      else {
        cancel = null
        app.os.stopFx()
      }
    }
    cancel = app.timers.raf(frame)
    return () => cancel?.()
  }, [app, kind])

  return <canvas ref={ref} className="fx" width={size.w} height={size.h} />
}

export default function Fx() {
  const { os } = useApp()
  const fx = useStore(os.store, (s) => s.fx)
  return fx ? <FxCanvas key={fx.nonce} kind={fx.kind} /> : null
}
