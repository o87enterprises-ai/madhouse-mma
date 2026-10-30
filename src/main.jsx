import '@fontsource/anton/400.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import './styles/tokens.css'
import './styles/main.css'
import './index.css'

import { StrictMode } from 'react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import App from './App.jsx'

const root = document.getElementById('root')

if (root.innerHTML.trim()) {
  hydrateRoot(root, <StrictMode><App /></StrictMode>)
} else {
  createRoot(root).render(<StrictMode><App /></StrictMode>)
}
