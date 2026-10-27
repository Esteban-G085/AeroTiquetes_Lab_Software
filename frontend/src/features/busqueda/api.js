import { http } from '@/services/http'

// Cliente de API del módulo Búsqueda (HU5). Contrato con B2: docs/CONTRATO_VUELOS.md
//   GET /vuelos?origen&destino&fecha&precioMin&precioMax&duracionMin&duracionMax&clase&orden&pagina
//   GET /vuelos/{id}
// Los criterios se pueden combinar; los vacíos no se envían.

/** Estado inicial del formulario y de los parámetros de la URL. */
export const FILTROS_VACIOS = Object.freeze({
  origen: '',
  destino: '',
  fecha: '',
  clase: '',
  precioMin: '',
  precioMax: '',
  duracionMin: '',
  duracionMax: '',
  orden: 'fecha_asc',
})

const soloDigitos = (v) => {
  if (v === '' || v === null || v === undefined) return false
  const s = String(v).trim()
  return /^\d+$/.test(s)
}

const sinVaciar = (obj) => {
  const limpio = {}
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === '' || v === null || v === undefined) continue
    if (['precioMin', 'precioMax', 'duracionMin', 'duracionMax'].includes(k)) {
      if (!soloDigitos(v)) continue
    }
    limpio[k] = v
  }
  return limpio
}

/**
 * HU5 — Buscar vuelos combinando criterios.
 * @returns {Promise<{ total: number, items: Array }>}
 */
export async function buscarVuelos(filtros = {}) {
  const { data } = await http.get('/vuelos', { params: sinVaciar(filtros) })
  const items = Array.isArray(data) ? data : data?.items ?? []
  return { total: Number(data?.total ?? items.length), items }
}

/** HU5 — Detalle público de un vuelo (visitante y cliente). */
export async function obtenerVuelo(id) {
  const { data } = await http.get(`/vuelos/${encodeURIComponent(id)}`)
  return data
}
