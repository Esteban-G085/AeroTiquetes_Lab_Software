import { http } from '@/services/http'
import { ApiError } from '@/services/apiError'
import {
  adaptarError, adaptarVuelo, agruparOperacion, cancelarCompra, cancelarReserva, crearCompra, crearReserva,
  listarVuelosRegreso, obtenerHistorial, obtenerVuelo, pagarReserva,
} from './api'

vi.mock('@/services/http', () => ({ http: { get: vi.fn(), post: vi.fn() } }))

// ---- Respuestas con la forma REAL del backend de B1 (docs/CONTRATO_COMPRAS.md) ----
const CIUDAD = (codigo, nombre) => ({ codigo, nombre, pais: 'Colombia', zona_horaria: 'America/Bogota' })
const VUELO_B2 = {
  id: 7, codigo: 'AT-0007', tipo: 'nacional', estado: 'programado', origen: CIUDAD('BOG', 'Bogotá'), destino: CIUDAD('MDE', 'Medellín'),
  salida_utc: '2026-12-01T13:00:00Z', llegada_utc: '2026-12-01T14:05:00Z', duracion_min: 65, costo: 300000,
  cupos_economica: 100, cupos_primera: 20, fecha_programacion: '2026-11-01T00:00:00Z',
}
const RESUMEN = (id, estado = 'programado') => ({
  id, codigo: `AT-000${id}`, tipo: 'nacional', estado, origen: CIUDAD('BOG', 'Bogotá'), destino: CIUDAD('MDE', 'Medellín'),
  salida_utc: '2026-12-01T13:00:00Z', llegada_utc: '2026-12-01T14:05:00Z',
})
const TIQUETE = (id, vueloId, over = {}) => ({
  id, codigo_reserva: `COD${id}`, estado: 'comprado', clase: 'economica', trayecto: 'unico', numero_silla: 14, precio: 300000,
  vuelo: RESUMEN(vueloId), viajero: { documento: `DOC${id}`, nombres: 'Ana', apellidos: 'Gómez', correo: `ana${id}@correo.com` }, ...over,
})
const OPERACION = (over = {}) => ({
  tipo: 'compra', id: 9, estado: 'pagada', creada_en: '2026-11-11T15:00:00Z', expira_en: null, total: 900000, id_reserva: null,
  tiquetes: [TIQUETE(1, 7), TIQUETE(2, 7), TIQUETE(3, 8)], ...over,
})
const VIAJERO = {
  documento: 'A-123 45', nombres: 'Ana', apellidos: 'Gómez', fecha_nacimiento: '1990-04-20', genero: 'femenino',
  telefono: '3001234567', correo: 'ana@correo.com', contacto_nombre: ' Luis ', contacto_telefono: '3007654321',
}
const ITEM = (vueloId = 7, viajeros = [VIAJERO]) => ({ vuelo: { id: vueloId }, clase: 'economica', viajeros })

beforeEach(() => {
  vi.resetAllMocks()
  http.get.mockImplementation(async (url) => {
    if (url === '/mi-billetera') return { data: { saldo: 650000 } }
    throw new Error(`GET inesperado ${url}`)
  })
})

describe('adaptarVuelo', () => {
  it('traduce el vuelo de B2 a la forma de las pantallas', () => {
    expect(adaptarVuelo(VUELO_B2, { tiquetes_cliente: 2 })).toMatchObject({
      id: 7, codigo: 'AT-0007', origen: { ciudad: 'Bogotá', codigo: 'BOG' }, destino: { ciudad: 'Medellín', codigo: 'MDE' },
      salida: '2026-12-01T13:00:00Z', llegada: '2026-12-01T14:05:00Z', salida_zona: 'America/Bogota', llegada_zona: 'America/Bogota',
      duracion_min: 65, precio: 300000, moneda: 'COP', cupos_disponibles: 120, tiquetes_cliente: 2,
    })
  })

  it('un vuelo resumido (sin cupos ni costo) no inventa cupos y calcula la duración', () => {
    const v = adaptarVuelo(RESUMEN(8), { precio: 250000 })
    expect(v.cupos_disponibles).toBeUndefined()
    expect(v.precio).toBe(250000)
    expect(v.duracion_min).toBe(65)
  })
})

