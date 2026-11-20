import { http } from '@/services/http'
import { normalizarVencimiento, soloDigitos } from './validators'

// Cliente de API de Gestión financiera (B1-16, HU10). Contrato real del backend: docs/CONTRATO_COMPRAS.md §1
// La billetera se crea con saldo 0 al primer acceso del cliente.
// Sin historial de movimientos ni comprobantes: el SRS los excluye (RF19, RF20).
//
// Las pantallas esperan `{ saldo, moneda }` y tarjetas `{ id, tipo, numero, titular, vencimiento }`; el backend responde
// `{ saldo }` y `{ id, tipo, titular, fecha_expiracion, ultimos4, numero_enmascarado }` (nunca el número ni el código).
// Este archivo traduce entre las dos formas.

const saldoDe = (data) => ({ saldo: data.saldo, moneda: 'COP' })

/** GET /mi-billetera → { saldo, moneda } */
export async function obtenerBilletera() {
  const { data } = await http.get('/mi-billetera')
  return saldoDe(data)
}

/** Recargar exige elegir una tarjeta registrada y vigente; el backend audita cuál se usó.
 *  POST /mi-billetera/agregar-saldo { monto, id_tarjeta } → { saldo }. Nunca se envía el CVV. */
export async function agregarSaldo(monto, idTarjeta) {
  const { data } = await http.post('/mi-billetera/agregar-saldo', {
    monto, id_tarjeta: Number(idTarjeta),
  })
  return saldoDe(data)
}

/** "12/2030" → "12/30" (así lo muestra y lo edita la pantalla). */
const vencimientoCorto = (v) => {
  const m = /^(\d{2})\/(\d{2})(\d{2})?$/.exec(String(v ?? ''))
  return m ? `${m[1]}/${m[3] ?? m[2]}` : String(v ?? '')
}

/** Tarjeta del backend → tarjeta de la pantalla. `numero` trae solo los últimos 4 dígitos (la pantalla los enmascara). */
export const adaptarTarjeta = (t) => ({
  id: t.id,
  tipo: t.tipo,
  marca: t.marca ?? 'Otra',
  numero: t.ultimos4,
  titular: t.titular,
  vencimiento: vencimientoCorto(t.fecha_expiracion),
})

const CAMPOS_DEL_FORMULARIO = { fecha_expiracion: 'vencimiento' }

/** Los errores por campo usan `fecha_expiracion`; el formulario lo llama `vencimiento`. */
function adaptarError(err) {
  if (err && typeof err === 'object' && err.fields) {
    err.fields = Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [CAMPOS_DEL_FORMULARIO[k] ?? k, v]))
  }
  return err
}

const asList = (data) => (Array.isArray(data) ? data : data?.items ?? [])

/** GET /mi-billetera/tarjetas → [{ id, tipo, numero (últimos 4), titular, vencimiento }]  (nunca el código) */
export async function listarTarjetas() {
  const { data } = await http.get('/mi-billetera/tarjetas')
  return asList(data).map(adaptarTarjeta)
}

const toPayload = (v) => {
  const numero = soloDigitos(v.numero)
  return {
    tipo: v.tipo,
    // Al editar, si la persona no volvió a escribir el número completo, no se envía y el backend conserva el que tiene.
    ...(numero.length >= 13 ? { numero } : {}),
    titular: v.titular.trim(),
    fecha_expiracion: normalizarVencimiento(v.vencimiento),
    codigo: v.codigo.trim(),
  }
}

/** POST /mi-billetera/tarjetas */
export async function crearTarjeta(values) {
  try {
    const { data } = await http.post('/mi-billetera/tarjetas', toPayload(values))
    return adaptarTarjeta(data)
  } catch (err) {
    throw adaptarError(err)
  }
}

/** PUT /mi-billetera/tarjetas/{id} */
export async function actualizarTarjeta(id, values) {
  try {
    const { data } = await http.put(`/mi-billetera/tarjetas/${encodeURIComponent(id)}`, toPayload(values))
    return adaptarTarjeta(data)
  } catch (err) {
    throw adaptarError(err)
  }
}

/** DELETE /mi-billetera/tarjetas/{id} */
export async function eliminarTarjeta(id) {
  await http.delete(`/mi-billetera/tarjetas/${encodeURIComponent(id)}`)
}
