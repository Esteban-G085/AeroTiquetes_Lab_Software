import { lazy } from 'react'
import { ROLES } from '@/config/roles'

// F2 — módulo Búsqueda (HU5: F2-02 … F2-04).
// La búsqueda es la página de inicio para visitantes y clientes; el detalle es público
// (el visitante puede mirar, pero reservar/comprar es de la Iteración 2).
export default {
  name: 'busqueda',
  routes: [
    { path: '/', title: 'Vuelos', Component: lazy(() => import('./pages/BuscadorPage')),
      roles: [ROLES.VISITANTE, ROLES.CLIENTE], nav: { label: 'Buscar vuelos', area: 'main', order: 0 } },
    { path: '/vuelos/:id', title: 'Detalle del vuelo', Component: lazy(() => import('./pages/DetalleVueloPage')),
      roles: [ROLES.VISITANTE, ROLES.CLIENTE] },
  ],
}
