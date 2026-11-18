import { http } from '@/services/http'
import {
  listarNoticias,
  obtenerNoticia,
  estadoSuscripcion,
  suscribirseNoticias,
  cancelarSuscripcionNoticias,
  cancelarConToken,
  crearNoticia,
  eliminarNoticia,
} from './api'

let seen
const reply = (data, status = 200) => {
  http.defaults.adapter = async (config) => { seen = config; return { status, data, headers: {}, config } }
}

describe('API de noticias (HU11)', () => {
  it('listarNoticias -> GET /noticias', async () => {
    reply({ total: 2, pagina: 1, tamano: 50, items: [{ id: 1, titulo: 'Nueva ruta Bogotá-Madrid' }] })
    await expect(listarNoticias()).resolves.toEqual({
      total: 2,
      pagina: 1,
      tamano: 50,
      items: [{ id: 1, titulo: 'Nueva ruta Bogotá-Madrid' }],
    })
    expect(seen.method).toBe('get')
    expect(seen.url).toBe('/noticias')
  })

  it('listarNoticias envía pagina y tamano como query params', async () => {
    reply({ total: 9, pagina: 2, tamano: 3, items: [{ id: 4, titulo: 'Tercera página' }] })
    await expect(listarNoticias({ pagina: 2, tamano: 3 })).resolves.toEqual({
      total: 9,
      pagina: 2,
      tamano: 3,
      items: [{ id: 4, titulo: 'Tercera página' }],
    })
    expect(seen.params).toEqual({ pagina: 2, tamano: 3 })
  })

  it('obtenerNoticia -> GET /noticias/{id}', async () => {
    reply({ id: 7, titulo: 'Nuevo vuelo Bogotá → Medellín' }, 200)
    await expect(obtenerNoticia(7)).resolves.toEqual({ id: 7, titulo: 'Nuevo vuelo Bogotá → Medellín' })
    expect(seen.method).toBe('get')
    expect(seen.url).toBe('/noticias/7')
  })

  it('estadoSuscripcion -> GET /noticias/suscripcion', async () => {
    reply({ suscrito: true, correo: 'ana@correo.com' })
    await expect(estadoSuscripcion()).resolves.toEqual({ suscrito: true, correo: 'ana@correo.com' })
    expect(seen.method).toBe('get')
    expect(seen.url).toBe('/noticias/suscripcion')
  })

  it('suscribirseNoticias -> PUT /noticias/suscripcion con { correo }', async () => {
    reply({ suscrito: true, correo: 'ana@correo.com' }, 200)
    await expect(suscribirseNoticias('ana@correo.com')).resolves.toEqual({ suscrito: true, correo: 'ana@correo.com' })
    expect(seen.method).toBe('put')
    expect(seen.url).toBe('/noticias/suscripcion')
    expect(JSON.parse(seen.data)).toEqual({ correo: 'ana@correo.com' })
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

  it('crearNoticia -> POST /admin/noticias', async () => {
    reply({ id: 9, titulo: 'Aviso' }, 201)
    await expect(crearNoticia({ titulo: 'Aviso', contenido: 'Texto' })).resolves.toEqual({ id: 9, titulo: 'Aviso' })
    expect(seen.method).toBe('post')
    expect(seen.url).toBe('/admin/noticias')
  })

  it('eliminarNoticia -> DELETE /admin/noticias/{id} (borrado lógico)', async () => {
    reply(undefined, 204)
    await expect(eliminarNoticia(7)).resolves.toBeUndefined()
    expect(seen.method).toBe('delete')
    expect(seen.url).toBe('/admin/noticias/7')
  })
})
