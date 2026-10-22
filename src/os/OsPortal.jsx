// Renders JAY-OS into the host's `div.os` (D2). The portal container moves between the
// CSS3D holder and the flat host; React keeps the tree mounted across those moves.
import { createPortal } from 'react-dom'
import { useApp } from '../app/AppContext.jsx'
import { JayOS } from './JayOS.jsx'
import '../styles/os.css'
import '../styles/apps.css'

export default function OsPortal() {
  const { host } = useApp()
  return createPortal(<JayOS />, host.osEl)
}
