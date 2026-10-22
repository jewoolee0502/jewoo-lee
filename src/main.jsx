import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { createApp } from './app/createApp.js'
import { AppProvider } from './app/AppContext.jsx'
import App from './App.jsx'
import Resume from './resume/Resume.jsx'
import './styles/tokens.css'
import './styles/resume.css'
import './styles/views.css'

const app = createApp()
// plan-r3 V1, V10: the view comes from the URL before the stage mounts, so a résumé link parks the
// laptop first (the stage then mounts hidden and measures nothing until it is shown).
app.views.init()

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <App app={app} />
  </StrictMode>,
)

// The résumé is a second root sharing the same app (D12). The production build prerenders it
// into index.html, so it hydrates there; the dev server has only the outlet comment.
const resumeRoot = document.getElementById('resume-root')
const resume = (
  <StrictMode>
    <AppProvider app={app}>
      <Resume />
    </AppProvider>
  </StrictMode>
)
if (resumeRoot.querySelector('main')) hydrateRoot(resumeRoot, resume)
else createRoot(resumeRoot).render(resume)

// Skip link: same path as the HUD button (switches to the résumé view and focuses its h1), so the
// switch pushes the same history entry and focus moves even where a fragment link only scrolls.
document.querySelector('a.skip')?.addEventListener('click', (e) => {
  e.preventDefault()
  app.nav.goToResume()
})
