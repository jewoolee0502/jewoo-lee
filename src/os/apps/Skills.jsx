// Skills.inv (L803–809): an inventory of slots; picking one shows where it was used.
import { useState } from 'react'
import { useApp } from '../../app/AppContext.jsx'
import { CAT, SKILLS } from '../../content/index.js'
import { own } from '../../core/own.js'

const FALLBACK = 'Listed on the current site. A project that shows it off would help!'

export default function Skills() {
  const app = useApp()
  const [sel, setSel] = useState(-1)
  const s = SKILLS[sel]
  const cat = s ? own(CAT, s.cat) : null

  function pick(i) {
    setSel(i)
    app.snd.tone(740, 0.06, 'square', 0.03)
  }

  return (
    <div className="inv">
      <div className="slots">
        {SKILLS.map((k, i) => (
          <button
            key={k.name}
            className={i === sel ? 'slot on' : 'slot'}
            style={{ '--sc': own(CAT, k.cat)?.color }}
            onClick={() => pick(i)}
          >
            <b>{k.name.slice(0, 2).toUpperCase()}</b>
            <span>{k.name}</span>
          </button>
        ))}
      </div>
      <div className="inv-d">
        {s ? (
          <>
            <h3>{s.name}</h3>
            <div className="rar" style={{ color: cat?.color }}>
              {(cat?.label ?? '').toUpperCase() + ' · ' + s.label}
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              Used in:
            </p>
            <ul>
              {(s.usedIn.length ? s.usedIn : [FALLBACK]).map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h3>Pick an item</h3>
            <p className="muted">
              {`${SKILLS.length} skills, colour-coded by type. Each one lists where Jay has actually used it.`}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
