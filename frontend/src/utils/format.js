// Formato de datos de viaje (precio, duración, horas). Todo en español de Colombia.

/** 1250000 → "$ 1.250.000". `currency` es el código ISO de la moneda que envíe el backend. */
export function formatPrice(amount, currency = 'COP') {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount))
}

/** 135 → "2 h 15 min"; 120 → "2 h"; 45 → "45 min". */
export function formatDuration(totalMinutes) {
  const m = Math.round(Number(totalMinutes))
  if (!Number.isFinite(m) || m < 0) return '—'
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (!h) return `${rest} min`
  return rest ? `${h} h ${rest} min` : `${h} h`
}

/** Convierte a `Date`; `null` si el valor falta o no es una fecha válida. */
const toDate = (valor) => {
  if (!valor) return null
  const d = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Hora "22:10" de un instante, en la zona horaria dada (la del aeropuerto), sin depender del equipo del usuario. */
export function formatTime(iso, timeZone) {
  const d = toDate(iso)
  if (!d) return '—'
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(d)
}

/** Día "mar 10 nov" de un instante en la zona dada. */
export function formatDay(iso, timeZone) {
  const d = toDate(iso)
  if (!d) return '—'
  return new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(d).replace(/\./g, '')
}

const dayKey = (iso, timeZone) => {
  const d = toDate(iso)
  return d ? new Intl.DateTimeFormat('en-CA', { timeZone }).format(d) : '' // YYYY-MM-DD
}

/** Días de diferencia entre la fecha local de salida y la local de llegada (cada una en su zona). */
export function dayOffset(salidaIso, salidaTz, llegadaIso, llegadaTz) {
  const a = dayKey(salidaIso, salidaTz)
  const b = dayKey(llegadaIso, llegadaTz)
  if (!a || !b) return 0
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

/** Minutos entre dos instantes (la zona horaria no influye: son instantes absolutos). */
export const minutesBetween = (aIso, bIso) => Math.round((Date.parse(bIso) - Date.parse(aIso)) / 60_000)

// ── Fechas con año (paneles de vuelos y búsqueda, F2) ─────────────────────────
// `formatDay` (sin año) sirve para la tarjeta; los paneles necesitan el año explícito
// y una versión tolerante a valores vacíos (campos opcionales como `fecha_programacion`).

const dateTimeFormat = (iso, timeZone, options) =>
  new Intl.DateTimeFormat('es-CO', { timeZone: timeZone || undefined, ...options })

// es-CO separa con "de" ("10 de nov de 2026") y abrevia con punto ("sept."): se limpia para
// dejar "mar, 10 nov 2026", como en el resto de la interfaz.
const limpiar = (texto) => texto.replace(/\./g, '').replace(/ de /g, ' ')

/** "mar, 10 nov 2026" de un instante, en la zona dada. "—" si el valor está vacío o es inválido. */
export function formatDate(iso, timeZone) {
  const d = toDate(iso)
  if (!d) return '—'
  return limpiar(dateTimeFormat(d, timeZone, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(d))
}

/** "10 nov 2026" (sin el día de la semana). */
export function formatDateShort(iso, timeZone) {
  const d = toDate(iso)
  if (!d) return '—'
  return limpiar(dateTimeFormat(d, timeZone, { day: '2-digit', month: 'short', year: 'numeric' }).format(d))
}

/** "vie, 13 oct 2026 · 14:35". */
export function formatDateTime(iso, timeZone) {
  const d = toDate(iso)
  if (!d) return '—'
  return `${formatDate(d, timeZone)} · ${new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(d)}`
}

/** Sigla de la zona horaria del instante ("COT", "CET", "EDT"…). */
export function formatZone(iso, timeZone) {
  const d = toDate(iso)
  if (!d || !timeZone) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(d)
    .find((p) => p.type === 'timeZoneName')?.value ?? ''
}

/** Fecha de hoy "yyyy-mm-dd" para el `min` de los input date (día local del usuario). */
export function todayISO() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

/** "08:30" → 510 minutos. `null` si no es una hora válida (HH:MM). */
export function timeToMinutes(hora) {
  if (!/^\d{1,2}:\d{2}$/.test(String(hora ?? ''))) return null
  const [h, m] = String(hora).split(':').map(Number)
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** 510 → "08:30". */
export function minutesToTime(minutos) {
  const m = Number(minutos)
  if (!Number.isFinite(m) || m < 0) return ''
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
