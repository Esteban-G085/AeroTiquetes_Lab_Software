import api from '../../../services/api.js'
import { ENDPOINTS } from '../../../services/endpoints.js'

// Quita claves vacías/null/undefined para no enviar filtros en blanco.
function limpiar(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  )
}

/**
 * HU05 - Buscar vuelos combinando criterios.
 * @returns {Promise<{ total: number, items: Array }>}
 */
export async function buscarVuelos(filtros = {}) {
  const { data } = await api.get(ENDPOINTS.busqueda, { params: limpiar(filtros) })
  return data
}

/** HU05 - Detalle de un vuelo. */
export async function obtenerVuelo(id) {
  const { data } = await api.get(ENDPOINTS.vuelo(id))
  return data
}
