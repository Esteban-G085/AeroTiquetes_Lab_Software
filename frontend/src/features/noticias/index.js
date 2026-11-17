import { lazy } from 'react'
import { ALL_ROLES, ROLES } from '@/config/roles'

// F2 — módulo Noticias (HU11).
// Clientes y administradores pueden consultar noticias; la suscripción requiere sesión.
// /cancelar-suscripcion es pública (se abre desde el enlace del correo, sin sesión).
export default {
  name: 'noticias',
  routes: [
    {
      path: '/noticias',
      title: 'Noticias',
      Component: lazy(() => import('./pages/NoticiasPage')),
      roles: [ROLES.CLIENTE, ROLES.ADMIN, ROLES.ROOT],
      nav: { label: 'Noticias', area: 'main', order: 20 },
    },
    {
      path: '/noticias/crear',
      title: 'Crear noticia',
      Component: lazy(() => import('./pages/CrearNoticiaPage')),
      roles: [ROLES.ADMIN],
    },
    {
      path: '/noticias/:id',
      title: 'Detalle de noticia',
      Component: lazy(() => import('./pages/NoticiaDetallePage')),
      roles: ALL_ROLES, // pública, como GET /noticias/{id} en el backend
    },
    {
      path: '/cancelar-suscripcion',
      title: 'Cancelar suscripción',
      Component: lazy(() => import('./pages/CancelarSuscripcionPage')),
      // Sin `roles` = pública: se abre desde el enlace del correo sin sesión.
    },
  ],
}
