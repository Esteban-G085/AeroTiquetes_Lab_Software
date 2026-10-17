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

/** Hora "22:10" de un instante, en la zona horaria dada (la del aeropuerto), sin depender del equipo del usuario. */
export function formatTime(iso, timeZone) {
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(iso))
}

/** Día "mar 10 nov" de un instante en la zona dada. */
export function formatDay(iso, timeZone) {
  return new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(new Date(iso)).replace(/\./g, '')
}

const dayKey = (iso, timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(iso)) // YYYY-MM-DD

/** Días de diferencia entre la fecha local de salida y la local de llegada (cada una en su zona). */
export function dayOffset(salidaIso, salidaTz, llegadaIso, llegadaTz) {
  const a = Date.parse(dayKey(salidaIso, salidaTz))
  const b = Date.parse(dayKey(llegadaIso, llegadaTz))
  return Math.round((b - a) / 86_400_000)
}

/** Minutos entre dos instantes (la zona horaria no influye: son instantes absolutos). */
export const minutesBetween = (aIso, bIso) => Math.round((Date.parse(bIso) - Date.parse(aIso)) / 60_000)
