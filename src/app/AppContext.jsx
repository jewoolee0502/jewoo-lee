// React access to the composition root.
import { createContext, useContext } from 'react'

const AppContext = createContext(null)

export function AppProvider({ app, children }) {
  return <AppContext.Provider value={app}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const app = useContext(AppContext)
  if (!app) throw new Error('useApp() must be used inside <AppProvider>')
  return app
}