describe('consultas de vuelos', () => {
  it('obtenerVuelo suma los tiquetes activos del cliente en ese vuelo', async () => {
    http.get.mockImplementation(async (url) => (url === '/vuelos/7' ? { data: VUELO_B2 } : { data: { vuelo_id: 7, activos: 3 } }))
    const v = await obtenerVuelo(7)
    expect(http.get).toHaveBeenCalledWith('/vuelos/7/mis-tiquetes')
    expect(v.tiquetes_cliente).toBe(3)
    expect(v.precio).toBe(300000)
  })

  it('si no puede consultar los tiquetes del cliente, sigue con 0 (el backend impone el límite)', async () => {
    http.get.mockImplementation(async (url) => {
      if (url === '/vuelos/7') return { data: VUELO_B2 }
      throw new Error('403')
    })
    expect((await obtenerVuelo(7)).tiquetes_cliente).toBe(0)
  })

  it('listarVuelosRegreso adapta cada vuelo y conserva tiquetes_cliente', async () => {
    http.get.mockResolvedValue({ data: [{ ...VUELO_B2, id: 9, tiquetes_cliente: 4 }] })
    const [v] = await listarVuelosRegreso(7)
    expect(http.get).toHaveBeenCalledWith('/vuelos/7/regreso')
    expect(v).toMatchObject({ id: 9, precio: 300000, tiquetes_cliente: 4 })
  })
})

describe('agruparOperacion', () => {
  it('una compra con tiquetes de dos vuelos se ve como dos compras, una por vuelo', () => {
    const grupos = agruparOperacion(OPERACION())
    expect(grupos).toHaveLength(2)
    expect(grupos[0]).toMatchObject({ id: '9:1,2', estado: 'confirmada', clase: 'economica', tramo: 'ida', total: 600000 })
    expect(grupos[0].vuelo.codigo).toBe('AT-0007')
    expect(grupos[0].tiquetes.map((t) => [t.codigo_reserva, t.silla])).toEqual([['COD1', 14], ['COD2', 14]])
    expect(grupos[1]).toMatchObject({ id: '9:3', total: 300000 })
  })

  it('los tiquetes cancelados no se muestran mientras quede alguno activo; si todos lo están, la compra figura cancelada con su reintegro', () => {
    const parcial = agruparOperacion(OPERACION({ tiquetes: [TIQUETE(1, 7), TIQUETE(2, 7, { estado: 'cancelado', numero_silla: null })] }))
    expect(parcial[0].tiquetes).toHaveLength(1)
    expect(parcial[0].estado).toBe('confirmada')

    const todos = agruparOperacion(OPERACION({ tiquetes: [TIQUETE(1, 7, { estado: 'cancelado', numero_silla: null })] }))
    expect(todos[0]).toMatchObject({ estado: 'cancelada', reintegro: 300000 })
    expect(todos[0].tiquetes[0].silla).toBeUndefined()
  })

  it('el tramo del historial se toma del trayecto del tiquete', () => {
    const op = OPERACION({ tiquetes: [TIQUETE(1, 7, { trayecto: 'regreso' })] })
    expect(agruparOperacion(op)[0].tramo).toBe('vuelta')
  })

  it('una compra de un vuelo que ya ocurrió figura realizada', () => {
    const op = OPERACION({ tiquetes: [TIQUETE(1, 7, { vuelo: RESUMEN(7, 'sucedido') })] })
    expect(agruparOperacion(op)[0].estado).toBe('realizada')
  })

  it('una reserva conserva su estado y su vencimiento', () => {
    const op = OPERACION({ tipo: 'reserva', estado: 'activa', expira_en: '2026-11-12T15:00:00Z', tiquetes: [TIQUETE(5, 7, { estado: 'reservado' })] })
    expect(agruparOperacion(op)[0]).toMatchObject({ id: '9:5', estado: 'activa', expira_en: '2026-11-12T15:00:00Z', total: 300000 })
    expect(agruparOperacion({ ...op, estado: 'vencida' })[0].estado).toBe('vencida')
  })
})

