// Experience.log (L799–802): newest role first, the first entry open.
import { ROLES } from '../../content/index.js'

export default function Experience() {
  return (
    <>
      <p className="muted" style={{ font: '14px var(--f-mono)' }}>
        {`$ tail -n ${ROLES.length} ~/experience.log`}
      </p>
      <div className="log">
        {ROLES.map((r, i) => (
          <details key={r.dates + r.company} open={i === 0}>
            <summary>
              <span className="when">{r.dates}</span>
              <span>
                <b>{r.company}</b>
                <em>{r.role}</em>
              </span>
            </summary>
            <p>{r.summary}</p>
          </details>
        ))}
      </div>
    </>
  )
}
