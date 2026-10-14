import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { USE_MOCKS } from '../../config/env.js'

function enlace(activo) {
  return `nav-link${activo ? ' active' : ''}`
}

export default function Navbar() {
  const { usuario, autenticado, rol, cerrarSesion, iniciarSesion } = useAuth()
  const navigate = useNavigate()
  const esAdmin = rol === 'administrador' || rol === 'root'

  function salir() {
    cerrarSesion()
    navigate('/buscar')
  }

  // Cambio de rol rápido solo cuando MSW está activo (para probar rutas admin sin backend).
  function cambiarRolDev(nuevoRol) {
    iniciarSesion({
      usuario: { id: 'dev', nombre: `Dev ${nuevoRol}`, rol: nuevoRol },
      token: 'token-de-desarrollo',
    })
  }

  return (
    <nav className="navbar navbar-expand-lg at-navbar" data-bs-theme="dark">
      <div className="container at-contenedor">
        <Link className="navbar-brand" to="/buscar">AeroTiquetes</Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navPrincipal"
          aria-controls="navPrincipal"
          aria-expanded="false"
          aria-label="Alternar navegación"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="navPrincipal">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <NavLink className={({ isActive }) => enlace(isActive)} to="/buscar">Buscar vuelos</NavLink>
            </li>
            {esAdmin && (
              <>
                <li className="nav-item">
                  <NavLink className={({ isActive }) => enlace(isActive)} to="/admin/vuelos" end>
                    Panel de vuelos
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={({ isActive }) => enlace(isActive)} to="/admin/vuelos/nuevo">
                    Programar vuelo
                  </NavLink>
                </li>
              </>
            )}
          </ul>

          <div className="d-flex align-items-center gap-2">
            {autenticado ? (
              <>
                <span className="text-white-50 small d-none d-lg-inline">{usuario?.nombre}</span>
                <span className="badge text-bg-light text-uppercase">{rol}</span>
                <button className="btn btn-sm btn-outline-light" onClick={salir}>Salir</button>
              </>
            ) : (
              <Link className="btn btn-sm btn-primary" to="/login">Iniciar sesión</Link>
            )}

            {USE_MOCKS && (
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={autenticado ? rol : 'visitante'}
                onChange={(e) => (e.target.value === 'visitante' ? salir() : cambiarRolDev(e.target.value))}
                title="Cambiar rol (solo desarrollo con mocks)"
              >
                <option value="visitante">visitante</option>
                <option value="cliente">cliente</option>
                <option value="administrador">administrador</option>
                <option value="root">root</option>
              </select>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