describe('crearCompra', () => {
  it('envía el carrito en una sola operación, con los nombres de campo del backend', async () => {
    http.post.mockResolvedValue({ data: OPERACION() })
    const r = await crearCompra([ITEM(7), ITEM(8)])
    expect(http.post).toHaveBeenCalledTimes(1)
    const [ruta, cuerpo] = http.post.mock.calls[0]
    expect(ruta).toBe('/compras')
    expect(cuerpo.items).toHaveLength(2)
    expect(cuerpo.items[0]).toMatchObject({ trayecto: 'unico', vuelo_id: 7, clase: 'economica' })
    expect(cuerpo.items[0]).not.toHaveProperty('asientos')
    expect(cuerpo.items[0].viajeros[0]).toMatchObject({ nombre_contacto: 'Luis', telefono_contacto: '3007654321' })
    expect(cuerpo.items[0].viajeros[0]).not.toHaveProperty('contacto_nombre')
    expect(r).toMatchObject({ total: 900000, saldo: 650000 })
    expect(r.compras).toHaveLength(2)
    expect(r.correo).toBe('ana1@correo.com, ana2@correo.com, ana3@correo.com')
  })

  it('un saldo insuficiente llega como ApiError con su código', async () => {
    http.post.mockRejectedValue(new ApiError({ status: 402, code: 'saldo_insuficiente', message: 'No alcanza' }))
    await expect(crearCompra([ITEM()])).rejects.toMatchObject({ code: 'saldo_insuficiente', status: 402 })
  })
})

describe('crearReserva', () => {
  it('envía todo el carrito en una sola reserva atómica y devuelve un grupo por vuelo', async () => {
    http.post.mockResolvedValue({
      data: OPERACION({
        tipo: 'reserva', id: 20, estado: 'activa',
        tiquetes: [TIQUETE(1, 7, { estado: 'reservado' }), TIQUETE(2, 8, { estado: 'reservado' })],
      }),
    })
    const r = await crearReserva([ITEM(7), ITEM(8)])
    expect(http.post.mock.calls.map((c) => c[0])).toEqual(['/reservas'])
    expect(http.post.mock.calls[0][1].items).toHaveLength(2)
    expect(r.reservas.map((x) => x.id)).toEqual(['20:1', '20:2'])
  })

  it('un fallo del backend no dispara cancelaciones compensatorias', async () => {
    http.post.mockRejectedValue(new ApiError({ status: 409, code: 'sin_cupos', message: 'Sin cupos' }))
    await expect(crearReserva([ITEM(7), ITEM(8)])).rejects.toMatchObject({ code: 'sin_cupos' })
    expect(http.post).toHaveBeenCalledTimes(1)
  })

  it('ida y vuelta se envían como un único item completo, sin sillas (el backend las asigna)', async () => {
    http.post.mockResolvedValue({ data: OPERACION({ tipo: 'reserva', id: 21, estado: 'activa', tiquetes: [TIQUETE(1, 7, { estado: 'reservado' })] }) })
    const ida = { ...ITEM(7), tramo: 'ida', trayecto: 'ida_vuelta', vuelo_regreso_id: 8 }
    const vuelta = { ...ITEM(8), tramo: 'vuelta' }
    await crearReserva([ida, vuelta])
    const [, cuerpo] = http.post.mock.calls[0]
    expect(cuerpo.items).toHaveLength(1)
    expect(cuerpo.items[0]).toMatchObject({ trayecto: 'completo', vuelo_id: 7, vuelo_regreso_id: 8 })
    expect(cuerpo.items[0]).not.toHaveProperty('asientos')
    expect(cuerpo.items[0]).not.toHaveProperty('asientos_regreso')
  })
})

