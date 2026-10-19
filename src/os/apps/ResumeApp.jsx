// Resume.pdf (L811–815). No PDF embed (D13): a download link and a jump to the résumé page.
import { useApp } from '../../app/AppContext.jsx'
import { PROFILE, ROLES } from '../../content/index.js'

export default function ResumeApp() {
  const app = useApp()
  return (
    <>
      <h2>{PROFILE.name}</h2>
      <p className="muted">Full-stack developer · B.Eng. Computer Engineering, McGill University</p>
      <div className="tags">
        {PROFILE.resumeTags.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <ul>
        {ROLES.slice(0, 5).map((r) => (
          <li key={r.dates + r.company}>{`${r.company}: ${r.role} (${r.dates})`}</li>
        ))}
      </ul>
      <p className="links" style={{ marginTop: 12 }}>
        <a className="btn" href={PROFILE.cv} download>
          Download CV (PDF) ↓
        </a>
        <button type="button" className="btn" onClick={() => app.nav.goToResume()}>
          Read the full résumé
        </button>
      </p>
    </>
  )
}
