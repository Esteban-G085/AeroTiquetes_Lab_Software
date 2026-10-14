import { Link } from 'react-router-dom'
import { USE_MOCKS } from '../../../config/env.js'

// ---------------------------------------------------------------------------
// PLACEHOLDER — propiedad del módulo Usuarios (F1).
// F1 debe reemplazar este componente por el formulario real de inicio de sesión
// (usuario o correo + contraseña, JWT, etc.). Se deja aquí para que las rutas
// protegidas de F2 tengan un destino válido durante el desarrollo.
// ---------------------------------------------------------------------------
export default function LoginPage() {
  return (
    <div className="d-flex justify-content-center">
      <div className="at-card p-4" style={{ maxWidth: 460, width: '100%' }}>
        <h1 className="h4 mb-2">Iniciar sesión</h1>
        <p className="texto-suave">
          Este formulario será implementado por el módulo de Usuarios (F1).
        </p>

        {USE_MOCKS && (
          <div className="alert alert-info small mb-0">
            Con mocks activos puedes cambiar de rol desde el menú superior del navbar
            (visitante, cliente, administrador, root) para probar las rutas protegidas.
          </div>
        )}

        <div className="mt-3">
          <Link className="btn btn-outline-primary" to="/buscar">Volver a buscar vuelos</Link>
        </div>
      </div>
    </div>
  )
}
