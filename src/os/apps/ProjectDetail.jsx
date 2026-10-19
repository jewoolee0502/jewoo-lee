// One project window, `p:<n>` (L869–872).
import { PROJECTS, projectImage } from '../../content/index.js'

export default function ProjectDetail({ win }) {
  const p = PROJECTS[Number(String(win.id).slice(2))]
  if (!p) return null
  const links = [
    [p.live, 'Live demo ↗'],
    [p.url, 'Open on ' + p.host + ' ↗'],
    [p.repo, 'Source on GitHub ↗'],
  ].filter(([href]) => href)
  return (
    <>
      <img className="shot" src={projectImage(p)} alt={p.title + ' screenshot'} />
      <h2>
        {p.title}
        {p.draft ? <span className="draft">draft blurb</span> : null}
      </h2>
      <p>{p.blurb}</p>
      <div className="tags">
        {p.tags.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="links">
        {links.map(([href, label]) => (
          <a key={label} className="btn" href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        ))}
      </div>
    </>
  )
}
