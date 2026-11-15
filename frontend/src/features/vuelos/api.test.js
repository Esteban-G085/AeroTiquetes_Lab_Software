import { http } from '@/services/http'
import { cancelarVuelo, crearVuelo, editarVuelo, listarCiudades, listarVuelos, listarVuelosRealizados, obtenerVuelo, obtenerVueloAdmin } from './api'

let seen
const reply = (data, status = 200) => {
  http.defaults.adapter = async (config) => { seen = config; return { status, data, headers: {}, config } }
}

describe('API de administración de vuelos (HU18, HU19)', () => {
  it('listarVuelos -> GET /admin/vuelos con los filtros usados', async () => {
    reply({ total: 1, items: [{ id: 1 }] })
    await expect(listarVuelos({ estado: 'cancelado', origen: '', destino: '' })).resolves.toEqual({ total: 1, items: [{ id: 1 }] })
    expect(seen.method).toBe('get')
    expect(seen.url).toBe('/admin/vuelos')
    expect(seen.params).toEqual({ estado: 'cancelado' })
  })

  it('crearVuelo -> POST /admin/vuelos con el payload del plan', async () => {
    reply({ id: 9, codigo: 'AT-0009' }, 201)
    const payload = { tipo: 'nacional', origen: 'BOG', destino: 'MDE', fecha: '2030-01-15', hora: '08:00', duracion: 90, costo: 300000 }
    await expect(crearVuelo(payload)).resolves.toEqual({ id: 9, codigo: 'AT-0009' })
    expect(seen.method).toBe('post')
    expect(seen.url).toBe('/admin/vuelos')
    expect(JSON.parse(seen.data)).toEqual(payload)
  })

  it('obtenerVueloAdmin -> GET /admin/vuelos/{id}', async () => {
    reply({ id: 9 })
    await obtenerVueloAdmin(9)
    expect(seen.url).toBe('/admin/vuelos/9')
  })
})

const DEL_BACKEND = {
  id: 12, codigo: 'AT-0012', tipo: 'nacional', estado: 'programado',
  origen: { codigo: 'BOG', nombre: 'Bogotá', zona_horaria: 'America/Bogota' },
  destino: { codigo: 'MAD', nombre: 'Madrid', zona_horaria: 'Europe/Madrid' },
  salida_utc: '2027-03-12T13:15:00Z', llegada_utc: '2027-03-12T14:10:00Z', duracion_min: 55, costo: 250000, tiquetes_vendidos: 3,
}
const PARA_PANTALLAS = {
  id: 12, codigo: 'AT-0012', tipo: 'nacional', estado: 'programado',
  origen: { ciudad: 'Bogotá', codigo: 'BOG' }, destino: { ciudad: 'Madrid', codigo: 'MAD' },
  salida: '2027-03-12T13:15:00Z', llegada: '2027-03-12T14:10:00Z', salida_zona: 'America/Bogota', llegada_zona: 'Europe/Madrid',
  duracion_min: 55, precio: 250000, moneda: 'COP', tiquetes_vendidos: 3,
}

describe('Gestión del vuelo (HU12, HU13, HU14): traducción a la forma de las pantallas', () => {
  it('obtenerVuelo traduce salida_utc/costo/nombre y trae los tiquetes vendidos', async () => {
    reply(DEL_BACKEND)
    await expect(obtenerVuelo(12)).resolves.toEqual(PARA_PANTALLAS)
    expect(seen.url).toBe('/admin/vuelos/12')
  })

  it('listarCiudades -> GET /ciudades como { codigo, ciudad }', async () => {
    reply({ items: [{ codigo: 'BOG', nombre: 'Bogotá', pais: 'Colombia' }] })
    await expect(listarCiudades()).resolves.toEqual([{ codigo: 'BOG', ciudad: 'Bogotá' }])
  })

  it('editarVuelo -> PUT /admin/vuelos/{id} con números y los nombres del contrato', async () => {
    reply(DEL_BACKEND)
    await editarVuelo(12, { fecha: '2027-03-12', hora: '08:15', origen: 'BOG', destino: 'MAD', duracion_min: '55', precio: '250000' })
    expect(seen.method).toBe('put')
    expect(seen.url).toBe('/admin/vuelos/12')
    expect(JSON.parse(seen.data)).toEqual({ fecha: '2027-03-12', hora: '08:15', origen: 'BOG', destino: 'MAD', duracion_min: 55, precio: 250000 })
  })

  it('cancelarVuelo -> PATCH /admin/vuelos/{id}/cancelar; sin causa envía motivo nulo', async () => {
    reply({ ...DEL_BACKEND, estado: 'cancelado' })
    await expect(cancelarVuelo(12, '  ')).resolves.toMatchObject({ estado: 'cancelado' })
    expect(seen.method).toBe('patch')
    expect(seen.url).toBe('/admin/vuelos/12/cancelar')
    expect(JSON.parse(seen.data)).toEqual({ motivo: null })
    await cancelarVuelo(12, ' Cierre del aeropuerto ')
    expect(JSON.parse(seen.data)).toEqual({ motivo: 'Cierre del aeropuerto' })
  })

  it('listarVuelosRealizados -> GET /admin/vuelos/realizados', async () => {
    reply({ total: 1, items: [{ ...DEL_BACKEND, estado: 'realizado' }] })
    await expect(listarVuelosRealizados()).resolves.toEqual([{ ...PARA_PANTALLAS, estado: 'realizado' }])
    expect(seen.url).toBe('/admin/vuelos/realizados')
  })
})
