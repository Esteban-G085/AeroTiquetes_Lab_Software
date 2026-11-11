import { lazy } from 'react'
import { ROLES } from '@/config/roles'

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
      path: '/cancelar-suscripcion',
      title: 'Cancelar suscripción',
      Component: lazy(() => import('./pages/CancelarSuscripcionPage')),
      roles: [], // pública: se abre desde el enlace del correo sin sesión
    },
  ],
}
