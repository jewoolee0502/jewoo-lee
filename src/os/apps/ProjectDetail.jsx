// Placeholder project window (phase 2). Phase 4 replaces it with the full detail view (L869–872).
import { PROJECTS } from '../../content/index.js'

export default function ProjectDetail({ win }) {
  const p = PROJECTS[Number(String(win.id).slice(2))]
  if (!p) return null
  return (
    <>
      <h2>{p.title}</h2>
      <p>{p.blurb}</p>
    </>
  )
}
