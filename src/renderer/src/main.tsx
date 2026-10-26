import './styles/index.css'
import '@fontsource/dm-serif-display'
import '@fontsource-variable/manrope'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
