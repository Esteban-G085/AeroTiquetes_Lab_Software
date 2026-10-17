// Registro de módulos. Agregar un feature nuevo = una línea aquí.
import { matchPath } from 'react-router-dom'
import usuarios from './usuarios'
import vuelos from './vuelos'
import busqueda from './busqueda'

export const features = [usuarios, vuelos, busqueda]

/** Todas las rutas declaradas por los features. */
export const allRoutes = features.flatMap((f) => f.routes)

/** Entradas de menú visibles para un rol, ordenadas. area: 'main' | 'account' */
export function getNavItems(role, area) {
  return allRoutes
    .filter((r) => r.nav && (!area || r.nav.area === area))
    .filter((r) => !r.roles || r.roles.includes(role))
    .sort((a, b) => (a.nav.order ?? 100) - (b.nav.order ?? 100))
    .map((r) => ({ to: r.path, label: r.nav.label }))
}

/** Ruta declarada que corresponde a una URL (soporta parámetros como /vuelos/:id). */
export function getRouteMeta(pathname) {
  return allRoutes.find((r) => matchPath({ path: r.path, end: true }, pathname))
}

/** ¿Puede este rol abrir esta URL? Se usa para volver a donde iba el usuario tras iniciar sesión. */
export function canAccessPath(pathname, role) {
  const route = getRouteMeta(pathname)
  return Boolean(route) && (!route.roles || route.roles.includes(role))
}
