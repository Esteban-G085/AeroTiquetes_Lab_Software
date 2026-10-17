import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource/roboto-mono/500.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import '@/styles/index.css' // siempre después de Bootstrap
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
