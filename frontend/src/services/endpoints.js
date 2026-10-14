// Rutas de la API (contrato F2 ↔ B2). Un único lugar para ajustarlas.
import { API_URL } from '../config/env'

export const ENDPOINTS = {
  ciudades: '/ciudades',

  // HU05 — búsqueda y detalle (visitante / cliente)
  busqueda: '/vuelos/busqueda',
  vuelo: (id) => `/vuelos/${id}`,

  // HU18 / HU19 — administración de vuelos (administrador)
  vuelos: '/vuelos',
}

export { API_URL }
