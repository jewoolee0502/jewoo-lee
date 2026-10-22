// Recycle Bin (L861–863): one "item", RecycleWise.
import { useApp } from '../../app/AppContext.jsx'
import { PROJECTS, projectDims, projectImage } from '../../content/index.js'

export default function Bin() {
  const app = useApp()
  const { w, h } = projectDims(PROJECTS[0])
  return (
    <>
      <p className="muted">1 item</p>
      <button className="pcard bin-item" onClick={() => app.os.openApp('p:0')}>
        <img alt="" src={projectImage(PROJECTS[0])} width={w} height={h} />
        <span>RecycleWise · open</span>
      </button>
      <p className="muted" style={{ marginTop: 12 }}>
        Nothing in here is trash. It’s RecycleWise.
      </p>
    </>
  )
}
