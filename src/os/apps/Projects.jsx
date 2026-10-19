// Projects folder (L796–798): one card per project; a click opens `p:<i>`.
import { useApp } from '../../app/AppContext.jsx'
import { PROJECTS, projectImage } from '../../content/index.js'

export default function Projects() {
  const app = useApp()
  return (
    <>
      <p className="muted">Click a project to open it.</p>
      <div className="pgrid">
        {PROJECTS.map((p, i) => (
          <button key={p.title} className="pcard" onClick={() => app.os.openApp('p:' + i)}>
            <img alt="" src={projectImage(p)} loading="lazy" width={420} height={263} />
            <span>{p.title}</span>
          </button>
        ))}
      </div>
    </>
  )
}
