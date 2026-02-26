import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { storePwaPrompt } from './lib/usePwaInstall'

// Capture the prompt ASAP, before React even renders
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  storePwaPrompt(e)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
