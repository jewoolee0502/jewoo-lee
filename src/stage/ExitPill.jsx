// "Go to résumé ↓" (plan-r2 phase 2): the way out of the laptop while it is open. Shown only
// while the stage is zoomed, by CSS (`.stage.zoomed .exit-pill`), so it costs no React state.
import { useApp } from '../app/AppContext.jsx'

export default function ExitPill() {
  const app = useApp()
  return (
    <button
      id="hud-exit"
      className="exit-pill"
      type="button"
      title="Leave the laptop and read the résumé (Esc closes it)"
      onClick={() => app.nav.goToResume()}
    >
      Go to résumé ↓
    </button>
  )
}
