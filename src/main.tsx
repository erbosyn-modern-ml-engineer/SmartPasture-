import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './index.css'
import './ui-improvements.css'
import App from './App'
import { SmartPastureProvider } from '@/context/SmartPastureContext'
import { LanguageProvider } from '@/i18n/LanguageContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { reportWebVitals } from '@/lib/reportWebVitals'

window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      if (import.meta.env.DEV) {
        console.warn('Service worker registration failed:', error)
      }
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ErrorBoundary>
        <LanguageProvider>
          <SmartPastureProvider>
            <App />
          </SmartPastureProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)

reportWebVitals()
