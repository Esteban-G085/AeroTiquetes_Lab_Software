import { lazy } from 'react'
import { ROLES } from '@/config/roles'

// F1 — módulo Gestión financiera: billetera virtual y tarjetas simuladas (Sprint 2: F1-15, HU10). Exclusivo del cliente (SRS Usuarios RF05).
export default {
  name: 'financiero',
  routes: [
    { path: '/billetera', title: 'Mi billetera', Component: lazy(() => import('./pages/BilleteraPage')),
      roles: [ROLES.CLIENTE], nav: { label: 'Billetera', area: 'account', order: 15 } },
  ],
}
