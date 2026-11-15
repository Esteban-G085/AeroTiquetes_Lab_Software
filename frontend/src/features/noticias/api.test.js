import { http } from '@/services/http'
import { cancelarSuscripcion, listarNoticias, obtenerSuscripcion, suscribirse } from './api'

let seen
const reply = (data, status = 200) => {
  http.defaults.adapter = async (config) => { seen = config; return { status, data, headers: {}, config } }
}

describe('API de noticias (HU11) contra el contrato del backend', () => {
  it('listarNoticias -> GET /noticias y lee { items }', async () => {
    reply({ items: [{ id: 1, vuelo_id: 7 }] })
    await expect(listarNoticias()).resolves.toEqual([{ id: 1, vuelo_id: 7 }])
    expect(seen.url).toBe('/noticias')
  })

  it('obtenerSuscripcion -> GET /noticias/suscripcion', async () => {
    reply({ suscrito: false, correo: 'ana@correo.com' })
    await expect(obtenerSuscripcion()).resolves.toEqual({ suscrito: false, correo: 'ana@correo.com' })
    expect(seen.url).toBe('/noticias/suscripcion')
  })

  it('suscribirse -> PUT con el correo sin espacios', async () => {
    reply({ suscrito: true, correo: 'ana@correo.com' })
    await suscribirse('  ana@correo.com ')
    expect(seen.method).toBe('put')
    expect(JSON.parse(seen.data)).toEqual({ correo: 'ana@correo.com' })
  })

  it('cancelarSuscripcion -> DELETE /noticias/suscripcion', async () => {
    reply(null, 204)
    await cancelarSuscripcion()
    expect(seen.method).toBe('delete')
    expect(seen.url).toBe('/noticias/suscripcion')
  })
})
