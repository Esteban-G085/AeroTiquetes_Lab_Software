import { evaluarCancelacion, evaluarEdicion, partesEnZona, payloadVuelo, validarMotivo, validarVuelo, valoresDesdeVuelo } from './rules'

const H = 3_600_000
const vuelo = (extra = {}) => ({
  id: 12, codigo: 'AT-204', estado: 'programado', tiquetes_vendidos: 0,
  origen: { ciudad: 'Bogotá', codigo: 'BOG' }, destino: { ciudad: 'Medellín', codigo: 'MDE' },
  salida: new Date(Date.now() + 48 * H).toISOString(), salida_zona: 'America/Bogota', duracion_min: 55, precio: 250000, ...extra,
})
const valido = { fecha: '2027-03-12', hora: '08:15', origen: 'BOG', destino: 'MDE', duracion_min: '55', precio: '250000' }

describe('fecha y hora en una zona horaria', () => {
  it('convierte el instante a la hora local de la zona', () => {
    expect(partesEnZona('2027-03-12T13:15:00Z', 'America/Bogota')).toEqual({ fecha: '2027-03-12', hora: '08:15' })
    expect(partesEnZona('2027-03-12T13:15:00Z', 'Europe/Madrid')).toEqual({ fecha: '2027-03-12', hora: '14:15' })
  })
  it('cruza la medianoche cuando corresponde', () => {
    expect(partesEnZona('2027-03-12T03:30:00Z', 'America/Bogota')).toEqual({ fecha: '2027-03-11', hora: '22:30' })
  })
  it('el formulario arranca con los valores del vuelo y el cuerpo vuelve a números', () => {
    const v = valoresDesdeVuelo(vuelo({ salida: '2027-03-12T13:15:00Z' }))
    expect(v).toEqual(valido)
    expect(payloadVuelo(v)).toEqual({ ...valido, duracion_min: 55, precio: 250000 })
  })
})

describe('hora de Colombia al editar (igual que al programar, HU18)', () => {
  it('un vuelo que sale de Madrid se edita con la hora de Colombia, no con la de su aeropuerto', () => {
    const v = valoresDesdeVuelo(vuelo({ salida: '2027-03-12T13:15:00Z', salida_zona: 'Europe/Madrid' }))
    expect(v.hora).toBe('08:15')
  })
})

describe('validarVuelo (HU12)', () => {
  it('un vuelo completo es válido', () => {
    expect(validarVuelo(valido)).toEqual({})
  })
  it('exige todos los campos', () => {
    expect(Object.keys(validarVuelo({ fecha: '', hora: '', origen: '', destino: '', duracion_min: '', precio: '' }))).toHaveLength(6)
  })
  it('el destino debe ser distinto del origen', () => {
    expect(validarVuelo({ ...valido, destino: 'BOG' }).destino).toMatch(/distinto del origen/)
  })
  it('valida hora, duración y costo', () => {
    const e = validarVuelo({ ...valido, hora: '25:00', duracion_min: '5', precio: '-3' })
    expect(e.hora).toBeTruthy()
    expect(e.duracion_min).toMatch(/entre 10 y 1440/)
    expect(e.precio).toBeTruthy()
    expect(validarVuelo({ ...valido, precio: '0' }).precio).toBeTruthy()
    expect(validarVuelo({ ...valido, precio: '100000001' }).precio).toMatch(/máximo/)
  })
})

describe('evaluarEdicion (HU20: no sucedido, sin tiquetes vendidos, no realizado)', () => {
  it('un vuelo programado sin tiquetes se puede editar', () => {
    expect(evaluarEdicion(vuelo())).toEqual({ puede: true, motivo: null })
  })
  it('con tiquetes vendidos no se puede y se dice cuántos', () => {
    const r = evaluarEdicion(vuelo({ tiquetes_vendidos: 3 }))
    expect(r.puede).toBe(false)
    expect(r.motivo).toMatch(/3 tiquetes vendidos/)
  })
  it('un vuelo sucedido, realizado, cancelado o con salida pasada no se puede editar', () => {
    for (const estado of ['sucedido', 'realizado', 'cancelado']) expect(evaluarEdicion(vuelo({ estado })).puede).toBe(false)
    expect(evaluarEdicion(vuelo({ salida: new Date(Date.now() - H).toISOString() })).puede).toBe(false)
  })
})

describe('evaluarCancelacion (HU21)', () => {
  it('sin tiquetes vendidos se cancela sin motivo obligatorio', () => {
    expect(evaluarCancelacion(vuelo())).toEqual({ puede: true, requiereMotivo: false, motivo: null })
  })
  it('con tiquetes vendidos exige registrar una causa de fuerza mayor', () => {
    expect(evaluarCancelacion(vuelo({ tiquetes_vendidos: 2 }))).toMatchObject({ puede: true, requiereMotivo: true })
  })
  it('un vuelo realizado, sucedido o ya cancelado no se cancela', () => {
    for (const estado of ['realizado', 'sucedido', 'cancelado']) expect(evaluarCancelacion(vuelo({ estado })).puede).toBe(false)
  })
  it('valida el motivo: obligatorio solo cuando hay tiquetes vendidos', () => {
    expect(validarMotivo('', false)).toBeNull()
    expect(validarMotivo('', true)).toMatch(/fuerza mayor/)
    expect(validarMotivo('corto', true)).toMatch(/al menos 10/)
    expect(validarMotivo('Cierre del aeropuerto por tormenta', true)).toBeNull()
  })
})
