// Reglas de negocio de compra y reserva (SRS 3.2.2) que el front aplica para responder de inmediato.
// Son espejo de las del backend (B1): el backend sigue siendo la autoridad. Si una regla cambia, se cambia SOLO aquí.

export const MAX_TIQUETES_VUELO = 5          // RF05: por vuelo y por cliente (compra o reserva), no acumulado
export const MAYORIA_EDAD = 18               // RF19: para todos los destinos
export const VIGENCIA_RESERVA_H = 24         // RF04
export const CANCELAR_COMPRA_ANTES_MIN = 60  // RF15: hasta 1 hora antes de la salida

export const CLASES = [
  { value: 'economica', label: 'Económica' },
  { value: 'primera', label: 'Primera clase' },
]
export const claseLabel = (value) => CLASES.find((c) => c.value === value)?.label ?? value

export const GENEROS = [
  { value: 'femenino', label: 'Femenino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'otro', label: 'Otro' },
]

/** Datos obligatorios de cada viajero (RF06). */
export const VIAJERO_VACIO = Object.freeze({
  documento: '', nombres: '', apellidos: '', fecha_nacimiento: '', genero: '',
  telefono: '', correo: '', contacto_nombre: '', contacto_telefono: '',
})

const REQUIRED = 'Este campo es obligatorio.'
const text = (v) => String(v ?? '').trim()
const NAME_RE = /^[\p{L}][\p{L}\s'’.-]*$/u
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Fecha local de hoy como YYYY-MM-DD (para el atributo `max` de <input type="date">). */
export function todayISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** Edad cumplida (años) de alguien nacido en `ymd` (YYYY-MM-DD) en la fecha `refIso`. */
export function edadEn(ymd, refIso) {
  const [y, m, d] = String(ymd).split('-').map(Number)
  const ref = new Date(refIso)
  let edad = ref.getUTCFullYear() - y
  const antesDeCumple = ref.getUTCMonth() + 1 < m || (ref.getUTCMonth() + 1 === m && ref.getUTCDate() < d)
  if (antesDeCumple) edad -= 1
  return edad
}
export const esMayorDeEdad = (ymd, refIso) => edadEn(ymd, refIso) >= MAYORIA_EDAD

const phone = (v) => {
  const digits = text(v).replace(/\D/g, '')
  if (!text(v)) return REQUIRED
  if (!/^\+?[\d\s()-]+$/.test(text(v)) || digits.length < 7 || digits.length > 15) return 'Escribe un teléfono válido (7 a 15 dígitos).'
  return null
}

const campos = {
  documento: (v) => !text(v) ? REQUIRED : !/^[A-Za-z0-9-]{5,20}$/.test(text(v)) ? 'Entre 5 y 20 caracteres, solo letras y números.' : null,
  nombres: (v) => !text(v) ? REQUIRED : !NAME_RE.test(text(v)) || text(v).length > 60 ? 'Usa solo letras (máximo 60).' : null,
  apellidos: (v) => !text(v) ? REQUIRED : !NAME_RE.test(text(v)) || text(v).length > 60 ? 'Usa solo letras (máximo 60).' : null,
  fecha_nacimiento: (v, { hoy }) => !text(v) ? REQUIRED
    : !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)) ? 'Fecha no válida.'
    : v > hoy ? 'La fecha de nacimiento no puede ser futura.'
    : v < '1900-01-01' ? 'Fecha no válida.' : null,
  genero: (v) => !text(v) ? 'Selecciona una opción.' : !GENEROS.some((g) => g.value === v) ? 'Selecciona una opción válida.' : null,
  telefono: phone,
  correo: (v) => !text(v) ? REQUIRED : !EMAIL_RE.test(text(v)) || text(v).length > 120 ? 'Escribe un correo válido.' : null,
  contacto_nombre: (v) => !text(v) ? REQUIRED : !NAME_RE.test(text(v)) || text(v).length > 80 ? 'Usa solo letras (máximo 80).' : null,
  contacto_telefono: phone,
}

/** Errores de UN viajero: { campo: mensaje } solo de los inválidos. */
export function validarViajero(viajero, { hoy = todayISO() } = {}) {
  const errors = {}
  for (const [campo, regla] of Object.entries(campos)) {
    const msg = regla(viajero?.[campo], { hoy })
    if (msg) errors[campo] = msg
  }
  return errors
}

