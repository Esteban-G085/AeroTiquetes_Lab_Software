import { http } from '@/services/http'

// Cliente de API del módulo Noticias (HU11). Contrato con B2:
//   GET  /noticias              → lista de noticias publicadas
//   POST /noticias/suscribirse  → suscribir al cliente autenticado
//   DELETE /noticias/suscribirse → cancelar la suscripción del cliente autenticado
// Solo clientes autenticados pueden suscribirse/cancelar; consultar es público.

/** HU11 — Listar noticias de vuelos publicadas. */
export async function listarNoticias() {
  const { data } = await http.get('/noticias')
  const items = Array.isArray(data) ? data : data?.items ?? []
  return { total: Number(data?.total ?? items.length), items }
}

/** HU11 — Suscribir al cliente autenticado a las noticias. */
export async function suscribirseNoticias() {
  const { data } = await http.post('/noticias/suscribirse')
  return data
}

/** HU11 — Cancelar la suscripción del cliente autenticado a las noticias. */
export async function cancelarSuscripcionNoticias() {
  const { data } = await http.delete('/noticias/suscribirse')
  return data
}
