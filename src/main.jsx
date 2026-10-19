import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createApp } from './app/createApp.js'
import App from './App.jsx'
import './styles/tokens.css'

const app = createApp()

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <App app={app} />
  </StrictMode>,
)
