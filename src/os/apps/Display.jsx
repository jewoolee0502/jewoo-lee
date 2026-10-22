// Desktop Background (L831–838). Picks Auto (follows Montréal time) or a fixed mode. The choice
// lives in the in-memory wallpaper store only (D14: Auto again on every load). Card images are
// cached snapshots, drawn once per mode (B14).
import { useApp } from '../../app/AppContext.jsx'
import { useStore } from '../../core/store.js'
import { MODES, MODE_KEYS, autoWp } from '../../wallpaper/modes.js'
import { snapshot } from '../../wallpaper/snapshot.js'

const IMG_STYLE = { imageRendering: 'pixelated', aspectRatio: '4/3' }
const CARDS = [['auto', 'Auto · follows Montréal time'], ...MODE_KEYS.map((k) => [k, MODES[k].name])]

export default function Display() {
  const { wallpaper } = useApp()
  const choice = useStore(wallpaper.store, (s) => s.choice)
  // Re-render on mode changes too, so the Auto card follows the 60 s refresh.
  useStore(wallpaper.store, (s) => s.mode)

  return (
    <>
      <p className="muted">
        The desktop is a living pixel-art Montréal. Pick the time of day, or let it follow the real clock in Montréal.
        Then click around the city: it hides a few secrets.
      </p>
      <div className="pgrid">
        {CARDS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={k === choice ? 'pcard on' : 'pcard'}
            onClick={() => wallpaper.setChoice(k)}
          >
            <img alt="" src={snapshot(k === 'auto' ? autoWp() : k)} style={IMG_STYLE} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </>
  )
}
