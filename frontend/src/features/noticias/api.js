import { http } from '@/services/http'

// Cliente de API del módulo Noticias (HU11). Contrato con B2:
//   GET  /noticias                        → lista de noticias publicadas
//   GET  /noticias/{id}                   → detalle de una noticia
//   GET  /noticias/suscripcion            → estado de suscripción del cliente
//   POST /noticias/suscripcion            → suscribir al cliente autenticado
//   DELETE /noticias/suscripcion          → cancelar la suscripción del cliente
//   POST /noticias/suscripcion/cancelar   → cancelar desde enlace del correo (público, con token)
// Solo clientes autenticados pueden suscribirse/cancelar; consultar es público.

/** HU11 — Listar noticias de vuelos publicadas. */
export async function listarNoticias() {
  const { data } = await http.get('/noticias')
  const items = Array.isArray(data) ? data : data?.items ?? []
  return { total: Number(data?.total ?? items.length), items }
}

/** HU11 — Consultar el detalle de una noticia. */
export async function obtenerNoticia(id) {
  const { data } = await http.get(`/noticias/${encodeURIComponent(id)}`)
  return data
}

/** HU11 — Consultar si el cliente autenticado está suscrito a las noticias. */
export async function estadoSuscripcion() {
  const { data } = await http.get('/noticias/suscripcion')
  return data
}

/** HU11 — Suscribir al cliente autenticado a las noticias. */
export async function suscribirseNoticias() {
  const { data } = await http.post('/noticias/suscripcion')
  return data
}

/** HU11 — Cancelar la suscripción del cliente autenticado a las noticias. */
export async function cancelarSuscripcionNoticias() {
  const { data } = await http.delete('/noticias/suscripcion')
  return data
}

/** HU11 — Cancelar la suscripción desde el enlace del correo (público, con token). */
export async function cancelarConToken(token) {
  const { data } = await http.post('/noticias/suscripcion/cancelar', { token })
  return data
}
