/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

/**
 * Node modules
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'

/**
 * Components
 */
import App from './App'

/**
 * CSS link
 */
import './index.css'
import 'lenis/dist/lenis.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
