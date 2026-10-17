import { lazy } from 'react'
import { ROLES } from '@/config/roles'

// F2 — módulo Búsqueda. Stub inicial de F1; F2 lo reemplaza (F2-02 … F2-04).
export default {
  name: 'busqueda',
  routes: [
    { path: '/', title: 'Vuelos', Component: lazy(() => import('./pages/BuscadorPage')),
      roles: [ROLES.VISITANTE, ROLES.CLIENTE], nav: { label: 'Buscar vuelos', area: 'main', order: 0 } },
    { path: '/vuelos/:id', title: 'Detalle del vuelo', Component: lazy(() => import('./pages/DetalleVueloPage')),
      roles: [ROLES.VISITANTE, ROLES.CLIENTE] },
  ],
}
