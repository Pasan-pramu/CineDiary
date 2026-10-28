import './styles/index.css'
import '@fontsource/dm-serif-display'
import '@fontsource-variable/manrope'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import Toasts from './components/Toasts'
import { logError, reportUnexpected } from './errors'
import { APP_NAME } from '../../shared/app'

// The window title (index.html has none, so the name lives only in package.json).
document.title = APP_NAME

// Last resort: a promise nobody caught gets a toast; any other script error is logged.
window.addEventListener('unhandledrejection', (event) => reportUnexpected(event.reason))
window.addEventListener('error', (event) => logError('renderer', event.error ?? event.message))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <Toasts />
  </StrictMode>
)