/** Tiquetes que el cliente todavía puede sumar en un vuelo (RF05). */
export const cupoRestante = (tiquetesCliente = 0) => Math.max(MAX_TIQUETES_VUELO - Number(tiquetesCliente || 0), 0)

/**
 * Valida la lista de viajeros de UN vuelo.
 *  → { porViajero: [{campo: msg}, …], general: [mensajes], ok }
 *  Reglas: campos obligatorios (RF06) · sin documentos repetidos en el vuelo (RF09) ·
 *  al menos un mayor de 18 años en la fecha del vuelo, o el menor viajaría solo (RF18) · máximo 5 por vuelo (RF05).
 */
export function validarViajeros(viajeros, { salidaIso, tiquetesCliente = 0, hoy = todayISO() } = {}) {
  const porViajero = viajeros.map((v) => validarViajero(v, { hoy }))
  const general = []

  // Documentos repetidos: se marca cada repetición después de la primera
  const vistos = new Map()
  viajeros.forEach((v, i) => {
    const doc = text(v.documento).toUpperCase()
    if (!doc) return
    if (vistos.has(doc)) {
      if (!porViajero[i].documento) porViajero[i].documento = 'Este documento ya está en la lista de viajeros de este vuelo.'
    } else vistos.set(doc, i)
  })

  const cupo = cupoRestante(tiquetesCliente)
  if (viajeros.length > cupo) {
    general.push(cupo === 0
      ? `Ya tienes ${MAX_TIQUETES_VUELO} tiquetes en este vuelo, que es el máximo por cliente.`
      : `En este vuelo puedes agregar como máximo ${cupo} ${cupo === 1 ? 'tiquete más' : 'tiquetes más'} (el límite es ${MAX_TIQUETES_VUELO} por cliente).`)
  }

  // Un menor no puede ser el único viajero: debe ir con alguien mayor de edad en el mismo vuelo
  const conFecha = viajeros.filter((v, i) => !porViajero[i].fecha_nacimiento && text(v.fecha_nacimiento))
  if (conFecha.length === viajeros.length && viajeros.length > 0 && salidaIso) {
    const hayAdulto = viajeros.some((v) => esMayorDeEdad(v.fecha_nacimiento, salidaIso))
    if (!hayAdulto) general.push(`Un menor de edad no puede viajar solo: agrega al menos un viajero mayor de ${MAYORIA_EDAD} años en este vuelo.`)
  }

  const ok = general.length === 0 && porViajero.every((e) => Object.keys(e).length === 0)
  return { porViajero, general, ok }
}

// ---- Tiempos (reservas y cancelaciones) ----

/** ¿Se puede cancelar la compra? Hasta 1 hora antes de la salida (RF15). */
export const puedeCancelarCompra = (salidaIso, ahora = Date.now()) =>
  ahora <= Date.parse(salidaIso) - CANCELAR_COMPRA_ANTES_MIN * 60_000

/** Milisegundos que le quedan a una reserva (≤ 0 = vencida). */
export const msRestantesReserva = (expiraIso, ahora = Date.now()) => Date.parse(expiraIso) - ahora

/** Una reserva solo se puede cancelar o pagar dentro de sus 24 h de vigencia (RF04, RF16). */
export const reservaVigente = (expiraIso, ahora = Date.now()) => msRestantesReserva(expiraIso, ahora) > 0

// ---- Estados del historial ----
export const ESTADOS_COMPRA = {
  confirmada: { tone: 'success', label: 'Confirmada', grupo: 'activas' },
  realizada: { tone: 'neutral', label: 'Realizada', grupo: 'realizadas' },
  cancelada: { tone: 'danger', label: 'Cancelada', grupo: 'canceladas' },
}
export const ESTADOS_RESERVA = {
  activa: { tone: 'success', label: 'Activa', grupo: 'activas' },
  cancelada: { tone: 'danger', label: 'Cancelada', grupo: 'canceladas' },
  vencida: { tone: 'warning', label: 'Vencida', grupo: 'canceladas' },
}
