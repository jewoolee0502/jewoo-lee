// About.txt (L788–795). The portrait is the precomputed dithered PNG (plan section 2).
import { PROFILE } from '../../content/index.js'
import { formatZoneTime, useClock, ZONES } from '../../core/clock.js'

export default function About() {
  const now = useClock()
  return (
    <div className="about">
      <figure className="pol">
        <img className="jay-px" src="/img/jay-px.png" alt="Pixel-art portrait of Jewoo Lee" />
        <figcaption>hi, it’s me</figcaption>
      </figure>
      <div>
        <h2>{PROFILE.greeting}</h2>
        <p>{PROFILE.about}</p>
        <dl className="facts">
          {PROFILE.facts.map((f) => (
            <FactRow key={f.label} fact={f} />
          ))}
        </dl>
        <div className="clocks">
          <div className="clock">
            <small>MONTRÉAL</small>
            <span className="clk-mtl">{formatZoneTime(now, ZONES.MTL)}</span>
          </div>
          <div className="clock">
            <small>SEOUL</small>
            <span className="clk-sel">{formatZoneTime(now, ZONES.SEL)}</span>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          Psst: open the Terminal and type <b>neofetch</b>.
        </p>
      </div>
    </div>
  )
}

function FactRow({ fact }) {
  return (
    <>
      <dt>{fact.label}</dt>
      <dd>
        {fact.dot ? <span className="dot" /> : null}
        {fact.value}
      </dd>
    </>
  )
}
