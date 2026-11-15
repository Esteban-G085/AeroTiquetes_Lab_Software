import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { CIUDADES as CATALOGO } from '@/domain/ciudades'
import { ApiError } from '@/services/apiError'
import { renderWithProviders, seedSession, VUELO_EJEMPLO } from '@/test/helpers'
import * as api from '../api'

vi.mock('../api')
vi.mock('@/utils/useCiudades', () => ({
  useCiudades: () => ({ ciudades: CATALOGO, status: 'ready', recargar: () => {} }),
}))

// Editar (HU12), cancelar (HU13) y realizados (HU14). Las pantallas son de F1; el backend es el de B2 (ver `api.js`).
const H = 3_600_000
const en = (h) => new Date(Date.now() + h * H).toISOString()
const V = (extra = {}) => ({ ...VUELO_EJEMPLO, estado: 'programado', tiquetes_vendidos: 0, salida: '2027-03-12T13:15:00Z', llegada: '2027-03-12T14:10:00Z', ...extra })
const CIUDADES = [{ codigo: 'BOG', ciudad: 'Bogotá' }, { codigo: 'MDE', ciudad: 'Medellín' }, { codigo: 'CLO', ciudad: 'Cali' }]
const field = (label) => screen.getByLabelText(label)

const DEL_BACKEND = (id, codigo, estado) => ({
  id, codigo, tipo: 'nacional', estado,
  origen: { codigo: 'BOG', nombre: 'Bogotá', zona_horaria: 'America/Bogota' },
  destino: { codigo: 'MDE', nombre: 'Medellín', zona_horaria: 'America/Bogota' },
  salida_utc: '2027-03-12T13:15:00Z', llegada_utc: '2027-03-12T14:10:00Z', duracion_min: 55, costo: 250000,
  cupos_economica: 125, cupos_primera: 25, tiquetes_vendidos: 0,
})

beforeEach(() => {
  seedSession({ rol: 'administrador' }, { nombre: 'Jose' })
  api.listarVuelos.mockResolvedValue({ total: 0, items: [] })
  api.listarCiudades.mockResolvedValue(CIUDADES)
})

describe('Panel de vuelos: acciones de HU12, HU13 y HU14', () => {
  it('ofrece editar y cancelar solo a los vuelos programados', async () => {
    api.listarVuelos.mockResolvedValue({ total: 2, items: [DEL_BACKEND(12, 'AT-204', 'programado'), DEL_BACKEND(13, 'AT-205', 'cancelado')] })
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos' })
    expect(await screen.findByRole('link', { name: 'Editar vuelo AT-204' })).toHaveAttribute('href', '/admin/vuelos/12/editar')
    expect(screen.getByRole('link', { name: 'Cancelar vuelo AT-204' })).toHaveAttribute('href', '/admin/vuelos/12/cancelar')
    expect(screen.queryByRole('link', { name: 'Editar vuelo AT-205' })).not.toBeInTheDocument()
  })

  it('enlaza a vuelos realizados y a programar vuelo', async () => {
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos' })
    expect(await screen.findByRole('link', { name: 'Vuelos realizados' })).toHaveAttribute('href', '/admin/vuelos/realizados')
    expect(screen.getByRole('link', { name: /Programar vuelo/ })).toHaveAttribute('href', '/admin/vuelos/nuevo')
  })

  it('un cliente no entra a la administración de vuelos', async () => {
    seedSession({ rol: 'cliente' }, { nombres: 'Ana' })
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/12/editar' })
    expect(await screen.findByText('No tienes acceso a esta sección')).toBeInTheDocument()
    expect(api.obtenerVuelo).not.toHaveBeenCalled()
  })
})

