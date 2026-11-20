import {
  MAX_TIQUETES_VUELO, VIAJERO_VACIO, cupoRestante, datosViajeroDesdePerfil, edadEn, esMayorDeEdad,
  msRestantesReserva, normalizarDocumento, puedeCancelarCompra, reservaVigente, validarViajero, validarViajeros,
} from './rules'

const SALIDA = '2027-03-12T13:15:00Z'
const HOY = '2026-11-06'
const adulto = (doc, extra = {}) => ({
  documento: doc, nombres: 'Ana María', apellidos: 'Gómez', fecha_nacimiento: '1990-04-20', genero: 'femenino',
  telefono: '3001234567', correo: 'ana@correo.com', contacto_nombre: 'Luis Gómez', contacto_telefono: '3007654321', ...extra,
})
const opts = { salidaIso: SALIDA, hoy: HOY }

describe('edad y mayoría de edad (RF19: 18 años)', () => {
  it('calcula la edad cumplida en la fecha del vuelo', () => {
    expect(edadEn('2000-03-13', SALIDA)).toBe(26)  // cumple al día siguiente del vuelo
    expect(edadEn('2000-03-12', SALIDA)).toBe(27)  // cumple el mismo día
  })
  it('18 años cumplidos el día del vuelo ya es mayor de edad', () => {
    expect(esMayorDeEdad('2009-03-12', SALIDA)).toBe(true)
    expect(esMayorDeEdad('2009-03-13', SALIDA)).toBe(false)
  })
})

describe('autocompletado desde el perfil (RF06)', () => {
  it('normaliza espacios, puntos y guiones al comparar documentos', () => {
    expect(normalizarDocumento(' 11.111-aa ')).toBe('11111AA')
  })

  it('copia los datos del perfil y compone el contacto a partir de nombres y apellidos', () => {
    const perfil = {
      dni: '1.111.1', nombres: 'María José', apellidos: 'Gómez Ríos', fecha_nacimiento: '1998-05-10',
      genero: 'femenino', correo: 'usuario@123.com', telefono: '3001112233',
    }
    const viajero = datosViajeroDesdePerfil(perfil, { ...VIAJERO_VACIO, contacto_nombre: 'Otro contacto' })
    expect(viajero).toMatchObject({
      documento: '11111', nombres: 'María José', apellidos: 'Gómez Ríos', fecha_nacimiento: '1998-05-10',
      genero: 'femenino', correo: 'usuario@123.com', telefono: '3001112233',
      contacto_nombre: 'María José Gómez Ríos', contacto_telefono: '3001112233',
    })
    expect(datosViajeroDesdePerfil(null, { ...VIAJERO_VACIO })).toEqual({ ...VIAJERO_VACIO })
  })
})

describe('validarViajero (RF06: todos los datos son obligatorios)', () => {
  it('un viajero vacío marca los 9 campos', () => {
    expect(Object.keys(validarViajero({ ...VIAJERO_VACIO }, { hoy: HOY }))).toHaveLength(9)
  })
  it('un viajero completo no tiene errores', () => {
    expect(validarViajero(adulto('A12345'), { hoy: HOY })).toEqual({})
  })
  it('rechaza correo, teléfono, documento y fecha de nacimiento inválidos', () => {
    const e = validarViajero(adulto('1', { correo: 'ana@', telefono: '12', fecha_nacimiento: '2999-01-01', contacto_telefono: 'abc' }), { hoy: HOY })
    expect(e.documento).toBeTruthy()
    expect(e.correo).toBeTruthy()
    expect(e.telefono).toBeTruthy()
    expect(e.contacto_telefono).toBeTruthy()
    expect(e.fecha_nacimiento).toMatch(/futura/)
  })
})

describe('validarViajeros (reglas por vuelo)', () => {
  it('acepta una lista válida', () => {
    expect(validarViajeros([adulto('A12345'), adulto('B67890')], opts).ok).toBe(true)
  })
  it('RF09: no permite repetir un documento dentro del mismo vuelo', () => {
    const r = validarViajeros([adulto('A12345'), adulto('a12345')], opts)
    expect(r.ok).toBe(false)
    expect(r.porViajero[1].documento).toMatch(/ya está/)
  })
  it('RF18: un menor no puede ser el único viajero', () => {
    const menor = adulto('M11111', { fecha_nacimiento: '2015-01-01' })
    const r = validarViajeros([menor], opts)
    expect(r.ok).toBe(false)
    expect(r.general[0]).toMatch(/menor de edad/)
  })
  it('RF18: un menor puede viajar si hay un mayor de edad en el mismo vuelo', () => {
    const menor = adulto('M11111', { fecha_nacimiento: '2015-01-01' })
    expect(validarViajeros([adulto('A12345'), menor], opts).ok).toBe(true)
  })
  it('RF05: máximo 5 tiquetes por vuelo, descontando los que el cliente ya tiene', () => {
    expect(MAX_TIQUETES_VUELO).toBe(5)
    expect(cupoRestante(0)).toBe(5)
    expect(cupoRestante(4)).toBe(1)
    expect(cupoRestante(9)).toBe(0)
    const dos = [adulto('A12345'), adulto('B67890')]
    const r = validarViajeros(dos, { ...opts, tiquetesCliente: 4 })
    expect(r.ok).toBe(false)
    expect(r.general[0]).toMatch(/1 tiquete más/)
    expect(validarViajeros(dos, { ...opts, tiquetesCliente: 5 }).general[0]).toMatch(/máximo por cliente/)
  })
})

describe('tiempos de reservas y cancelaciones', () => {
  const salida = Date.parse(SALIDA)
  it('RF15: se puede cancelar una compra hasta 1 hora antes del vuelo', () => {
    expect(puedeCancelarCompra(SALIDA, salida - 61 * 60_000)).toBe(true)
    expect(puedeCancelarCompra(SALIDA, salida - 60 * 60_000)).toBe(true)
    expect(puedeCancelarCompra(SALIDA, salida - 59 * 60_000)).toBe(false)
  })
  it('RF04/RF16: una reserva solo está vigente hasta su vencimiento', () => {
    const expira = '2026-11-07T10:00:00Z'
    const antes = Date.parse('2026-11-06T10:00:00Z')
    expect(msRestantesReserva(expira, antes)).toBe(24 * 3_600_000)
    expect(reservaVigente(expira, antes)).toBe(true)
    expect(reservaVigente(expira, Date.parse(expira))).toBe(false)
  })
})
