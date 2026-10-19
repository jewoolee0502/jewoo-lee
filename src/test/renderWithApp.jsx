// renderWithApp(ui, overrides): builds createApp(overrides) and renders `ui`
// inside <AppProvider app={app}>. Returns RTL's render result plus `app`.
//
// The modules are found with import.meta.glob so this helper still loads
// before phase 1 creates src/app/createApp.js and src/app/AppContext.jsx.
// Until then `appModulesReady` is false and calling the helper throws.
import { render } from '@testing-library/react'

const createAppModule = Object.values(
  import.meta.glob('../app/createApp.js', { eager: true }),
)[0]
const contextModule = Object.values(
  import.meta.glob('../app/AppContext.jsx', { eager: true }),
)[0]

export const appModulesReady = Boolean(
  createAppModule?.createApp && contextModule?.AppProvider,
)

export function renderWithApp(ui, overrides = {}) {
  if (!appModulesReady) {
    throw new Error(
      'renderWithApp: src/app/createApp.js and src/app/AppContext.jsx do not exist yet (phase 1)',
    )
  }
  const { createApp } = createAppModule
  const { AppProvider } = contextModule
  const app = createApp(overrides)
  const result = render(<AppProvider app={app}>{ui}</AppProvider>)
  return { ...result, app }
}
