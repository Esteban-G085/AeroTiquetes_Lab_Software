// Valores idénticos al claim `rol` del JWT (backend, sección 5.3 del plan).
export const ROLES = Object.freeze({
  VISITANTE: 'visitante', // sin sesión
  CLIENTE: 'cliente',
  ADMIN: 'administrador',
  ROOT: 'root',
})
export const ALL_ROLES = Object.values(ROLES)

// Pantalla de inicio de cada rol (a dónde va tras iniciar sesión).
export const HOME_BY_ROLE = Object.freeze({
  [ROLES.VISITANTE]: '/',
  [ROLES.CLIENTE]: '/',
  [ROLES.ADMIN]: '/admin/vuelos',
  [ROLES.ROOT]: '/root/administradores',
})
