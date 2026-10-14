import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './index.css'
import { USE_MOCKS } from './config/env.js'
import App from './App.jsx'

async function arrancar() {
  // Solo cargamos MSW cuando los mocks están activos (no entra al build de producción).
  if (USE_MOCKS) {
    const { worker } = await import('./mocks/browser.js')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

arrancar()
