// ◆ JAY-OS menu (L325–333, L723–725). `Résumé` replaces the prototype's design-notes item.
import { useApp } from '../app/AppContext.jsx'

const APPS = [
  ['aboutos', 'About JAY-OS'],
  ['display', 'Desktop Background…'],
  ['ach', 'Trophies'],
]

export default function MenuPop() {
  const app = useApp()
  const { os } = app

  function act(name) {
    os.setMenu(false)
    if (name === 'resume-page') app.nav?.goToResume?.()
    else if (name === 'restart') os.shutdown(() => os.boot())
    else if (name === 'shutdown') os.shutdown(() => app.ctrl?.exit?.())
    else os.openApp(name)
  }

  const item = (name, label) => (
    <button key={name} data-act={name} onClick={() => act(name)}>
      {label}
    </button>
  )

  return (
    <div className="menu-pop" id="menu-pop">
      {APPS.map(([name, label]) => item(name, label))}
      {item('resume-page', 'Résumé')}
      <hr />
      {item('restart', 'Restart')}
      {item('shutdown', 'Shut Down…')}
    </div>
  )
}
