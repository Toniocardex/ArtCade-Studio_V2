import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './utils/monaco-setup'   // point Monaco at the local bundle (offline)
import App from './App'
import { initTheme } from './utils/theme'

initTheme()   // set data-theme before first paint (no flash)

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
