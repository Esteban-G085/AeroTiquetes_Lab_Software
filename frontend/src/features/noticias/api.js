import { http } from '@/services/http'

// Cliente de API de Noticias (B2-15, HU11). Contrato: docs/CONTRATO_SPRINT2.md §4
// La noticia de un vuelo la crea el backend al programarlo y la retira sola (8 días o al realizarse el vuelo).

/** GET /noticias → [{ id, tipo: 'vuelo' | 'promocion', titulo, vuelo_id, origen, destino, salida, salida_zona, precio, moneda,
 *                    descuento_pct?, precio_original?, imagen_url?, publicada_en, vigente_hasta }] */
export async function listarNoticias() {
  const { data } = await http.get('/noticias')
  return Array.isArray(data) ? data : data?.items ?? []
}

/** GET /noticias/suscripcion → { suscrito, correo } */
export async function obtenerSuscripcion() {
  const { data } = await http.get('/noticias/suscripcion')
  return data
}

/** PUT /noticias/suscripcion { correo } → { suscrito: true, correo } */
export async function suscribirse(correo) {
  const { data } = await http.put('/noticias/suscripcion', { correo: correo.trim() })
  return data
}

/** DELETE /noticias/suscripcion */
export async function cancelarSuscripcion() {
  await http.delete('/noticias/suscripcion')
}
