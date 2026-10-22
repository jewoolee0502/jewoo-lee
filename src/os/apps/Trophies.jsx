// Trophies (L669–670). Subscribes to the achievement store, so it updates live.
import { useApp } from '../../app/AppContext.jsx'
import { useStore } from '../../core/store.js'
import { ICON } from '../../lib/pixelIcons.js'
import { own } from '../../core/own.js'

export default function Trophies() {
  const { ach } = useApp()
  const got = useStore(ach.store, (s) => s.got)
  return (
    <>
      <p className="muted">{`${got.size} of ${ach.list.length} unlocked. Progress stays in this browser.`}</p>
      <ul className="achl">
        {ach.list.map((a) => (
          <li key={a.id} className={got.has(a.id) ? '' : 'lock'}>
            <img alt="" src={own(ICON, a.icon)} />
            <div>
              <b>{a.title}</b>
              <span>{a.desc}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
