import { http } from '@/services/http'
import { crearVuelo, listarVuelos, obtenerVueloAdmin } from './api'

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
