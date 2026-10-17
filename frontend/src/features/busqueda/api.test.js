import { http } from '@/services/http'
import { buscarVuelos, obtenerVuelo, FILTROS_VACIOS } from './api'

let seen
const reply = (data, status = 200) => {
  http.defaults.adapter = async (config) => { seen = config; return { status, data, headers: {}, config } }
}

describe('API de búsqueda (HU5)', () => {
  it('GET /vuelos sin criterios vacíos', async () => {
    reply({ total: 3, items: [{ id: 1 }] })
    await expect(buscarVuelos({ ...FILTROS_VACIOS, origen: '', clase: '' })).resolves.toEqual({ total: 3, items: [{ id: 1 }] })
    expect(seen.method).toBe('get')
    expect(seen.url).toBe('/vuelos')
    expect(seen.params).toEqual({ orden: 'fecha_asc' })
  })

  it('envía solo los criterios usados, con los nombres del plan', async () => {
    reply({ total: 0, items: [] })
    await buscarVuelos({ origen: 'BOG', destino: 'MDE', fecha: '2030-01-15', precioMin: 100000, precioMax: 300000, duracionMax: 120, clase: 'economica', orden: 'precio_asc' })
    expect(seen.params).toEqual({
      origen: 'BOG', destino: 'MDE', fecha: '2030-01-15',
      precioMin: 100000, precioMax: 300000, duracionMax: 120,
      clase: 'economica', orden: 'precio_asc',
    })
  })

  it('acepta un arreglo plano y calcula el total', async () => {
    reply([{ id: 1 }, { id: 2 }])
    await expect(buscarVuelos()).resolves.toEqual({ total: 2, items: [{ id: 1 }, { id: 2 }] })
  })

  it('obtenerVuelo -> GET /vuelos/{id}', async () => {
    reply({ id: 7, codigo: 'AT-0007' })
    await expect(obtenerVuelo(7)).resolves.toEqual({ id: 7, codigo: 'AT-0007' })
    expect(seen.method).toBe('get')
    expect(seen.url).toBe('/vuelos/7')
  })
})
