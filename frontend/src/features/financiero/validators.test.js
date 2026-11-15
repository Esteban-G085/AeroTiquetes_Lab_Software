import { parseMonto, validarMonto, validarTarjeta, vencimientoVigente, normalizarVencimiento } from './validators'

const AHORA = new Date('2026-11-06T12:00:00')
const tarjeta = (extra = {}) => ({ tipo: 'credito', numero: '4111 1111 1111 1111', titular: 'María José Gómez', vencimiento: '12/29', codigo: '123', ...extra })

describe('montos de la billetera', () => {
  it('interpreta montos escritos con puntos', () => {
    expect(parseMonto('1.500.000')).toBe(1500000)
    expect(Number.isNaN(parseMonto('abc'))).toBe(true)
  })
  it('agregar saldo exige un monto mayor a 0 y establecer saldo acepta 0', () => {
    expect(validarMonto('')).toMatch(/obligatorio/)
    expect(validarMonto('0')).toMatch(/mayor a 0/)
    expect(validarMonto('0', { permitirCero: true })).toBeNull()
    expect(validarMonto('50000')).toBeNull()
  })
  it('limita el monto por operación', () => {
    expect(validarMonto('100000001')).toMatch(/máximo/)
  })
})

describe('tarjetas (SRS 3.2.6 RF04–RF08)', () => {
  it('una tarjeta completa es válida', () => {
    expect(validarTarjeta(tarjeta(), AHORA)).toEqual({})
  })
  it('exige todos los campos', () => {
    expect(Object.keys(validarTarjeta({ tipo: '', numero: '', titular: '', vencimiento: '', codigo: '' }, AHORA))).toHaveLength(5)
  })
  it('valida número (13–19 dígitos), código (3–4) y tipo', () => {
    const e = validarTarjeta(tarjeta({ numero: '1234', codigo: '12', tipo: 'otra' }), AHORA)
    expect(e.numero).toBeTruthy()
    expect(e.codigo).toBeTruthy()
    expect(e.tipo).toBeTruthy()
  })
  it('el mes de vencimiento actual todavía es válido; uno anterior no', () => {
    expect(vencimientoVigente('11/26', AHORA)).toBe(true)
    expect(vencimientoVigente('10/26', AHORA)).toBe(false)
    expect(vencimientoVigente('13/30', AHORA)).toBe(false)
    expect(vencimientoVigente('1230', AHORA)).toBe(true)
  })
  it('normaliza el vencimiento a MM/AA', () => {
    expect(normalizarVencimiento('1229')).toBe('12/29')
    expect(normalizarVencimiento('12 / 29')).toBe('12/29')
  })
})
