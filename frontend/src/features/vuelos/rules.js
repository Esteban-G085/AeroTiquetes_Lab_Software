// Reglas de la administración de vuelos (SRS 3.2.1, HU12–HU14 y HU20–HU22) que el front aplica para responder de inmediato.
// El backend (B2) es la autoridad: si rechaza, se muestra su mensaje.
// Las claves son las del contrato real: `salida_utc`, `costo`, `costo_primera` (ver docs/CONTRATO_VUELOS.md).

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

/** Causas prefijadas de cancelación (HU13). El valor enviado al backend es el código, no la etiqueta. */
export const MOTIVOS_CANCELACION = [
  { value: 'clima', label: 'Cierre del aeropuerto por condiciones climáticas' },
  { value: 'emergencia_medica', label: 'Emergencia médica a bordo' },
  { value: 'falla_tecnica', label: 'Falla técnica de la aeronave' },
  { value: 'huelga', label: 'Huelga del personal aeroportuario' },
  { value: 'restriccion', label: 'Restricción gubernamental o sanitaria' },
  { value: 'sobreventa', label: 'Sobreventa o reasignación operacional' },
]

const REQUIRED = 'Este campo es obligatorio.'

/** Zona en la que el administrador programa y edita (HU18): hora de Colombia, sea cual sea el aeropuerto de origen. */
export const ZONA_PROGRAMACION = 'America/Bogota'

/** Fecha (YYYY-MM-DD) y hora (HH:MM) que tiene un instante en una zona horaria IANA. */
export function partesEnZona(iso, timeZone = ZONA_PROGRAMACION) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t) => parts.find((p) => p.type === t).value
  return { fecha: `${get('year')}-${get('month')}-${get('day')}`, hora: `${get('hour')}:${get('minute')}` }
}

/** Igual que `partesEnZona` en la zona de programación; nombre usado por `VueloForm`. */
export const fechaHoraColombia = (iso) => (iso ? partesEnZona(iso, ZONA_PROGRAMACION) : null)

export const duracionDe = (horas, minutos) => {
  const h = Number(horas)
  const m = Number(minutos)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

export const horasMinutosDe = (duracionMin) => {
  const d = Number(duracionMin)
  if (!Number.isFinite(d) || d <= 0) return { horas: '1', minutos: '30' }
  return { horas: String(Math.floor(d / 60)), minutos: String(d % 60).padStart(2, '0') }
}

const salidaDe = (v) => v?.salida_utc ?? v?.salida

/** Valores iniciales del formulario de edición a partir del vuelo de la API, en hora de Colombia. */
export function valoresDesdeVuelo(v) {
  const local = fechaHoraColombia(salidaDe(v))
  const costo = v.costo ?? v.precio
  const primera = v.costo_primera ?? v.precio_primera ?? costo
  return {
    origen: v.origen?.codigo ?? '',
    destino: v.destino?.codigo ?? '',
    fecha: local?.fecha ?? '',
    hora: local?.hora ?? '08:00',
    ...horasMinutosDe(v.duracion_min),
    costo: costo == null ? '' : String(costo),
    costoPrimera: primera == null ? '' : String(primera),
  }
}

/**
 * Cuerpo exacto de `PUT /admin/vuelos/{id}` (HU12): sin `tipo` ni `estado`, con `precio_primera`.
 * Acepta tanto los nombres del formulario (`horas`, `minutos`, `costo`, `costoPrimera`) como los
 * del contrato (`duracion_min`, `precio`, `precio_primera`) para tener una sola implementación.
 */
export function payloadEditarVuelo(f) {
  const precio = Number(f.precio ?? f.costo)
  const primeraRaw = f.precio_primera ?? f.costoPrimera
  const primera = String(primeraRaw ?? '').trim() === '' ? precio : Number(primeraRaw)
  return {
    origen: f.origen,
    destino: f.destino,
    fecha: f.fecha,
    hora: f.hora,
    duracion_min: f.duracion_min == null ? duracionDe(f.horas, f.minutos) : Number(f.duracion_min),
    precio,
    precio_primera: primera,
  }
}

/** Alias del contrato F2; apunta a la misma función que usa `VueloForm`. */
export const payloadVuelo = payloadEditarVuelo

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

  const duracion = values.duracion_min == null ? duracionDe(values.horas, values.minutos) : values.duracion_min
  if (!String(duracion ?? '').trim()) e.duracion_min = REQUIRED
  else if (!entero(duracion) || Number(duracion) < DURACION_MIN || Number(duracion) > DURACION_MAX) {
    e.duracion_min = `Escribe minutos enteros entre ${DURACION_MIN} y ${DURACION_MAX}.`
  }

  const precio = values.precio ?? values.costo
  if (!String(precio ?? '').trim()) e.precio = REQUIRED
  else if (!entero(precio) || Number(precio) <= 0) e.precio = 'Escribe un valor entero mayor a 0.'
  else if (Number(precio) > PRECIO_MAX) e.precio = 'El valor máximo es $100.000.000.'
  return e
}

