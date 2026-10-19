// A drawing saved to the desktop from Paint (L873).
import { useApp } from '../../app/AppContext.jsx'
import { useStore } from '../../core/store.js'

export default function Art({ win }) {
  const app = useApp()
  const n = Number(String(win.id).slice(4))
  const src = useStore(app.os.store, (s) => s.art[n])
  if (!src) return null
  return (
    <>
      <img
        alt="Visitor drawing"
        src={src}
        style={{ width: '100%', imageRendering: 'pixelated', border: '2px solid #122030' }}
      />
      <p className="muted">Drawn by you. Jay would love to see it.</p>
    </>
  )
}
