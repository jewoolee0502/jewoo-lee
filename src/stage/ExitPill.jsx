// "Read the résumé" (plan-r2 phase 2, plan-r3 V14): the way from the open laptop to the résumé
// view. Shown only while the stage is zoomed, by CSS (`.stage.zoomed .exit-pill`), so it costs no
// React state.
import { useApp } from '../app/AppContext.jsx'

export default function ExitPill() {
  const app = useApp()
  return (
    <button
      id="hud-exit"
      className="exit-pill"
      type="button"
      title="Switch to the résumé (Esc closes the laptop)"
      onClick={() => app.nav.goToResume()}
    >
      Read the résumé
    </button>
  )
}
