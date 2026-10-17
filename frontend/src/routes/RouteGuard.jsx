import { Navigate, useLocation } from 'react-router-dom'
import { HOME_BY_ROLE, ROLES } from '@/config/roles'
import { useAuth } from '@/context'
import { canAccessPath } from '@/features'
import ForbiddenPage from '@/pages/ForbiddenPage'

/**
 * Protege una ruta según los `roles` que declara su feature (omitir = pública).
 *  - Sin sesión en ruta privada      -> /login (recordando a dónde iba en state.from)
 *  - Con sesión en ruta de visitante -> vuelve a donde iba (si su rol puede) o a su inicio.
 *    Así, al iniciar sesión, la propia sesión nueva dispara la redirección: la página de login no navega.
 *  - Con sesión sin el rol           -> 403
 * Recordatorio: esto es UX. La seguridad real la aplica el backend (require_roles).
 */
export default function RouteGuard({ roles, children }) {
  const { rol, isAuthenticated } = useAuth()
  const location = useLocation()

  if (!roles || roles.includes(rol)) return children
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  if (roles.includes(ROLES.VISITANTE)) {
    const from = location.state?.from?.pathname
    const target = from && canAccessPath(from, rol) ? from : HOME_BY_ROLE[rol]
    return <Navigate to={target} replace />
  }
  return <ForbiddenPage />
}
