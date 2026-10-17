import { lazy } from 'react'
import { ROLES } from '@/config/roles'

const { VISITANTE, CLIENTE, ADMIN, ROOT } = ROLES

// F1 — módulo Usuarios (F1-03 … F1-08). Las pantallas de acceso y perfil son de pantalla completa
// (layout 'bare'), como en los mockups; los paneles del root usan la barra superior.
export default {
  name: 'usuarios',
  routes: [
    { path: '/login', layout: 'bare', title: 'Iniciar sesión',
      Component: lazy(() => import('./pages/LoginPage')),
      roles: [VISITANTE], nav: { label: 'Iniciar sesión', area: 'account', order: 10 } },
    { path: '/registro', layout: 'bare', title: 'Registro',
      Component: lazy(() => import('./pages/RegistroPage')),
      roles: [VISITANTE], nav: { label: 'Registrarse', area: 'account', order: 20 } },
    { path: '/completar-registro', layout: 'bare', title: 'Completar registro',
      Component: lazy(() => import('./pages/CompletarRegistroPage')),
      roles: [VISITANTE] },
    { path: '/perfil', layout: 'bare', title: 'Mi perfil',
      Component: lazy(() => import('./pages/PerfilPage')),
      roles: [CLIENTE, ADMIN, ROOT], nav: { label: 'Mi perfil', area: 'account', order: 10 } },
    { path: '/perfil/password', layout: 'bare', title: 'Cambiar contraseña',
      Component: lazy(() => import('./pages/CambiarPasswordPage')),
      roles: [CLIENTE, ADMIN, ROOT] },
    { path: '/root/administradores', title: 'Gestionar administradores',
      Component: lazy(() => import('./pages/AdministradoresPage')),
      roles: [ROOT], nav: { label: 'Administradores', area: 'main', order: 10 } },
    { path: '/root/roles', title: 'Gestionar roles',
      Component: lazy(() => import('./pages/RolesPage')),
      roles: [ROOT], nav: { label: 'Roles', area: 'main', order: 20 } },
  ],
}
