import { http } from '@/services/http'
import {
  listarNoticias,
  obtenerNoticia,
  estadoSuscripcion,
  suscribirseNoticias,
  cancelarSuscripcionNoticias,
  cancelarConToken,
} from './api'

let seen
const reply = (data, status = 200) => {
  http.defaults.adapter = async (config) => { seen = config; return { status, data, headers: {}, config } }
}

describe('API de noticias (HU11)', () => {
  it('listarNoticias -> GET /noticias', async () => {
    reply({ total: 2, items: [{ id: 1, titulo: 'Nueva ruta Bogotá-Madrid' }] })
    await expect(listarNoticias()).resolves.toEqual({
      total: 2,
      items: [{ id: 1, titulo: 'Nueva ruta Bogotá-Madrid' }],
    })
    expect(seen.method).toBe('get')
    expect(seen.url).toBe('/noticias')
  })

  it('obtenerNoticia -> GET /noticias/{id}', async () => {
    reply({ id: 7, titulo: 'Nuevo vuelo Bogotá → Medellín' }, 200)
    await expect(obtenerNoticia(7)).resolves.toEqual({ id: 7, titulo: 'Nuevo vuelo Bogotá → Medellín' })
    expect(seen.method).toBe('get')
    expect(seen.url).toBe('/noticias/7')
  })

  it('estadoSuscripcion -> GET /noticias/suscripcion', async () => {
    reply({ suscrito: true, desde: '2026-11-10T10:00:00Z' })
    await expect(estadoSuscripcion()).resolves.toEqual({ suscrito: true, desde: '2026-11-10T10:00:00Z' })
    expect(seen.method).toBe('get')
    expect(seen.url).toBe('/noticias/suscripcion')
  })

  it('suscribirseNoticias -> POST /noticias/suscripcion', async () => {
    reply({ suscrito: true }, 201)
    await expect(suscribirseNoticias()).resolves.toEqual({ suscrito: true })
    expect(seen.method).toBe('post')
    expect(seen.url).toBe('/noticias/suscripcion')
  })

  it('cancelarSuscripcionNoticias -> DELETE /noticias/suscripcion', async () => {
    reply({ suscrito: false }, 200)
    await expect(cancelarSuscripcionNoticias()).resolves.toEqual({ suscrito: false })
    expect(seen.method).toBe('delete')
    expect(seen.url).toBe('/noticias/suscripcion')
  })

  it('cancelarConToken -> POST /noticias/suscripcion/cancelar', async () => {
    reply({ suscrito: false }, 200)
    await expect(cancelarConToken('abc123token')).resolves.toEqual({ suscrito: false })
    expect(seen.method).toBe('post')
    expect(seen.url).toBe('/noticias/suscripcion/cancelar')
    expect(JSON.parse(seen.data)).toEqual({ token: 'abc123token' })
  })
})
