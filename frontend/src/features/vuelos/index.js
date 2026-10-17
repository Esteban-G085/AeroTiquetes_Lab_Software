import { lazy } from 'react'
import { ROLES } from '@/config/roles'

// F2 — módulo Administración de vuelos. Stub inicial de F1; F2 lo reemplaza (F2-05, F2-06).
export default {
  name: 'vuelos',
  routes: [
    { path: '/admin/vuelos', title: 'Vuelos', Component: lazy(() => import('./pages/VuelosAdminPage')),
      roles: [ROLES.ADMIN], nav: { label: 'Vuelos', area: 'main', order: 10 } },
    { path: '/admin/vuelos/nuevo', title: 'Programar vuelo', Component: lazy(() => import('./pages/ProgramarVueloPage')),
      roles: [ROLES.ADMIN] },
    { path: '/admin/vuelos/:id', title: 'Consultar vuelo', Component: lazy(() => import('./pages/ConsultarVueloPage')),
      roles: [ROLES.ADMIN] },
  ],
}
