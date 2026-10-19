// Desktop menubar (L317–324, L717–720, L727).
import { useApp } from '../app/AppContext.jsx'
import { useStore } from '../core/store.js'
import { formatZoneTime, useClock, ZONES } from '../core/clock.js'

export default function MenuBar() {
  const app = useApp()
  const { os } = app
  const menuOpen = useStore(os.store, (s) => s.menuOpen)
  const soundOn = useStore(app.snd.store, (s) => s.on)
  const now = useClock(15000)

  return (
    <div className="menubar">
      <button
        id="mb-logo"
        className={menuOpen ? 'on' : undefined}
        aria-expanded={menuOpen}
        onClick={() => os.setMenu(!os.store.get().menuOpen)}
      >
        ◆ JAY-OS
      </button>
      <button id="mb-help" onClick={() => app.os.openApp('term', { cmd: 'help' })}>
        Help
      </button>
      <span className="sp" />
      <button id="mb-exit" title="Step back from the laptop (Esc)" onClick={() => app.ctrl?.exit?.()}>
        ⏏ Close laptop
      </button>
      <button id="mb-snd" aria-pressed={soundOn} onClick={() => app.snd.setOn(!app.snd.store.get().on)}>
        {soundOn ? 'Sound: on' : 'Sound: off'}
      </button>
      <button
        id="mb-clock"
        title="Montréal and Seoul time"
        onClick={() =>
          app.toasts.toast('Two time zones', 'Montréal, where Jay studies, and Seoul, where Jay’s from.', 'info')
        }
      >
        <span className="mb-mtl">{'MTL ' + formatZoneTime(now, ZONES.MTL)}</span>
        <span className="mb-sel">{' · SEL ' + formatZoneTime(now, ZONES.SEL)}</span>
      </button>
    </div>
  )
}
