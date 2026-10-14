// Utilidades de fecha/hora.
// El backend guarda y envía instantes en UTC (ISO 8601). El front los muestra
// en la zona horaria de la ciudad correspondiente usando Intl (soporta DST).

export const ZONA_COLOMBIA = 'America/Bogota'

function toDate(valor) {
  if (!valor) return null
  const d = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

function formato(zonaHoraria, opciones) {
  return new Intl.DateTimeFormat('es-CO', { timeZone: zonaHoraria || ZONA_COLOMBIA, ...opciones })
}

/** "vie, 13 oct 2026" */
export function formatFecha(valor, zonaHoraria) {
  const d = toDate(valor)
  if (!d) return '—'
  return formato(zonaHoraria, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

/** "13 oct 2026" (sin día de la semana) */
export function formatFechaCorta(valor, zonaHoraria) {
  const d = toDate(valor)
  if (!d) return '—'
  return formato(zonaHoraria, { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

/** "14:35" */
export function formatHora(valor, zonaHoraria) {
  const d = toDate(valor)
  if (!d) return '—'
  return formato(zonaHoraria, { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

/** "vie 13 oct 2026 · 14:35" */
export function formatFechaHora(valor, zonaHoraria) {
  const d = toDate(valor)
  if (!d) return '—'
  return `${formatFecha(d, zonaHoraria)} · ${formatHora(d, zonaHoraria)}`
}

/** Sigla de zona horaria (COT, CET, EDT...) */
export function formatZona(valor, zonaHoraria) {
  const d = toDate(valor)
  if (!d) return ''
  return formato(zonaHoraria, { timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? ''
}

/** 510 -> "8 h 30 min" */
export function formatDuracion(minutos) {
  const total = Number(minutos)
  if (!Number.isFinite(total) || total < 0) return '—'
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/** Fecha de hoy en formato yyyy-mm-dd (para min de inputs date) */
export function hoyISO() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

/** "08:30" -> 510 minutos */
export function horaAMinutos(hora) {
  if (!hora || !/^\d{1,2}:\d{2}$/.test(hora)) return null
  const [h, m] = hora.split(':').map(Number)
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** minutos -> "08:30" */
export function minutosAHora(minutos) {
  if (!Number.isFinite(minutos) || minutos < 0) return ''
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
