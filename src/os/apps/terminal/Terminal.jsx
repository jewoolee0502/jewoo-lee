// jaysh window (L888–937). History and output live in this component, so they are lost
// when the window closes (faithful). Commands run through the pure runner in commands.js.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '../../../app/AppContext.jsx'
import { createTimers } from '../../../core/timers.js'
import { PROJECTS, ROLES, SKILLS, PROFILE } from '../../../content/index.js'
import { createRunner, PROMPT } from './commands.js'

const BANNER = { id: 0, text: 'jaysh 0.2 · type "help" to see what this computer can do.', cls: 'd', pre: false }

export default function Terminal({ win }) {
  const app = useApp()
  const [lines, setLines] = useState(() => [BANNER])
  const outRef = useRef(null)
  const inRef = useRef(null)
  const hiRef = useRef(0)
  const lastNonce = useRef(null)
  const term = useRef(null)

  if (!term.current) {
    let nextId = 1
    const push = (text, cls, pre) => {
      const row = { id: nextId++, text, cls: cls || '', pre }
      setLines((l) => [...l, row])
    }
    const timers = createTimers()
    const history = []
    const runner = createRunner({
      say: (text, cls) => push(text, cls, false),
      pre: (text) => push(text, '', true),
      clear: () => setLines([]),
      history,
      os: app.os,
      get ctrl() {
        return app.ctrl
      },
      scene: () => app.scene?.api ?? null,
      ach: app.ach,
      wallpaper: app.wallpaper,
      content: { PROJECTS, ROLES, SKILLS, PROFILE },
      timers,
    })
    term.current = { runner, history, timers, push }
  }

  const run = (raw) => {
    const { runner, history } = term.current
    runner.run(raw)
    hiRef.current = history.length
  }

  // Pending exit/shutdown timers die with the window.
  useEffect(() => {
    const { timers } = term.current
    return () => timers.clearAll()
  }, [])

  // Focus the prompt shortly after the window opens (L936).
  useEffect(() => {
    const id = setTimeout(() => inRef.current?.focus({ preventScroll: true }), 60)
    return () => clearTimeout(id)
  }, [])

  // Re-opened while open (the desktop icon again): the caret goes back to the prompt. `opened`
  // moves only on a re-open, so a plain focus (a pointerdown on the window) or another window
  // taking focus never pulls the keyboard here. The first open is the timer above.
  const opened = win?.opened
  const lastOpened = useRef(opened)
  useEffect(() => {
    if (opened === lastOpened.current) return
    lastOpened.current = opened
    inRef.current?.focus({ preventScroll: true })
  }, [opened])

  // Keep the newest output in view.
  useLayoutEffect(() => {
    const el = outRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  // Commands sent from outside (menus, scene hotspots): one run per nonce, StrictMode-safe.
  const cmd = win?.cmd
  useEffect(() => {
    if (!cmd || lastNonce.current === cmd.nonce) return
    lastNonce.current = cmd.nonce
    run(cmd.text)
    // `run` only reads refs; re-running on its identity would repeat the command.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmd?.nonce])

  function onKeyDown(e) {
    const inp = e.currentTarget
    const { history, runner } = term.current
    if (e.key === 'Enter') {
      run(inp.value)
      inp.value = ''
    } else if (e.key === 'ArrowUp') {
      if (hiRef.current > 0) {
        hiRef.current -= 1
        inp.value = history[hiRef.current]
      }
      e.preventDefault()
    } else if (e.key === 'ArrowDown') {
      if (hiRef.current < history.length - 1) {
        hiRef.current += 1
        inp.value = history[hiRef.current]
      } else {
        hiRef.current = history.length
        inp.value = ''
      }
      e.preventDefault()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const v = inp.value.toLowerCase()
      const m = runner.names.filter((k) => k.startsWith(v))
      if (m.length === 1) inp.value = m[0] + ' '
      else if (m.length) term.current.push(m.join('  '), 'd', false)
    }
  }

  return (
    <div className="term" onClick={() => inRef.current?.focus({ preventScroll: true })}>
      <div className="t-out" ref={outRef}>
        {lines.map((l) =>
          l.pre ? (
            <pre key={l.id}>{l.text}</pre>
          ) : (
            <div key={l.id} className={l.cls}>
              {l.text}
            </div>
          ),
        )}
      </div>
      <label className="t-line">
        <span className="t-ps">{PROMPT}</span>
        <input
          ref={inRef}
          className="t-in"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-label="Terminal command"
          onKeyDown={onKeyDown}
        />
      </label>
    </div>
  )
}
