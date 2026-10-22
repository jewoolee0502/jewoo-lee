// Projects folder (L796–798): one card per project; a click opens `p:<i>`.
import { useApp } from '../../app/AppContext.jsx'
import { useStore } from '../../core/store.js'
import { PROJECTS, projectDims, projectImage, projectSrcSet, sizesFor } from '../../content/index.js'

export default function Projects() {
  const app = useApp()
  const scale = useStore(app.os.store, (s) => s.scale)
  const compact = useStore(app.os.store, (s) => s.compact)
  const sizes = sizesFor('thumb', { compact, scale })
  return (
    <>
      <p className="muted">Click a project to open it.</p>
      <div className="pgrid">
        {PROJECTS.map((p, i) => (
          <button key={p.title} className="pcard" onClick={() => app.os.openApp('p:' + i)}>
            <img
              alt=""
              src={projectImage(p)}
              srcSet={projectSrcSet(p, 1280)}
              sizes={sizes}
              loading="lazy"
              width={projectDims(p).w}
              height={projectDims(p).h}
            />
            <span>{p.title}</span>
          </button>
        ))}
      </div>
    </>
  )
}
