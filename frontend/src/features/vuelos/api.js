import { http } from '@/services/http'

// Cliente de API del módulo Administración de vuelos (HU18, HU19). Contrato con B2:
// docs/CONTRATO_VUELOS.md
//   GET  /admin/vuelos?estado&origen&destino&pagina   → { total, items }
//   POST /admin/vuelos  { tipo, origen, destino, fecha, hora, duracion, costo }
//   GET  /admin/vuelos/{id}
//   PUT  /admin/vuelos/{id}  { tipo, origen, destino, fecha, hora, duracion, costo }
//   PATCH /admin/vuelos/{id}/cancelar
//   GET  /admin/vuelos/realizados
// El backend genera el código consecutivo, la hora de llegada y los cupos por clase (D3, D4).

const sinVaciar = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined))

/** HU19 — Listado de vuelos programados con filtros opcionales. */
export async function listarVuelos(filtros = {}) {
  const { data } = await http.get('/admin/vuelos', { params: sinVaciar(filtros) })
  const items = Array.isArray(data) ? data : data?.items ?? []
  return { total: Number(data?.total ?? items.length), items }
}

/** HU18 — Programar un vuelo. Devuelve el vuelo creado (con `id` y `codigo`). */
export async function crearVuelo(payload) {
  const { data } = await http.post('/admin/vuelos', payload)
  return data
}

/** HU19 — Consultar un vuelo programado. */
export async function obtenerVueloAdmin(id) {
  const { data } = await http.get(`/admin/vuelos/${encodeURIComponent(id)}`)
  return data
}

/** HU12 — Editar un vuelo programado. Devuelve el vuelo actualizado. */
export async function actualizarVuelo(id, payload) {
  const { data } = await http.put(`/admin/vuelos/${encodeURIComponent(id)}`, payload)
  return data
}

/** HU13 — Cancela un vuelo programado. Devuelve el vuelo con estado `cancelado`. */
export async function cancelarVuelo(id) {
  const { data } = await http.patch(`/admin/vuelos/${encodeURIComponent(id)}/cancelar`)
  return data
}

/** HU14 — Listar vuelos realizados o sucedidos. */
export async function listarVuelosRealizados() {
  const { data } = await http.get('/admin/vuelos/realizados')
  const items = Array.isArray(data) ? data : data?.items ?? []
  return { total: Number(data?.total ?? items.length), items }
}
