import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const appVersion = import.meta.env.VITE_APP_VERSION || 'Development'
  void navigator.serviceWorker.register(`/sw.js?version=${encodeURIComponent(appVersion)}`).catch(() => undefined)
}

const root = document.getElementById('root')

if (!root) throw new Error('Root element #root was not found.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
