import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'

/**
 * Protege una ruta: exige sesión y, opcionalmente, uno de los roles indicados.
 */
export default function ProtectedRoute({ roles, children }) {
  const { autenticado, rol } = useAuth()
  const location = useLocation()

  if (!autenticado) {
    return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  }

  if (roles && roles.length > 0 && !roles.includes(rol)) {
    return (
      <EmptyState
        icono="🔒"
        titulo="Acceso restringido"
        mensaje="Esta sección es solo para usuarios con rol administrador."
      />
    )
  }

  return children
}
