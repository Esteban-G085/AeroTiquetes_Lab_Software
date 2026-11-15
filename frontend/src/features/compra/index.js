import { lazy } from 'react'
import { ROLES } from '@/config/roles'

// F1 — módulo Compra y reserva (Sprint 2: F1-11 … F1-14). Solo cliente: root y administrador no compran (SRS Usuarios RF11).
// El carrito vive en context/CartContext (lo usan la cabecera y estas pantallas).
export default {
  name: 'compra',
  routes: [
    { path: '/comprar/:vueloId', title: 'Reservar o comprar', Component: lazy(() => import('./pages/ReservaCompraPage')), roles: [ROLES.CLIENTE] },
    { path: '/carrito', title: 'Mi carrito', Component: lazy(() => import('./pages/CarritoPage')), roles: [ROLES.CLIENTE] },
    { path: '/mis-viajes', title: 'Mis viajes', Component: lazy(() => import('./pages/HistorialPage')),
      roles: [ROLES.CLIENTE], nav: { label: 'Mis viajes', area: 'main', order: 10 } },
  ],
}
