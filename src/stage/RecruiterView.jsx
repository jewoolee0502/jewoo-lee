// Recruiter view (L289–304), with the CV and résumé links (D15). Escape is handled by the
// global key handler (keys.js); this component handles the buttons, the backdrop and focus.
import { useEffect, useRef } from 'react'
import { useApp } from '../app/AppContext.jsx'
import { useStore } from '../core/store.js'
import { PROFILE } from '../content/index.js'

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

export default function RecruiterView({ returnFocusRef }) {
  const app = useApp()
  const open = useStore(app.ui.store, (s) => s.recOpen)
  const recRef = useRef(null)
  const closeRef = useRef(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true })
    else if (wasOpen.current) {
      // Return focus to the HUD button, unless something else (the résumé heading) took it.
      const active = document.activeElement
      if (!active || active === document.body || recRef.current?.contains(active)) {
        returnFocusRef?.current?.focus({ preventScroll: true })
      }
    }
    wasOpen.current = open
  }, [open, returnFocusRef])

  const close = () => app.ui.store.set({ recOpen: false })

  // Focus trap: Tab on the last control wraps to the first, Shift+Tab on the first to the last.
  function trapTab(e) {
    if (e.key !== 'Tab') return
    const items = [...e.currentTarget.querySelectorAll(FOCUSABLE)]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || !e.currentTarget.contains(active))) {
      e.preventDefault()
      last.focus({ preventScroll: true })
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus({ preventScroll: true })
    }
  }

  return (
    <div
      className="rec"
      id="rec"
      ref={recRef}
      hidden={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="rec-card" role="dialog" aria-modal="true" aria-label="Recruiter view" onKeyDown={trapTab}>
        <span className="eyebrow">The 10-second version</span>
        <h2>{PROFILE.name}</h2>
        <p style={{ color: 'var(--muted)', marginTop: 6 }}>{PROFILE.tagline}</p>
        <ul>
          {PROFILE.recruiter.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="row">
          <a href={PROFILE.links.github} target="_blank" rel="noopener">
            GitHub
          </a>
          <a href={PROFILE.links.linkedin} target="_blank" rel="noopener">
            LinkedIn
          </a>
          <a href={PROFILE.cv} download>
            CV (PDF)
          </a>
          <button
            type="button"
            onClick={() => {
              close()
              app.nav.goToResume()
            }}
          >
            Full résumé ↓
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" id="rec-close" ref={closeRef} onClick={close}>
            Back to the fun
          </button>
        </div>
      </div>
    </div>
  )
}
