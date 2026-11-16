import { http } from '@/services/http'
import { ApiError } from '@/services/apiError'
import {
  actualizarTarjeta, adaptarTarjeta, agregarSaldo, crearTarjeta, eliminarTarjeta, establecerSaldo, listarTarjetas, obtenerBilletera,
} from './api'

vi.mock('@/services/http', () => ({ http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const TARJETA_API = {
  id: 4, tipo: 'credito', titular: 'Ana Gómez', fecha_expiracion: '12/2030', ultimos4: '1234', numero_enmascarado: '**** **** **** 1234',
}
const FORM = { tipo: 'credito', numero: '4111 1111 1111 1234', titular: ' Ana Gómez ', vencimiento: '12/30', codigo: '123' }

beforeEach(() => vi.resetAllMocks())

describe('billetera', () => {
  it('obtenerBilletera añade la moneda que esperan las pantallas', async () => {
    http.get.mockResolvedValue({ data: { saldo: 250000 } })
    expect(await obtenerBilletera()).toEqual({ saldo: 250000, moneda: 'COP' })
    expect(http.get).toHaveBeenCalledWith('/mi-billetera')
  })

  it('agregarSaldo suma y establecerSaldo reemplaza', async () => {
    http.post.mockResolvedValue({ data: { saldo: 750000 } })
    http.put.mockResolvedValue({ data: { saldo: 300000 } })
    expect((await agregarSaldo(500000)).saldo).toBe(750000)
    expect(http.post).toHaveBeenCalledWith('/mi-billetera/agregar-saldo', { monto: 500000 })
    expect((await establecerSaldo(300000)).saldo).toBe(300000)
    expect(http.put).toHaveBeenCalledWith('/mi-billetera', { saldo: 300000 })
  })
})

describe('tarjetas', () => {
  it('la tarjeta del backend se muestra con sus últimos 4 dígitos y el vencimiento corto', () => {
    expect(adaptarTarjeta(TARJETA_API)).toEqual({ id: 4, tipo: 'credito', numero: '1234', titular: 'Ana Gómez', vencimiento: '12/30' })
  })

  it('listarTarjetas lee { items }', async () => {
    http.get.mockResolvedValue({ data: { items: [TARJETA_API] } })
    expect(await listarTarjetas()).toHaveLength(1)
    expect(http.get).toHaveBeenCalledWith('/mi-billetera/tarjetas')
  })

  it('crearTarjeta envía el número limpio y el vencimiento como fecha_expiracion', async () => {
    http.post.mockResolvedValue({ data: TARJETA_API })
    await crearTarjeta(FORM)
    expect(http.post).toHaveBeenCalledWith('/mi-billetera/tarjetas', {
      tipo: 'credito', numero: '4111111111111234', titular: 'Ana Gómez', fecha_expiracion: '12/30', codigo: '123',
    })
  })

  it('al editar sin volver a escribir el número completo, no lo envía', async () => {
    http.put.mockResolvedValue({ data: TARJETA_API })
    await actualizarTarjeta(4, { ...FORM, numero: '1234' })
    const [ruta, cuerpo] = http.put.mock.calls[0]
    expect(ruta).toBe('/mi-billetera/tarjetas/4')
    expect(cuerpo).not.toHaveProperty('numero')
  })

  it('el error de fecha_expiracion se pinta en el campo vencimiento', async () => {
    http.post.mockRejectedValue(new ApiError({ status: 422, code: 'validacion', message: 'x', fields: { fecha_expiracion: 'Vencida' } }))
    await expect(crearTarjeta(FORM)).rejects.toMatchObject({ fields: { vencimiento: 'Vencida' } })
  })

  it('eliminarTarjeta llama a DELETE', async () => {
    http.delete.mockResolvedValue({})
    await eliminarTarjeta(4)
    expect(http.delete).toHaveBeenCalledWith('/mi-billetera/tarjetas/4')
  })
})
