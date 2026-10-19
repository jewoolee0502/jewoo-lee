// The desktop layer (L316–338): wallpaper canvas, menubar, menu, icons, wallmark, windows and fx.
import { useState } from 'react'
import { useApp } from '../app/AppContext.jsx'
import { useStore } from '../core/store.js'
import { own } from '../core/own.js'
import { MODES } from '../wallpaper/modes.js'
import WallpaperCanvas from '../wallpaper/WallpaperCanvas.jsx'
import { DesktopContext } from './DesktopContext.js'
import MenuBar from './MenuBar.jsx'
import MenuPop from './MenuPop.jsx'
import DesktopIcons from './DesktopIcons.jsx'
import WindowLayer from './WindowLayer.jsx'
import Fx from './Fx.jsx'

function Wallmark() {
  const { wallpaper } = useApp()
  const mode = useStore(wallpaper.store, (s) => s.mode)
  const cap = own(MODES, mode)?.cap ?? 'montréal edition'
  return (
    <div className="wallmark">
      <span id="wp-cap">{cap}</span>
      <br />
      psst · the city is clickable
    </div>
  )
}

export default function Desktop() {
  const { os } = useApp()
  const [deskEl, setDeskEl] = useState(null)
  const menuOpen = useStore(os.store, (s) => s.menuOpen)

  // L722: a pointerdown anywhere outside the menu and its logo button closes the menu.
  function onPointerDown(e) {
    if (!os.store.get().menuOpen) return
    if (e.target.closest?.('#menu-pop, #mb-logo')) return
    os.setMenu(false)
  }

  return (
    <DesktopContext.Provider value={deskEl}>
      <div className="layer l-desk" id="l-desk" ref={setDeskEl} onPointerDown={onPointerDown}>
        <WallpaperCanvas />
        <MenuBar />
        {menuOpen ? <MenuPop /> : null}
        <DesktopIcons />
        <Wallmark />
        <WindowLayer />
        <Fx />
      </div>
    </DesktopContext.Provider>
  )
}
