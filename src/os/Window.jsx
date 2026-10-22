// One desktop window (L702–709). Dragging writes left/top straight to the element and
// commits to the store once on pointerup, so a drag never re-renders the desktop.
import { memo, useEffect, useRef } from 'react'
import { useApp } from '../app/AppContext.jsx'
import { dragPosition } from './windowMath.js'

function Window({ win, focused }) {
  const app = useApp()
  const ref = useRef(null)
  const drag = useRef(null)
  const def = app.os.getDef(win.id)
  const Component = def?.Component

  // Restart the shake animation on every re-open of an open window.
  useEffect(() => {
    const el = ref.current
    if (!win.shakeNonce || !el) return
    el.classList.remove('shake')
    void el.offsetWidth
    el.classList.add('shake')
  }, [win.shakeNonce])

  function onHeaderDown(e) {
    if (e.target.closest('button') || app.os.store.get().compact) return
    const el = ref.current
    const l = parseFloat(el.style.left)
    const t = parseFloat(el.style.top)
    drag.current = {
      l: Number.isFinite(l) ? l : win.x,
      t: Number.isFinite(t) ? t : win.y,
      x: e.clientX,
      y: e.clientY,
      s: app.host.scale(),
      pos: null,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.currentTarget.style.cursor = 'grabbing'
  }

  function onHeaderMove(e) {
    const d = drag.current
    if (!d) return
    const el = ref.current
    d.pos = dragPosition(d, e.clientX, e.clientY, el.offsetWidth || win.w, app.host.size())
    el.style.left = d.pos.left + 'px'
    el.style.top = d.pos.top + 'px'
  }

  function onHeaderEnd(e) {
    const d = drag.current
    if (!d) return
    drag.current = null
    e.currentTarget.style.cursor = ''
    if (d.pos) app.os.moveWindow(win.id, d.pos.left, d.pos.top)
  }

  let className = 'win'
  if (focused) className += ' focused'
  if (win.opening) className += ' opening'

  return (
    <section
      ref={ref}
      className={className}
      data-app={win.id}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z, '--wc': win.color }}
      onPointerDown={() => app.os.focus(win.id)}
    >
      <header
        className="tb"
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderEnd}
        onPointerCancel={onHeaderEnd}
      >
        <span className="tb-t">{win.title}</span>
        <button
          className="tb-x"
          aria-label="Close window"
          onClick={(e) => {
            e.stopPropagation()
            app.os.closeApp(win.id)
          }}
        >
          ✕
        </button>
      </header>
      <div className="wb">{Component ? <Component win={win} /> : null}</div>
    </section>
  )
}

export default memo(Window)
