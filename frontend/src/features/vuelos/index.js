import { lazy } from 'react'
import { ROLES } from '@/config/roles'

// API pública para otros features: consulta de asientos (la silla ya no se elige en Compra).
export { obtenerAsientosVuelo } from './api'

// F2 — módulo Administración de vuelos (HU18: F2-05; HU19: F2-06). Sprint 2 (pantallas de F1): HU12 editar, HU13 cancelar, HU14 realizados.
// Solo el administrador entra; la raíz entra por /root/administradores.
export default {
  name: 'vuelos',
  routes: [
    { path: '/admin/vuelos', title: 'Vuelos', Component: lazy(() => import('./pages/VuelosAdminPage')), roles: [ROLES.ADMIN], nav: { label: 'Vuelos', area: 'main', order: 10 } },
    { path: '/admin/vuelos/nuevo', title: 'Programar vuelo', Component: lazy(() => import('./pages/ProgramarVueloPage')), roles: [ROLES.ADMIN] },
    { path: '/admin/vuelos/:id/cancelar', title: 'Cancelar vuelo', Component: lazy(() => import('./pages/CancelarVueloPage')), roles: [ROLES.ADMIN] },
    { path: '/admin/vuelos/:id', title: 'Consultar vuelo', Component: lazy(() => import('./pages/ConsultarVueloPage')), roles: [ROLES.ADMIN] },
    { path: '/admin/vuelos/:id/editar', title: 'Editar vuelo', Component: lazy(() => import('./pages/EditarVueloPage')), roles: [ROLES.ADMIN] },
    { path: '/admin/vuelos/realizados', title: 'Vuelos realizados', Component: lazy(() => import('./pages/VuelosRealizadosPage')), roles: [ROLES.ADMIN] },
  ],
}
