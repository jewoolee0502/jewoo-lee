// The page shell (L273–308): scroll track, sticky stage, HUD, cue, toasts, recruiter view,
// the scene mount and the flat-host fallback. React renders the flat host, the park and the
// scene layer empty; the host and the scene own what goes inside them (D2).
import { useRef } from 'react'
import { useApp } from '../app/AppContext.jsx'
import { useStore } from '../core/store.js'
import Hud from './Hud.jsx'
import Cue from './Cue.jsx'
import Toasts from './Toasts.jsx'
import RecruiterView from './RecruiterView.jsx'
import NoWebGLNotice from './NoWebGLNotice.jsx'
import SceneMount from './SceneMount.jsx'
import { useStageBindings } from './useStageBindings.js'
import '../styles/stage.css'

const FLAT_FALLBACK = { zIndex: 5 }

export default function Stage() {
  const app = useApp()
  const status = useStore(app.scene.store, (s) => s.status)
  const unavailable = status === 'unavailable'

  const trackRef = useRef(null)
  const stageRef = useRef(null)
  const sceneLayerRef = useRef(null)
  const flatHostRef = useRef(null)
  const cueRef = useRef(null)
  const tipRef = useRef(null)
  const parkRef = useRef(null)
  const recButtonRef = useRef(null)

  useStageBindings(app, { trackRef, stageRef, cueRef, flatHostRef, parkRef })

  return (
    <>
      <section className="track" id="track" ref={trackRef}>
        <div className="stage" id="stage" ref={stageRef}>
          <div className="scene-layer" ref={sceneLayerRef} />
          <div className="flat-host" id="flat-host" ref={flatHostRef} style={unavailable ? FLAT_FALLBACK : undefined} />
          <Hud recButtonRef={recButtonRef} />
          <Cue ref={cueRef} />
          <Toasts />
          <div className="tip3d" id="tip3d" hidden ref={tipRef} />
          <RecruiterView returnFocusRef={recButtonRef} />
          {unavailable && <NoWebGLNotice />}
        </div>
      </section>
      <div className="park" ref={parkRef} />
      <SceneMount sceneLayerRef={sceneLayerRef} stageRef={stageRef} tipRef={tipRef} parkRef={parkRef} />
    </>
  )
}
