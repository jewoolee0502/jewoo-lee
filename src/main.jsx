/**
 * @copyright 2025 Jewoo Lee
 * @license <Apache-2 className="0"></Apache-2>
 */


/**
 * Node modules
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'


/**
 * Components
 */
import App from './App.jsx';


/**
 * CSS link
 */
import './index.css';


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
