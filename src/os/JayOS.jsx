// The whole JAY-OS UI. OsPortal renders it into the host's `div.os`; the host, not
// JSX, owns that element's classes and data-state (D2), synced here from the stores.
import { useEffect } from 'react'
import { useApp } from '../app/AppContext.jsx'
import { bindHostClasses } from './hostClasses.js'
import StandbyLayer from './StandbyLayer.jsx'
import BootLayer from './BootLayer.jsx'
import Desktop from './Desktop.jsx'
import OffLayer from './OffLayer.jsx'

export function JayOS() {
  const app = useApp()
  const { os, host } = app
  const sceneStore = app.scene?.store

  useEffect(() => bindHostClasses({ os, host, sceneStore }), [os, host, sceneStore])

  // L726
  function onGlass() {
    app.nav?.openLaptop?.()
    if (os.state === 'standby' || os.state === 'off') os.boot()
  }

  return (
    <>
      <StandbyLayer />
      <BootLayer />
      <Desktop />
      <OffLayer />
      <button className="glass" id="glass" aria-label="Zoom into the screen" onClick={onGlass} />
    </>
  )
}

export default JayOS
