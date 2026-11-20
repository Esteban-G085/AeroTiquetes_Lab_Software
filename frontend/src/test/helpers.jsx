import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/feedback'
import { AuthProvider, CartProvider } from '@/context'
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
      <ToastProvider><AuthProvider><CartProvider>{ui}</CartProvider></AuthProvider></ToastProvider>
    </MemoryRouter>,
  )
}

/** Perfil de ejemplo (respuesta supuesta de GET /me para un cliente). */
export const PERFIL_CLIENTE = {
  id: 7, rol: 'cliente', dni: '11111', nombres: 'María José', apellidos: 'Gómez Ríos',
  fecha_nacimiento: '1998-05-10', lugar_nacimiento: 'Pereira', direccion_facturacion: 'Cra 8 # 20-15',
  pais_facturacion: 'Colombia', departamento_facturacion: 'CO-RIS', ciudad_facturacion: 'PEI',
  genero: 'femenino', correo: 'usuario@123.com', usuario: 'maria.j', imagen_url: null, correo_pendiente: null,
}

/** Catálogo geográfico de ejemplo para los tests de registro y perfil (HU4). */
export const CATALOGO_UBICACION = {
  paises: [
    { id: 1, codigo_iso2: 'CO', nombre: 'Colombia' },
    { id: 2, codigo_iso2: 'ES', nombre: 'España' },
    { id: 3, codigo_iso2: 'PE', nombre: 'Perú' },
  ],
  departamentos: [
    { id: 11, codigo: 'CO-BDC', nombre: 'Bogotá, D.C.', id_pais: 1 },
    { id: 12, codigo: 'CO-RIS', nombre: 'Risaralda', id_pais: 1 },
    { id: 13, codigo: 'EXT-EU', nombre: 'Europa continental', id_pais: 2 },
  ],
  ciudades: [
    { codigo: 'BOG', nombre: 'Bogotá', pais: 'Colombia', id_departamento: 11 },
    { codigo: 'PEI', nombre: 'Pereira', pais: 'Colombia', id_departamento: 12 },
    { codigo: 'MAD', nombre: 'Madrid', pais: 'España', id_departamento: 13 },
  ],
}

/** Vuelo de ejemplo (forma de la API de vuelos, ver docs/CONTRATO_SPRINT2.md §1). */
export const VUELO_EJEMPLO = {
  id: 12, codigo: 'AT-204', tipo: 'nacional',
  origen: { ciudad: 'Bogotá', codigo: 'BOG' }, destino: { ciudad: 'Medellín', codigo: 'MDE' },
  salida: '2027-03-12T08:15:00-05:00', llegada: '2027-03-12T09:10:00-05:00',
  salida_zona: 'America/Bogota', llegada_zona: 'America/Bogota', duracion_min: 55,
  precio: 250000, moneda: 'COP', cupos_disponibles: 40, tiquetes_cliente: 0,
}
