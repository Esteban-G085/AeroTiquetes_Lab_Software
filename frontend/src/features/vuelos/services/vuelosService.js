import api from '../../../services/api.js'
import { ENDPOINTS } from '../../../services/endpoints.js'

function limpiar(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  )
}

/**
 * HU19 - Listar vuelos (panel de administración, solo lectura).
 * @returns {Promise<{ total: number, items: Array }>}
 */
export async function listarVuelos(filtros = {}) {
  const { data } = await api.get(ENDPOINTS.vuelos, { params: limpiar(filtros) })
  return data
}

/**
 * HU18 - Programar (crear) un vuelo.
 * El backend genera el código consecutivo y calcula la llegada con zona horaria.
 */
export async function crearVuelo(payload) {
  const { data } = await api.post(ENDPOINTS.vuelos, payload)
  return data
}

/** Detalle de un vuelo para el panel admin. */
export async function obtenerVuelo(id) {
  const { data } = await api.get(ENDPOINTS.vuelo(id))
  return data
}
