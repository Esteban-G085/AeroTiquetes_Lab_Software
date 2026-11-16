// Reglas de la administración de vuelos (SRS 3.2.1, HU20–HU22) que el front aplica para responder de inmediato.
// El backend (B2) es la autoridad: si rechaza, se muestra su mensaje.

/** Estados del vuelo (SRS Vuelos RF11–RF13). "sucedido" = ya llegó su hora de salida; "realizado" = se completó. */
export const ESTADOS_VUELO = {
  programado: { label: 'Programado', tone: 'success' },
  sucedido: { label: 'Sucedido', tone: 'warning' },
  realizado: { label: 'Realizado', tone: 'neutral' },
  cancelado: { label: 'Cancelado', tone: 'danger' },
}
export const estadoVuelo = (e) => ESTADOS_VUELO[e] ?? { label: e, tone: 'neutral' }

export const DURACION_MIN = 10        // minutos
export const DURACION_MAX = 1440      // 24 h
export const PRECIO_MAX = 100_000_000
export const MOTIVO_MIN = 10          // caracteres, para la causa de fuerza mayor

const REQUIRED = 'Este campo es obligatorio.'

/** Fecha (YYYY-MM-DD) y hora (HH:MM) que tiene un instante en una zona horaria IANA. */
export function partesEnZona(iso, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t) => parts.find((p) => p.type === t).value
  return { fecha: `${get('year')}-${get('month')}-${get('day')}`, hora: `${get('hour')}:${get('minute')}` }
}

/** Zona en la que el administrador programa y edita (HU18): hora de Colombia, sea cual sea el aeropuerto de origen. */
export const ZONA_PROGRAMACION = 'America/Bogota'

/** Valores iniciales del formulario de edición a partir del vuelo de la API. */
export function valoresDesdeVuelo(v) {
  const { fecha, hora } = partesEnZona(v.salida, ZONA_PROGRAMACION)
  return { fecha, hora, origen: v.origen.codigo, destino: v.destino.codigo, duracion_min: String(v.duracion_min), precio: String(v.precio) }
}

/** Cuerpo de PUT /admin/vuelos/{id}. La fecha y la hora son las de Colombia, como al programar el vuelo. */
export const payloadVuelo = (values) => ({
  fecha: values.fecha, hora: values.hora, origen: values.origen, destino: values.destino,
  duracion_min: Number(values.duracion_min), precio: Number(values.precio),
})

const entero = (v) => /^\d+$/.test(String(v ?? '').trim())

/** { campo: mensaje } solo de los campos inválidos. */
export function validarVuelo(values) {
  const e = {}
  if (!values.fecha) e.fecha = REQUIRED
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.fecha) || Number.isNaN(Date.parse(values.fecha))) e.fecha = 'Fecha no válida.'
  if (!values.hora) e.hora = REQUIRED
  else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.hora)) e.hora = 'Hora no válida (HH:MM).'
  if (!values.origen) e.origen = 'Selecciona una opción.'
  if (!values.destino) e.destino = 'Selecciona una opción.'
  else if (values.origen && values.origen === values.destino) e.destino = 'El destino debe ser distinto del origen.'
  if (!String(values.duracion_min ?? '').trim()) e.duracion_min = REQUIRED
  else if (!entero(values.duracion_min) || Number(values.duracion_min) < DURACION_MIN || Number(values.duracion_min) > DURACION_MAX) {
    e.duracion_min = `Escribe minutos enteros entre ${DURACION_MIN} y ${DURACION_MAX}.`
  }
  if (!String(values.precio ?? '').trim()) e.precio = REQUIRED
  else if (!entero(values.precio) || Number(values.precio) <= 0) e.precio = 'Escribe un valor entero mayor a 0.'
  else if (Number(values.precio) > PRECIO_MAX) e.precio = 'El valor máximo es $100.000.000.'
  return e
}

/**
 * ¿Se puede editar? (HU20) Solo un vuelo que aún no ha sucedido, sin tiquetes vendidos y no realizado.
 *  → { puede, motivo }
 */
export function evaluarEdicion(v, ahora = Date.now()) {
  if (v.estado === 'cancelado') return { puede: false, motivo: 'Este vuelo está cancelado: ya no se puede editar.' }
  if (v.estado === 'realizado') return { puede: false, motivo: 'Este vuelo ya fue realizado: no se puede editar.' }
  if (v.estado === 'sucedido' || Date.parse(v.salida) <= ahora) return { puede: false, motivo: 'Este vuelo ya sucedió: no se puede editar.' }
  if (Number(v.tiquetes_vendidos) > 0) {
    return { puede: false, motivo: `Este vuelo ya tiene ${v.tiquetes_vendidos} ${Number(v.tiquetes_vendidos) === 1 ? 'tiquete vendido' : 'tiquetes vendidos'}: no se puede editar.` }
  }
  return { puede: true, motivo: null }
}

/**
 * ¿Se puede cancelar? (HU21) Un vuelo programado. Si ya tiene tiquetes vendidos, solo con una causa de fuerza mayor
 * registrada por el administrador (`requiereMotivo`). Un vuelo realizado o ya sucedido no se cancela.
 *  → { puede, requiereMotivo, motivo }
 */
export function evaluarCancelacion(v, ahora = Date.now()) {
  if (v.estado === 'cancelado') return { puede: false, requiereMotivo: false, motivo: 'Este vuelo ya está cancelado.' }
  if (v.estado === 'realizado') return { puede: false, requiereMotivo: false, motivo: 'Este vuelo ya fue realizado: no se puede cancelar.' }
  if (v.estado === 'sucedido' || Date.parse(v.salida) <= ahora) return { puede: false, requiereMotivo: false, motivo: 'Este vuelo ya sucedió: no se puede cancelar.' }
  return { puede: true, requiereMotivo: Number(v.tiquetes_vendidos) > 0, motivo: null }
}

export const validarMotivo = (texto, requerido) => {
  const t = String(texto ?? '').trim()
  if (!t) return requerido ? 'Registra la causa de fuerza mayor.' : null
  if (t.length < MOTIVO_MIN) return `Escribe al menos ${MOTIVO_MIN} caracteres.`
  if (t.length > 300) return 'Máximo 300 caracteres.'
  return null
}

