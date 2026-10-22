// Toast stack (L653–654): each toast fades over .4 s from 3200 ms and is removed at 3600 ms.
import { useApp } from '../app/AppContext.jsx'
import { useStore } from '../core/store.js'

const FADING = { transition: 'opacity .4s', opacity: 0 }

export default function Toasts() {
  const app = useApp()
  const list = useStore(app.toasts.store, (s) => s.list)
  return (
    <div className="toasts" id="toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={'toast' + (t.kind ? ' ' + t.kind : '')} style={t.fading ? FADING : undefined}>
          <b>{t.title}</b>
          {t.body}
        </div>
      ))}
    </div>
  )
}
