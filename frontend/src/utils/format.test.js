import {
  dayOffset, formatDate, formatDateShort, formatDateTime, formatDay, formatDuration,
  formatPrice, formatTime, formatZone, minutesBetween, minutesToTime, timeToMinutes, todayISO,
} from './format'

const SALE = '2026-11-10T22:10:00-05:00' // Bogotá
const LLEGA = '2026-11-11T14:25:00+01:00' // Madrid

describe('formatPrice', () => {
  it('usa separador de miles colombiano y símbolo', () => {
    const txt = formatPrice(1250000, 'COP').replace(/\s/g, ' ')
    expect(txt).toMatch(/\$/)
    expect(txt).toMatch(/1\.250\.000/)
  })
  it('valores ausentes o inválidos no rompen la pantalla', () => {
    expect(formatPrice(null)).toBe('—')
    expect(formatPrice(undefined)).toBe('—')
    expect(formatPrice('abc')).toBe('—')
  })
})

describe('formatDuration', () => {
  it.each([[135, '2 h 15 min'], [120, '2 h'], [45, '45 min'], [0, '0 min'], [615, '10 h 15 min']])('%i min → %s', (m, out) => {
    expect(formatDuration(m)).toBe(out)
  })
  it('inválidos → raya', () => {
    expect(formatDuration(NaN)).toBe('—')
    expect(formatDuration(-5)).toBe('—')
  })
})

describe('horas y días en la zona del aeropuerto (no la del equipo)', () => {
  it('muestra la salida en hora de Bogotá y la llegada en hora de Madrid', () => {
    expect(formatTime(SALE, 'America/Bogota')).toBe('22:10')
    expect(formatTime(LLEGA, 'Europe/Madrid')).toBe('14:25')
  })
  it('el mismo instante se ve distinto según la zona que se pida', () => {
    expect(formatTime(SALE, 'Europe/Madrid')).toBe('04:10')
    expect(formatTime(SALE, 'America/Bogota')).not.toBe(formatTime(SALE, 'Asia/Tokyo'))
  })
  it('medianoche se muestra como 00:xx, no como 24:xx', () => {
    expect(formatTime('2026-11-10T00:05:00-05:00', 'America/Bogota')).toBe('00:05')
  })
  it('formatDay trae día y mes', () => {
    expect(formatDay(SALE, 'America/Bogota')).toMatch(/10/)
  })
  it('dayOffset detecta la llegada al día siguiente usando la fecha local de cada ciudad', () => {
    expect(dayOffset(SALE, 'America/Bogota', LLEGA, 'Europe/Madrid')).toBe(1)
    expect(dayOffset('2026-11-10T08:00:00-05:00', 'America/Bogota', '2026-11-10T10:00:00-05:00', 'America/Bogota')).toBe(0)
  })
  it('minutesBetween es independiente de la zona (instantes absolutos)', () => {
    expect(minutesBetween(SALE, LLEGA)).toBe(615)
  })
  it('un instante ausente o inválido no rompe la pantalla (respuestas parciales del backend)', () => {
    expect(formatTime(undefined, 'America/Bogota')).toBe('—')
    expect(formatTime('no-es-fecha', 'America/Bogota')).toBe('—')
    expect(formatDay(null, 'America/Bogota')).toBe('—')
    expect(dayOffset(SALE, 'America/Bogota', undefined, 'Europe/Madrid')).toBe(0)
  })
})

describe('fechas con año y utilidades de hora (módulos F2)', () => {
  it('formatDate / formatDateShort muestran el año en la zona pedida', () => {
    expect(formatDate(SALE, 'America/Bogota')).toMatch(/10 nov 2026/)
    expect(formatDateShort(SALE, 'America/Bogota')).toMatch(/10 nov 2026/)
    expect(formatDateTime(SALE, 'America/Bogota')).toMatch(/10 nov 2026 · 22:10/)
  })

  it('un valor vacío o inválido no rompe la pantalla (campos opcionales)', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDateShort(undefined)).toBe('—')
    expect(formatDateTime('no-es-fecha')).toBe('—')
  })

  it('formatZone devuelve la sigla de la zona', () => {
    expect(formatZone(SALE, 'America/Bogota')).toMatch(/COT|GMT-5/)
    expect(formatZone(null, 'America/Bogota')).toBe('')
  })

  it('todayISO tiene el formato del input date', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('timeToMinutes y minutesToTime son inversas, y rechazan horas inválidas', () => {
    expect(timeToMinutes('08:30')).toBe(510)
    expect(minutesToTime(510)).toBe('08:30')
    expect(timeToMinutes('24:00')).toBeNull()
    expect(timeToMinutes('')).toBeNull()
    expect(minutesToTime(-1)).toBe('')
  })
})
