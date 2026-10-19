// Stage HUD (L275–280, without the dead #hud-exit, B12) plus the "Résumé ↓" button (D11).
import { useApp } from '../app/AppContext.jsx'
import { useStore } from '../core/store.js'

export default function Hud({ recButtonRef }) {
  const app = useApp()
  const got = useStore(app.ach.store, (s) => s.got.size)
  const total = app.ach.list?.length ?? 0
  const soundOn = useStore(app.snd.store, (s) => s.on)

  return (
    <div className="hud">
      <button id="hud-rec" ref={recButtonRef} onClick={() => app.ui.store.set({ recOpen: true })}>
        Recruiter view
      </button>
      <button id="hud-resume" onClick={() => app.nav.goToResume()}>
        Résumé ↓
      </button>
      <button
        id="hud-ach"
        onClick={() => {
          app.nav.openLaptop()
          app.os.openApp('ach')
        }}
      >
        {'★ ' + got + '/' + total}
      </button>
      <button id="hud-snd" aria-pressed={soundOn} onClick={() => app.snd.setOn(!app.snd.store.get().on)}>
        {soundOn ? 'Sound: on' : 'Sound: off'}
      </button>
    </div>
  )
}
