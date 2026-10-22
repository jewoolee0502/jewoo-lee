// Page composition: the stage (with the scene mount and flat fallback), JAY-OS rendered into
// the host element through a portal, and Vercel Analytics.
import { useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { AppProvider } from './app/AppContext.jsx'
import Stage from './stage/Stage.jsx'
import OsPortal from './os/OsPortal.jsx'

export default function App({ app }) {
  useEffect(() => app.start(), [app])

  return (
    <AppProvider app={app}>
      <Stage />
      <OsPortal />
      <Analytics />
    </AppProvider>
  )
}
