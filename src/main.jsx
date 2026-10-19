import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { createApp } from './app/createApp.js'
import { AppProvider } from './app/AppContext.jsx'
import App from './App.jsx'
import Resume from './resume/Resume.jsx'
import './styles/tokens.css'
import './styles/resume.css'

const app = createApp()

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

// Skip link: same path as the HUD button (leaves the laptop, scrolls, focuses the résumé h1),
// so focus moves even in browsers that only scroll to a fragment.
document.querySelector('a.skip')?.addEventListener('click', (e) => {
  e.preventDefault()
  app.nav.goToResume()
})
