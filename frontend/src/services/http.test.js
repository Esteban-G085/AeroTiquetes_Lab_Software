import { AxiosError } from 'axios'
import { http, setUnauthorizedHandler } from './http'
import { ApiError } from './apiError'
import { tokenStorage } from './tokenStorage'

/** Reemplaza el adaptador de red: responde lo que cada test necesite. */
function mockNetwork(status, data, capture) {
  http.defaults.adapter = async (config) => {
    capture?.(config)
    if (status < 400) return { status, data, headers: {}, config }
    throw new AxiosError('fail', 'ERR_BAD_REQUEST', config, null, { status, data, headers: {}, config })
  }
}

afterEach(() => setUnauthorizedHandler(null))

describe('http (Axios)', () => {
  it('agrega Authorization: Bearer cuando hay token', async () => {
    tokenStorage.set('abc', {})
    let seen
    mockNetwork(200, {}, (c) => { seen = c.headers.Authorization })
    await http.get('/me')
    expect(seen).toBe('Bearer abc')
  })

  it('no envía Authorization sin sesión', async () => {
    let seen
    mockNetwork(200, {}, (c) => { seen = c.headers.Authorization })
    await http.get('/vuelos')
    expect(seen).toBeUndefined()
  })

  it('401 CON token avisa a la sesión', async () => {
    tokenStorage.set('abc', {})
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    mockNetwork(401, { error: { code: 'TOKEN_EXPIRED', message: 'x' } })
    await expect(http.get('/me')).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('401 SIN token (login fallido) no cierra sesión ni dispara el handler', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    mockNetwork(401, { error: { code: 'CREDENCIALES', message: 'Credenciales inválidas', fields: {} } })
    await expect(http.post('/auth/login', {})).rejects.toMatchObject({ status: 401, message: 'Credenciales inválidas' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('normaliza el formato { error: { code, message, fields } }', async () => {
    mockNetwork(409, { error: { code: 'DUPLICADO', message: 'Datos repetidos', fields: { correo: 'Ya registrado' } } })
    await expect(http.post('/auth/registro', {})).rejects.toMatchObject({
      status: 409, code: 'DUPLICADO', fields: { correo: 'Ya registrado' },
    })
  })

  it('entiende el 422 nativo de FastAPI como respaldo', async () => {
    mockNetwork(422, { detail: [{ loc: ['body', 'correo'], msg: 'correo inválido' }] })
    await expect(http.post('/auth/registro', {})).rejects.toMatchObject({ fields: { correo: 'correo inválido' } })
  })

  it('error de red -> NETWORK_ERROR con mensaje legible', async () => {
    http.defaults.adapter = async (config) => { throw new AxiosError('Network Error', 'ERR_NETWORK', config) }
    await expect(http.get('/vuelos')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })
})