describe('EditarVueloPage (HU12)', () => {
  const open = async (vuelo = V()) => {
    api.obtenerVuelo.mockResolvedValue(vuelo)
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/12/editar' })
    await screen.findByRole('heading', { name: 'Editar vuelo AT-204' })
  }

  it('arranca con los datos del vuelo, con la hora de Colombia', async () => {
    await open()
    expect(field('Fecha de salida')).toHaveValue('2027-03-12')
    expect(field('Hora de salida')).toHaveValue('08:15')
    expect(field('Origen')).toHaveValue('BOG')
    expect(field('Destino')).toHaveValue('MDE')
    expect(field('Duración (minutos)')).toHaveValue('55')
    expect(field('Costo por persona (COP)')).toHaveValue('250000')
  })

  it('guarda los cambios con los nombres de campo del contrato y vuelve a la lista', async () => {
    api.editarVuelo.mockResolvedValue(V())
    await open()
    await userEvent.clear(field('Costo por persona (COP)'))
    await userEvent.type(field('Costo por persona (COP)'), '280000')
    fireEvent.change(field('Fecha de salida'), { target: { value: '2027-03-15' } })
    await userEvent.selectOptions(field('Destino'), 'CLO')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(api.editarVuelo).toHaveBeenCalledWith(12, expect.objectContaining({ fecha: '2027-03-15', destino: 'CLO', precio: '280000' }))
    expect(await screen.findByRole('heading', { name: 'Vuelos programados' })).toBeInTheDocument()
  })

  it('no envía nada si falta un dato o el destino es igual al origen', async () => {
    await open()
    await userEvent.clear(field('Costo por persona (COP)'))
    await userEvent.selectOptions(field('Destino'), 'BOG')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Este campo es obligatorio.')).toBeInTheDocument()
    expect(screen.getByText('El destino debe ser distinto del origen.')).toBeInTheDocument()
    expect(api.editarVuelo).not.toHaveBeenCalled()
  })

  it('pinta en su campo el error que devuelve el backend', async () => {
    api.editarVuelo.mockRejectedValue(new ApiError({ status: 422, message: 'Datos inválidos', fields: { duracion_min: 'Los vuelos internacionales directos duran más.' } }))
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Los vuelos internacionales directos duran más.')).toBeInTheDocument()
  })

  it('con tiquetes vendidos el formulario queda bloqueado y se explica por qué', async () => {
    await open(V({ tiquetes_vendidos: 3 }))
    expect(screen.getByText(/3 tiquetes vendidos/)).toBeInTheDocument()
    expect(field('Costo por persona (COP)')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('un vuelo realizado tampoco se edita', async () => {
    await open(V({ estado: 'realizado' }))
    expect(screen.getByText(/ya fue realizado/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('si el vuelo no existe lo dice y ofrece volver', async () => {
    api.obtenerVuelo.mockRejectedValue(new ApiError({ status: 404, message: 'x' }))
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/999/editar' })
    expect(await screen.findByText('No encontramos este vuelo')).toBeInTheDocument()
  })
})

describe('CancelarVueloPage (HU13)', () => {
  const open = async (vuelo = V()) => {
    api.obtenerVuelo.mockResolvedValue(vuelo)
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/12/cancelar' })
    await screen.findByRole('heading', { name: 'Cancelar vuelo AT-204' })
  }

  it('sin tiquetes vendidos se cancela con confirmación y sin causa obligatoria', async () => {
    api.cancelarVuelo.mockResolvedValue({})
    await open()
    expect(screen.getByLabelText(/Causa de fuerza mayor \(opcional\)/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar vuelo' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/no se puede deshacer/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sí, cancelar vuelo' }))
    expect(api.cancelarVuelo).toHaveBeenCalledWith(12, '')
    expect(await screen.findByRole('heading', { name: 'Vuelos programados' })).toBeInTheDocument()
  })

  it('con tiquetes vendidos exige registrar la causa de fuerza mayor antes de confirmar', async () => {
    api.cancelarVuelo.mockResolvedValue({})
    await open(V({ tiquetes_vendidos: 4 }))
    expect(screen.getByText(/4 tiquetes vendidos/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar vuelo' }))
    expect(await screen.findByText('Registra la causa de fuerza mayor.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/Causa de fuerza mayor/), 'Cierre del aeropuerto por tormenta')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar vuelo' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, cancelar vuelo' }))
    expect(api.cancelarVuelo).toHaveBeenCalledWith(12, 'Cierre del aeropuerto por tormenta')
  })

  it('un vuelo realizado no se puede cancelar y no ofrece el botón', async () => {
    await open(V({ estado: 'realizado' }))
    expect(screen.getByText(/ya fue realizado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar vuelo' })).not.toBeInTheDocument()
  })

  it('si el backend rechaza, muestra el motivo y el vuelo sigue sin cancelarse', async () => {
    api.cancelarVuelo.mockRejectedValue(new ApiError({ status: 409, message: 'El vuelo ya tiene tiquetes vendidos.' }))
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar vuelo' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, cancelar vuelo' }))
    expect(await screen.findByText('El vuelo ya tiene tiquetes vendidos.')).toBeInTheDocument()
  })
})

describe('VuelosRealizadosPage (HU14)', () => {
  const lista = [
    V({ id: 20, codigo: 'AT-300', estado: 'realizado', tiquetes_vendidos: 120, salida: en(-72) }),
    V({ id: 21, codigo: 'AT-301', estado: 'sucedido', tiquetes_vendidos: 90, salida: en(-2) }),
  ]

  it('lista los vuelos sucedidos y realizados con su estado', async () => {
    api.listarVuelosRealizados.mockResolvedValue(lista)
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/realizados' })
    expect(await screen.findByText('AT-300')).toBeInTheDocument()
    expect(screen.getByText('Realizado')).toBeInTheDocument()
    expect(screen.getByText('Sucedido')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Editar|Cancelar/ })).not.toBeInTheDocument() // es un histórico
  })

  it('se puede filtrar por sucedidos o realizados', async () => {
    api.listarVuelosRealizados.mockResolvedValue(lista)
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/realizados' })
    await userEvent.click(await screen.findByRole('button', { name: 'Sucedidos' }))
    expect(screen.getByText('AT-301')).toBeInTheDocument()
    expect(screen.queryByText('AT-300')).not.toBeInTheDocument()
  })

  it('muestra el total y cuántos son nacionales e internacionales', async () => {
    api.listarVuelosRealizados.mockResolvedValue([...lista, V({ id: 22, codigo: 'AT-302', tipo: 'internacional', estado: 'realizado' })])
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/realizados' })
    const resumen = await screen.findByLabelText('Resumen')
    expect(within(resumen).getByText('Total').nextSibling).toHaveTextContent('3')
    expect(within(resumen).getByText('Internacionales').nextSibling).toHaveTextContent('1')
  })

  it('se busca por código de vuelo y se filtra por tipo', async () => {
    api.listarVuelosRealizados.mockResolvedValue([...lista, V({ id: 22, codigo: 'AT-302', tipo: 'internacional', estado: 'realizado' })])
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/realizados' })
    await userEvent.type(await screen.findByLabelText('Buscar por código de vuelo'), '302')
    expect(screen.getByText('AT-302')).toBeInTheDocument()
    expect(screen.queryByText('AT-300')).not.toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Buscar por código de vuelo'))
    await userEvent.click(screen.getByRole('button', { name: 'Internacionales' }))
    expect(screen.getByText('AT-302')).toBeInTheDocument()
    expect(screen.queryByText('AT-301')).not.toBeInTheDocument()
  })

  it('sin vuelos realizados lo explica', async () => {
    api.listarVuelosRealizados.mockResolvedValue([])
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/realizados' })
    expect(await screen.findByText('Aún no hay vuelos realizados')).toBeInTheDocument()
  })

  it('si falla la carga ofrece reintentar', async () => {
    api.listarVuelosRealizados.mockRejectedValueOnce(new ApiError({ status: 500, message: 'Error del servidor' }))
    api.listarVuelosRealizados.mockResolvedValueOnce(lista)
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/realizados' })
    await userEvent.click(await screen.findByRole('button', { name: /Reintentar/ }))
    expect(await screen.findByText('AT-300')).toBeInTheDocument()
  })
})
