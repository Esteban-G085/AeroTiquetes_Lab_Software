import { http } from '@/services/http'

// Cliente de API del módulo Administración de vuelos (HU18, HU19). Contrato con B2:
// docs/CONTRATO_VUELOS.md
//   GET  /admin/vuelos?estado&origen&destino&pagina   → { total, items }
//   POST /admin/vuelos  { tipo, origen, destino, fecha, hora, duracion, costo }
//   GET  /admin/vuelos/{id}
//   PUT  /admin/vuelos/{id}            (HU12, editar)
//   PATCH /admin/vuelos/{id}/cancelar  (HU13, cancelar)
//   GET  /admin/vuelos/realizados      (HU14)
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

// ───────────── Gestión del vuelo (HU12, HU13, HU14) ─────────────
// Las pantallas de editar, cancelar y realizados (F1) trabajan con la forma `{ salida, precio, origen: { ciudad, codigo }, … }`;
// el backend responde `{ salida_utc, costo, origen: { nombre, codigo, zona_horaria }, … }`. Aquí se traduce, en un solo lugar.

/** Vuelo del backend → vuelo con la forma que usan las pantallas de gestión. */
export function adaptarVueloAdmin(v) {
  return {
    id: v.id,
    codigo: v.codigo,
    tipo: v.tipo,
    estado: v.estado,
    origen: { ciudad: v.origen?.nombre, codigo: v.origen?.codigo },
    destino: { ciudad: v.destino?.nombre, codigo: v.destino?.codigo },
    salida: v.salida_utc,
    llegada: v.llegada_utc,
    salida_zona: v.origen?.zona_horaria,
    llegada_zona: v.destino?.zona_horaria,
    duracion_min: v.duracion_min,
    precio: v.costo,
    moneda: 'COP',
    tiquetes_vendidos: v.tiquetes_vendidos ?? 0,
  }
}

/** GET /admin/vuelos/{id} → vuelo adaptado (con `tiquetes_vendidos`). */
export async function obtenerVuelo(id) {
  return adaptarVueloAdmin(await obtenerVueloAdmin(id))
}

/** GET /ciudades → [{ codigo, ciudad }] para los selects del formulario de edición. */
export async function listarCiudades() {
  const { data } = await http.get('/ciudades')
  return (Array.isArray(data) ? data : data?.items ?? []).map((c) => ({ codigo: c.codigo, ciudad: c.nombre }))
}

/** PUT /admin/vuelos/{id}. `fecha` y `hora` son las de Colombia, igual que al programar el vuelo. */
export async function editarVuelo(id, values) {
  const { data } = await http.put(`/admin/vuelos/${encodeURIComponent(id)}`, {
    fecha: values.fecha, hora: values.hora, origen: values.origen, destino: values.destino,
    duracion_min: Number(values.duracion_min), precio: Number(values.precio),
  })
  return adaptarVueloAdmin(data)
}

/** PATCH /admin/vuelos/{id}/cancelar. Con tiquetes vendidos hace falta `motivo` (fuerza mayor); reintegra a los clientes. */
export async function cancelarVuelo(id, motivo = '') {
  const { data } = await http.patch(`/admin/vuelos/${encodeURIComponent(id)}/cancelar`, { motivo: motivo.trim() || null })
  return adaptarVueloAdmin(data)
}

/** GET /admin/vuelos/realizados → vuelos `sucedido` y `realizado`, el más reciente primero. */
export async function listarVuelosRealizados() {
  const { data } = await http.get('/admin/vuelos/realizados')
  return (Array.isArray(data) ? data : data?.items ?? []).map(adaptarVueloAdmin)
}
