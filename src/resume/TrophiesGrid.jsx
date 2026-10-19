// Compact trophies grid for the résumé (cards from L665–666). The server snapshot is always
// empty, so the prerendered HTML shows every trophy locked and hydration matches; the client
// then re-renders with the stored set.
import { useApp } from '../app/AppContext.jsx'
import { useStore } from '../core/store.js'
import { ICON } from '../lib/pixelIcons.js'

const NONE = new Set()
const serverSnapshot = () => NONE

/** The unlocked achievement ids, empty during SSR and hydration. */
// eslint-disable-next-line react-refresh/only-export-components
export function useGotTrophies() {
  const { ach } = useApp()
  return useStore(ach.store, (s) => s.got, serverSnapshot)
}

export default function TrophiesGrid() {
  const { ach } = useApp()
  const got = useGotTrophies()

  return (
    <ul className="ach-grid" role="list">
      {ach.list.map((a) => {
        const on = got.has(a.id)
        return (
          <li key={a.id} className={'ach ' + (on ? 'got' : 'lock')}>
            <img src={ICON[a.icon]} alt="" width={34} height={34} />
            <div>
              <b>
                {on ? '★ ' : '☆ '}
                <span className="ach-t">{a.title}</span>
              </b>
              <span>{a.desc}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