/**
 * ¿Se puede editar? (HU20/HU12) Solo un vuelo que aún no ha sucedido, sin tiquetes vendidos y no realizado.
 *  → { puede, motivo }
 */
export function evaluarEdicion(v, ahora = Date.now()) {
  const salida = Date.parse(salidaDe(v))
  if (v.estado === 'cancelado') return { puede: false, motivo: 'Este vuelo está cancelado y no se puede editar.' }
  if (v.estado === 'realizado') return { puede: false, motivo: 'Este vuelo ya fue realizado y no se puede editar.' }
  if (v.estado === 'sucedido' || (Number.isFinite(salida) && salida <= ahora)) {
    return { puede: false, motivo: 'Este vuelo ya sucedió y no se puede editar.' }
  }
  const vendidos = Number(v.tiquetes_vendidos ?? 0)
  if (vendidos > 0) {
    return { puede: false, motivo: `Este vuelo tiene ${vendidos} ${vendidos === 1 ? 'tiquete vendido' : 'tiquetes vendidos'}: solo se puede consultar.` }
  }
  return { puede: true, motivo: null }
}

/**
 * ¿Se puede cancelar? (HU21/HU13) Un vuelo programado. Si ya tiene tiquetes vendidos, solo con una causa
 * prefijada elegida por el administrador (`requiereMotivo`). Un vuelo realizado o ya sucedido no se cancela.
 *  → { puede, requiereMotivo, motivo }
 */
export function evaluarCancelacion(v, ahora = Date.now()) {
  const salida = Date.parse(salidaDe(v))
  if (v.estado === 'cancelado') return { puede: false, requiereMotivo: false, motivo: 'Este vuelo ya está cancelado.' }
  if (v.estado === 'realizado') return { puede: false, requiereMotivo: false, motivo: 'Este vuelo ya fue realizado y no se puede cancelar.' }
  if (v.estado === 'sucedido' || (Number.isFinite(salida) && salida <= ahora)) {
    return { puede: false, requiereMotivo: false, motivo: 'Este vuelo ya sucedió y no se puede cancelar.' }
  }
  return { puede: true, requiereMotivo: Number(v.tiquetes_vendidos ?? 0) > 0, motivo: null }
}

/**
 * Valida la causa prefijada: obligatoria solo cuando el vuelo tiene tiquetes vendidos, y siempre
 * debe ser uno de los códigos de `MOTIVOS_CANCELACION`. El backend aplica la misma regla.
 */
export const validarMotivo = (codigo, requerido) => {
  const valor = String(codigo ?? '').trim()
  if (!valor) return requerido ? 'Selecciona la causa de la cancelación.' : null
  return MOTIVOS_CANCELACION.some((m) => m.value === valor) ? null : 'Selecciona una causa válida.'
}
