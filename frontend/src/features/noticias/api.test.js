import { http } from '@/services/http'
import { listarNoticias, suscribirseNoticias, cancelarSuscripcionNoticias } from './api'

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

  it('suscribirseNoticias -> POST /noticias/suscribirse', async () => {
    reply({ suscrito: true }, 201)
    await expect(suscribirseNoticias()).resolves.toEqual({ suscrito: true })
    expect(seen.method).toBe('post')
    expect(seen.url).toBe('/noticias/suscribirse')
  })

  it('cancelarSuscripcionNoticias -> DELETE /noticias/suscribirse', async () => {
    reply({ suscrito: false }, 200)
    await expect(cancelarSuscripcionNoticias()).resolves.toEqual({ suscrito: false })
    expect(seen.method).toBe('delete')
    expect(seen.url).toBe('/noticias/suscribirse')
  })
})
