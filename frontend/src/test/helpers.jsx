import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/feedback'
import { AuthProvider } from '@/context'
import { tokenStorage } from '@/services/tokenStorage'

/** Fabrica un JWT de prueba (sin firma real; el front solo lee el payload). */
export function makeJwt({ rol = 'cliente', sub = '1', expInSeconds = 1800 } = {}) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const exp = Math.floor(Date.now() / 1000) + expInSeconds
  return `${b64({ alg: 'HS256' })}.${b64({ sub, rol, exp })}.firma`
}

/** Deja una sesión iniciada en sessionStorage antes de montar la app. */
export function seedSession(opts = {}, user = { nombres: 'Ana' }) {
  tokenStorage.set(makeJwt(opts), user)
}

/** route: string ('/login') o { pathname, state } para simular, p. ej., el `from` de una redirección. */
export function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider><AuthProvider>{ui}</AuthProvider></ToastProvider>
    </MemoryRouter>,
  )
}

/** Perfil de ejemplo (respuesta supuesta de GET /me para un cliente). */
export const PERFIL_CLIENTE = {
  id: 7, rol: 'cliente', dni: '11111', nombres: 'María José', apellidos: 'Gómez Ríos',
  fecha_nacimiento: '1998-05-10', lugar_nacimiento: 'Pereira', direccion_facturacion: 'Cra 8 # 20-15',
  genero: 'femenino', correo: 'usuario@123.com', usuario: 'maria.j', imagen_url: null, correo_pendiente: null,
}
