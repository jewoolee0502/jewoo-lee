// Service.txt (L824–829). Salute unlocks "Once a Marine".
import { useState } from 'react'
import { useApp } from '../../app/AppContext.jsx'

export default function Service() {
  const app = useApp()
  const [out, setOut] = useState('')

  function salute() {
    setOut('필승! (Pilseung: “certain victory”)')
    app.snd.tone(392, 0.15, 'square', 0.05)
    app.snd.tone(523, 0.3, 'square', 0.05, 0.15)
    app.ach.unlock('tags')
  }

  return (
    <>
      <h2>Sergeant, ROK Marine Corps</h2>
      <p className="muted">Sept 2022 – Mar 2024 · Communication &amp; Intelligence</p>
      <p>
        I went from Private First Class to Sergeant. In joint operations (Freedom Shield ’23, Freedom Shield ’24 and
        Ssang Yong ’23) I interpreted language and culture between the U.S. Marine Corps and the ROKMC, so both sides
        could coordinate under pressure.
      </p>
      <p>What I took away: nothing is impossible when you work together as a team.</p>
      <button type="button" className="btn" onClick={salute}>
        Salute
      </button>
      <p style={{ marginTop: 12, font: '28px var(--f-vt)' }}>{out}</p>
    </>
  )
}
