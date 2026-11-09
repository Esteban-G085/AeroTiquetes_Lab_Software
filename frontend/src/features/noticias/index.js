import { lazy } from 'react'
import { ROLES } from '@/config/roles'

// F2 — módulo Noticias (HU11).
// Clientes y administradores pueden consultar noticias; la suscripción requiere sesión.
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
  ],
}
