import { cuposDisponibles, cuposTotales, disponibilidadTexto } from './vuelo'

describe('lectura de cupos de un vuelo (D13)', () => {
  it('suma las dos clases', () => {
    expect(cuposTotales({ cupos_economica: 125, cupos_primera: 25 })).toBe(150)
    expect(cuposTotales({})).toBe(0)
    expect(cuposTotales(null)).toBe(0)
  })

  it('un vuelo sin cupos sigue existiendo: solo se advierte', () => {
    expect(cuposDisponibles({ cupos_economica: 0, cupos_primera: 0 })).toBe(false)
    expect(cuposDisponibles({ cupos_economica: 1, cupos_primera: 0 })).toBe(true)
  })

  it('describe la disponibilidad por clase (incluida la clase agotada)', () => {
    expect(disponibilidadTexto({ cupos_economica: 125, cupos_primera: 0 })).toBe('Económica: 125 · Primera: 0')
    expect(disponibilidadTexto({})).toBe('Sin cupos disponibles')
  })
})
