// One project window, `p:<n>` (L869–872).
import { useApp } from '../../app/AppContext.jsx'
import { useStore } from '../../core/store.js'
import { PROJECTS, projectDims, projectFull, projectImage, projectSrcSet, sizesFor } from '../../content/index.js'

export default function ProjectDetail({ win }) {
  const { os } = useApp()
  // `sizes` ignores CSS transforms, so it carries the flat OS scale (R15).
  const scale = useStore(os.store, (s) => s.scale)
  const compact = useStore(os.store, (s) => s.compact)
  const p = PROJECTS[Number(String(win.id).slice(2))]
  if (!p) return null
  const { w, h } = projectDims(p)
  const links = [
    [p.live, 'Live demo ↗'],
    [p.url, 'Open on ' + p.host + ' ↗'],
    [p.repo, 'Source on GitHub ↗'],
  ].filter(([href]) => href)
  return (
    <>
      <a
        className="shot-link"
        href={projectFull(p)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={'Open the ' + p.title + ' screenshot full size (opens in a new tab)'}
      >
        <img
          className="shot"
          src={projectImage(p)}
          srcSet={projectSrcSet(p)}
          sizes={sizesFor('shot', { compact, scale })}
          width={w}
          height={h}
          alt={p.title + ' screenshot'}
          decoding="async"
        />
      </a>
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
