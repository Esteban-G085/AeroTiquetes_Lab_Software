import { lazy } from 'react'
import { ROLES } from '@/config/roles'

// F2 — módulo Noticias (Sprint 2: F2-14). Las ve el cliente y el administrador; solo el cliente se suscribe y compra desde ellas.
export default {
  name: 'noticias',
  routes: [
    { path: '/noticias', title: 'Noticias', Component: lazy(() => import('./pages/NoticiasPage')),
      roles: [ROLES.CLIENTE, ROLES.ADMIN], nav: { label: 'Noticias', area: 'main', order: 20 } },
  ],
}
