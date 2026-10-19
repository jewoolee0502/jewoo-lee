// Open windows (L337).
import { useApp } from '../app/AppContext.jsx'
import { useStore } from '../core/store.js'
import Window from './Window.jsx'

export default function WindowLayer() {
  const { os } = useApp()
  const wins = useStore(os.store, (s) => s.wins)
  const focusedId = useStore(os.store, (s) => s.focusedId)
  return (
    <div className="wins" id="wins">
      {wins.map((win) => (
        <Window key={win.id} win={win} focused={win.id === focusedId} />
      ))}
    </div>
  )
}
