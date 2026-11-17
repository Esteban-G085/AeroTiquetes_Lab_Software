import {
  evaluarCancelacion, evaluarEdicion, payloadEditarVuelo, payloadVuelo, partesEnZona,
  validarMotivo, validarVuelo, valoresDesdeVuelo,
} from './rules'

const H = 3_600_000
const vuelo = (extra = {}) => ({
  id: 12, codigo: 'AT-204', estado: 'programado', tiquetes_vendidos: 0,
  origen: { codigo: 'BOG' }, destino: { codigo: 'MDE' },
  salida_utc: new Date(Date.now() + 48 * H).toISOString(), duracion_min: 55,
  costo: 250000, costo_primera: 380000, ...extra,
})
const valido = {
  fecha: '2027-03-12', hora: '08:15', origen: 'BOG', destino: 'MDE',
  duracion_min: '55', precio: '250000',
}

describe('fecha y hora en una zona horaria', () => {
  it('convierte el instante a la hora local de la zona', () => {
    expect(partesEnZona('2027-03-12T13:15:00Z', 'America/Bogota')).toEqual({ fecha: '2027-03-12', hora: '08:15' })
    expect(partesEnZona('2027-03-12T13:15:00Z', 'Europe/Madrid')).toEqual({ fecha: '2027-03-12', hora: '14:15' })
  })
  it('cruza la medianoche cuando corresponde', () => {
    expect(partesEnZona('2027-03-12T03:30:00Z', 'America/Bogota')).toEqual({ fecha: '2027-03-11', hora: '22:30' })
  })
  it('el formulario arranca en hora de Colombia y el cuerpo de PUT vuelve a números', () => {
    const v = valoresDesdeVuelo(vuelo({ salida_utc: '2027-03-12T13:15:00Z' }))
    expect(v).toEqual({
      origen: 'BOG', destino: 'MDE', fecha: '2027-03-12', hora: '08:15',
      horas: '0', minutos: '55', costo: '250000', costoPrimera: '380000',
    })
    expect(payloadEditarVuelo(v)).toEqual({
      origen: 'BOG', destino: 'MDE', fecha: '2027-03-12', hora: '08:15',
      duracion_min: 55, precio: 250000, precio_primera: 380000,
    })
  })
  it('un vuelo que sale de Madrid se edita con la hora de Colombia, no con la de su aeropuerto', () => {
    expect(valoresDesdeVuelo(vuelo({ salida_utc: '2027-03-12T13:15:00Z', salida_zona: 'Europe/Madrid' })).hora).toBe('08:15')
  })
  it('acepta las claves antiguas como respaldo (salida, precio)', () => {
    const v = valoresDesdeVuelo({
      salida: '2027-03-12T13:15:00Z', origen: { codigo: 'BOG' }, destino: { codigo: 'MDE' },
      duracion_min: 55, precio: 250000,
    })
    expect(v.costo).toBe('250000')
    expect(v.costoPrimera).toBe('250000')  // sin tarifa de primera: vale la económica
  })
})

describe('PUT /admin/vuelos/{id} (HU12)', () => {
  it('es el mismo cuerpo para payloadVuelo y payloadEditarVuelo: sin tipo ni estado, con precio_primera', () => {
    const cuerpo = {
      origen: 'BOG', destino: 'MDE', fecha: '2027-03-12', hora: '08:15',
      duracion_min: 55, precio: 250000,
    }
    const esperado = { ...cuerpo, precio_primera: 250000 }
    expect(payloadVuelo(cuerpo)).toEqual(esperado)
    expect(payloadEditarVuelo(cuerpo)).toEqual(esperado)
    expect(payloadEditarVuelo(cuerpo)).not.toHaveProperty('estado')
    expect(payloadEditarVuelo(cuerpo)).not.toHaveProperty('tipo')
  })
})

describe('validarVuelo (HU12)', () => {
  it('un vuelo completo es válido', () => {
    expect(validarVuelo(valido)).toEqual({})
  })
  it('exige todos los campos', () => {
    expect(Object.keys(validarVuelo({ fecha: '', hora: '', origen: '', destino: '', duracion_min: '', precio: '' }))).toHaveLength(6)
  })
  it('también entiende los nombres del formulario (horas, minutos, costo)', () => {
    expect(validarVuelo({ fecha: '2027-03-12', hora: '08:15', origen: 'BOG', destino: 'MDE', horas: '1', minutos: '30', costo: '250000' })).toEqual({})
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
  it('un vuelo sucedido, realizado, cancelado o con salida_utc pasada no se puede editar', () => {
    for (const estado of ['sucedido', 'realizado', 'cancelado']) expect(evaluarEdicion(vuelo({ estado })).puede).toBe(false)
    expect(evaluarEdicion(vuelo({ salida_utc: new Date(Date.now() - H).toISOString() })).puede).toBe(false)
  })
})

describe('evaluarCancelacion (HU21)', () => {
  it('sin tiquetes vendidos se cancela sin motivo obligatorio', () => {
    expect(evaluarCancelacion(vuelo())).toEqual({ puede: true, requiereMotivo: false, motivo: null })
  })
  it('con tiquetes vendidos exige registrar una causa de fuerza mayor', () => {
    expect(evaluarCancelacion(vuelo({ tiquetes_vendidos: 2 }))).toMatchObject({ puede: true, requiereMotivo: true })
  })
  it('un vuelo realizado, sucedido, cancelado o con salida_utc pasada no se cancela', () => {
    for (const estado of ['realizado', 'sucedido', 'cancelado']) expect(evaluarCancelacion(vuelo({ estado })).puede).toBe(false)
    expect(evaluarCancelacion(vuelo({ salida_utc: new Date(Date.now() - H).toISOString() })).puede).toBe(false)
  })
  it('valida el motivo: obligatorio solo cuando hay tiquetes vendidos', () => {
    expect(validarMotivo('', false)).toBeNull()
    expect(validarMotivo('', true)).toMatch(/fuerza mayor/)
    expect(validarMotivo('corto', true)).toMatch(/al menos 10/)
    expect(validarMotivo('Cierre del aeropuerto por tormenta', true)).toBeNull()
    expect(validarMotivo('Opcional corto', false)).toBeNull()
  })
})