describe('adaptarError', () => {
  it('traduce las claves de campo del backend a las del formulario', () => {
    const err = new ApiError({
      status: 422, code: 'validacion', message: 'Datos inválidos',
      fields: { 'items.0.viajeros.1.nombre_contacto': 'Obligatorio', 'items.0.viajeros.0.correo': 'Correo no válido' },
    })
    const r = adaptarError(err, [ITEM(7, [VIAJERO, VIAJERO])])
    expect(r.fields).toEqual({ 'viajeros.1.contacto_nombre': 'Obligatorio', 'viajeros.0.correo': 'Correo no válido' })
  })

  it('ubica el viajero repetido en el vuelo por su documento', () => {
    const otro = { ...VIAJERO, documento: 'ZZ9999' }
    const err = new ApiError({ status: 409, code: 'viajero_duplicado_en_vuelo', message: 'Repetido', fields: { documento: 'ZZ9999 ya esta en este vuelo.' } })
    expect(adaptarError(err, [ITEM(7, [VIAJERO, otro])]).fields).toEqual({ 'viajeros.1.documento': 'ZZ9999 ya esta en este vuelo.' })
  })

  it('con varios ítems no adivina de cuál habla el error', () => {
    const err = new ApiError({ status: 422, code: 'validacion', message: 'x', fields: { 'items.1.viajeros.0.correo': 'mal' } })
    expect(adaptarError(err, [ITEM(7), ITEM(8)]).fields).toEqual({ 'items.1.viajeros.0.correo': 'mal' })
  })
})

describe('historial y cancelaciones', () => {
  it('obtenerHistorial pide compras y reservas por separado y recorre todas las páginas', async () => {
    const compra = OPERACION({ tiquetes: [TIQUETE(1, 7)] })
    const reserva = OPERACION({ tipo: 'reserva', id: 30, estado: 'activa', expira_en: '2026-11-12T15:00:00Z', tiquetes: [TIQUETE(9, 7, { estado: 'reservado' })] })
    http.get.mockImplementation(async (url, { params } = {}) => {
      if (url !== '/mi-historial') throw new Error(url)
      if (params.tipo === 'reserva') return { data: { total: 1, pagina: 1, tamano: 50, items: [reserva] } }
      return params.pagina === 1
        ? { data: { total: 2, pagina: 1, tamano: 50, items: [compra] } }
        : { data: { total: 2, pagina: 2, tamano: 50, items: [{ ...compra, id: 10, tiquetes: [TIQUETE(4, 7)] }] } }
    })
    const h = await obtenerHistorial()
    expect(h.compras.map((c) => c.id)).toEqual(['9:1', '10:4'])
    expect(h.reservas.map((r) => r.id)).toEqual(['30:9'])
  })

  it('cancelarCompra manda solo los tiquetes de ese vuelo y devuelve reintegro y saldo', async () => {
    http.post.mockResolvedValue({ data: { operacion: {}, reintegro: 600000, saldo: 1250000 } })
    const r = await cancelarCompra('9:1,2')
    expect(http.post).toHaveBeenCalledWith('/compras/9/cancelar', { tiquete_ids: [1, 2] })
    expect(r).toEqual({ reintegro: 600000, saldo: 1250000 })
  })

  it('cancelarReserva usa el id de la reserva', async () => {
    http.post.mockResolvedValue({ data: { operacion: {}, reintegro: 0, saldo: null } })
    await cancelarReserva('30:9')
    expect(http.post).toHaveBeenCalledWith('/reservas/30/cancelar')
  })

  it('pagarReserva llama a /comprar y devuelve la compra y el saldo', async () => {
    http.post.mockResolvedValue({ data: OPERACION({ id: 31, id_reserva: 30, tiquetes: [TIQUETE(9, 7)] }) })
    const r = await pagarReserva('30:9')
    expect(http.post).toHaveBeenCalledWith('/reservas/30/comprar')
    expect(r.compra).toMatchObject({ id: '31:9', estado: 'confirmada' })
    expect(r.saldo).toBe(650000)
  })
})
