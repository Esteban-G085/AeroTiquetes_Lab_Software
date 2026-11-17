import { http } from '@/services/http'

// Cliente de API del módulo Noticias (HU11). Contrato con B2:
//   GET  /noticias                        → lista de noticias publicadas
//   GET  /noticias/{id}                   → detalle de una noticia
//   GET  /noticias/suscripcion            → estado de suscripción del cliente
//   PUT  /noticias/suscripcion  {correo}  → suscribir al cliente autenticado
//   DELETE /noticias/suscripcion          → cancelar la suscripción del cliente
//   POST /noticias/suscripcion/cancelar   → cancelar desde enlace del correo (público, con token)
// Solo clientes autenticados pueden suscribirse/cancelar; consultar es público.

/** HU11 — Listar noticias vigentes (paginado; el backend max. 100 por página). */
export async function listarNoticias({ pagina, tamano } = {}) {
  const params = {}
  if (pagina != null) params.pagina = pagina
  if (tamano != null) params.tamano = tamano
  const { data } = await http.get('/noticias', Object.keys(params).length ? { params } : undefined)
  const items = Array.isArray(data) ? data : data?.items ?? []
  return {
    total: Number(data?.total ?? items.length),
    pagina: Number(data?.pagina ?? pagina ?? 1),
    tamano: Number(data?.tamano ?? tamano ?? 0),
    items,
  }
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

/** Alias del contrato F1: `obtenerSuscripcion` == `estadoSuscripcion`. */
export const obtenerSuscripcion = estadoSuscripcion

/** HU11 — Suscribir al cliente autenticado con el correo donde quiere recibir las noticias. */
export async function suscribirseNoticias(correo) {
  const { data } = await http.put('/noticias/suscripcion', { correo })
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

/** HU11 (admin) — Crear una noticia manualmente. */
export async function crearNoticia(payload) {
  const { data } = await http.post('/admin/noticias', payload)
  return data
}
