import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { CIUDADES as CATALOGO } from '@/domain/ciudades'
import { ApiError } from '@/services/apiError'
import { renderWithProviders, seedSession } from '@/test/helpers'
import { fechaHoraColombia, payloadEditarVuelo } from '../components/VueloForm'
import * as api from '../api'

vi.mock('../api')
vi.mock('@/utils/useCiudades', () => ({
  useCiudades: () => ({ ciudades: CATALOGO, status: 'ready', recargar: () => {} }),
}))

// Editar (HU12), cancelar (HU13) y realizados (HU14) contra el contrato real de B2 (ver `api.js`).
const DEL_BACKEND = (extra = {}) => ({
  id: 12, codigo: 'AT-204', tipo: 'nacional', estado: 'programado',
  origen: { codigo: 'BOG', nombre: 'Bogotá', pais: 'Colombia', zona_horaria: 'America/Bogota' },
  destino: { codigo: 'MDE', nombre: 'Medellín', pais: 'Colombia', zona_horaria: 'America/Bogota' },
  salida_utc: '2027-03-12T13:15:00Z', llegada_utc: '2027-03-12T14:10:00Z', duracion_min: 55,
  costo: 250000, costo_primera: 380000, cupos_economica: 125, cupos_primera: 25, tiquetes_vendidos: 0,
  ...extra,
})

const field = (label) => screen.getByLabelText(label)
const guardar = () => screen.getByRole('button', { name: 'Guardar cambios' })
const filaDe = (codigo) => screen.getAllByRole('row').find((f) => within(f).queryByText(codigo))

beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  seedSession({ rol: 'administrador' }, { nombres: 'Jose' })
  api.listarVuelos.mockResolvedValue({ total: 0, items: [] })
  api.listarCiudades.mockResolvedValue([])
})

describe('Panel de vuelos: acciones de HU12, HU13 y HU14', () => {
  it('ofrece editar y cancelar solo a los vuelos programados', async () => {
    api.listarVuelos.mockResolvedValue({
      total: 2,
      items: [DEL_BACKEND(), DEL_BACKEND({ id: 13, codigo: 'AT-205', estado: 'cancelado' })],
    })
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos' })
    await screen.findByText('AT-204')
    await screen.findByText('AT-205')

    const programado = filaDe('AT-204')
    const cancelado = filaDe('AT-205')
    expect(within(programado).getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/admin/vuelos/12/editar')
    expect(within(programado).getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/admin/vuelos/12/cancelar')
    expect(within(cancelado).queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument()
    expect(within(cancelado).queryByRole('link', { name: 'Cancelar' })).not.toBeInTheDocument()
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
    expect(api.obtenerVueloAdmin).not.toHaveBeenCalled()
  })
})

describe('EditarVueloPage (HU12)', () => {
  const open = async (vuelo = DEL_BACKEND()) => {
    api.obtenerVueloAdmin.mockResolvedValue(vuelo)
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/12/editar' })
    await screen.findByRole('heading', { name: 'Editar vuelo AT-204' })
  }

  it('arranca con los datos del vuelo, con la hora de Colombia', async () => {
    await open()
    expect(field('Fecha de salida')).toHaveValue('2027-03-12')
    expect(field('Hora de salida (Colombia)')).toHaveValue('08:15')
    expect(field('Origen')).toHaveValue('BOG')
    expect(field('Destino')).toHaveValue('MDE')
    expect(field('Duración (minutos)')).toHaveValue(55)
    expect(field('Costo por persona (COP)')).toHaveValue(250000)
    expect(field('Costo primera clase (COP)')).toHaveValue(380000)
  })

  it('guarda con los nombres exactos del contrato (sin tipo) y vuelve al detalle', async () => {
    api.actualizarVuelo.mockResolvedValue(DEL_BACKEND())
    await open()
    await userEvent.clear(field('Costo por persona (COP)'))
    await userEvent.type(field('Costo por persona (COP)'), '280000')
    fireEvent.change(field('Fecha de salida'), { target: { value: '2027-03-15' } })
    await userEvent.selectOptions(field('Destino'), 'CLO')
    await userEvent.click(guardar())

    expect(api.actualizarVuelo).toHaveBeenCalledWith('12', {
      origen: 'BOG', destino: 'CLO', fecha: '2027-03-15', hora: '08:15',
      duracion_min: 55, precio: 280000, precio_primera: 380000,
    })
    expect(await screen.findByRole('heading', { name: 'Vuelo AT-204' })).toBeInTheDocument()
  })

  it('no envía nada si falta un dato o el destino es igual al origen', async () => {
    await open()
    await userEvent.clear(field('Costo por persona (COP)'))
    await userEvent.selectOptions(field('Destino'), 'BOG')
    await userEvent.click(guardar())

    expect(await screen.findByText('El costo por persona debe ser mayor que cero.')).toBeInTheDocument()
    expect(screen.getByText('El destino debe ser distinto del origen.')).toBeInTheDocument()
    expect(api.actualizarVuelo).not.toHaveBeenCalled()
  })

  it('pinta en su campo el error que devuelve el backend', async () => {
    api.actualizarVuelo.mockRejectedValue(new ApiError({
      status: 422, message: 'Los datos enviados no son validos.',
      fields: { fecha: 'La fecha y la hora de salida deben ser futuras.' },
    }))
    await open()
    await userEvent.click(guardar())

    expect(await screen.findByText('La fecha y la hora de salida deben ser futuras.')).toBeInTheDocument()
  })

  it('con tiquetes vendidos el formulario queda bloqueado y se explica por qué', async () => {
    await open(DEL_BACKEND({ tiquetes_vendidos: 3 }))
    expect(screen.getByText(/3 tiquetes vendidos/)).toBeInTheDocument()
    expect(field('Costo por persona (COP)')).toBeDisabled()
    expect(guardar()).toBeDisabled()
  })

  it('un vuelo realizado tampoco se edita', async () => {
    await open(DEL_BACKEND({ estado: 'realizado' }))
    expect(screen.getByText(/ya fue realizado/)).toBeInTheDocument()
    expect(guardar()).toBeDisabled()
  })

  it('si el vuelo no existe lo dice y ofrece volver', async () => {
    api.obtenerVueloAdmin.mockRejectedValue(new ApiError({ status: 404, message: 'x' }))
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/999/editar' })
    expect(await screen.findByText('Vuelo no encontrado')).toBeInTheDocument()
  })
})

describe('CancelarVueloPage (HU13)', () => {
  const open = async (vuelo = DEL_BACKEND()) => {
    api.obtenerVueloAdmin.mockResolvedValue(vuelo)
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/12/cancelar' })
    await screen.findByRole('heading', { name: 'Cancelar vuelo AT-204' })
  }

  it('sin tiquetes vendidos se cancela con confirmación y sin causa obligatoria', async () => {
    api.cancelarVuelo.mockResolvedValue(DEL_BACKEND({ estado: 'cancelado' }))
    await open()
    expect(screen.getByLabelText(/Causa de fuerza mayor \(opcional\)/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar vuelo' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/no se puede deshacer/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sí, cancelar vuelo' }))
    expect(api.cancelarVuelo).toHaveBeenCalledWith('12', '')
    expect(await screen.findByRole('heading', { name: 'Vuelos programados' })).toBeInTheDocument()
  })

  it('con tiquetes vendidos exige registrar la causa de fuerza mayor antes de confirmar', async () => {
    api.cancelarVuelo.mockResolvedValue(DEL_BACKEND({ estado: 'cancelado' }))
    await open(DEL_BACKEND({ tiquetes_vendidos: 4 }))
    expect(screen.getByText(/4 tiquetes vendidos/)).toBeInTheDocument()

    const boton = screen.getByRole('button', { name: 'Cancelar vuelo' })
    const causa = () => screen.getByLabelText(/Causa de fuerza mayor/)
    expect(boton).toBeDisabled()
    await userEvent.type(causa(), 'Corto')
    expect(boton).toBeDisabled()
    await userEvent.type(causa(), ' pero ya está completo')
    expect(boton).toBeEnabled()

    await userEvent.click(boton)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, cancelar vuelo' }))
    expect(api.cancelarVuelo).toHaveBeenCalledWith('12', 'Corto pero ya está completo')
  })

  it('un vuelo realizado no se puede cancelar y no ofrece el botón', async () => {
    api.obtenerVueloAdmin.mockResolvedValue(DEL_BACKEND({ estado: 'realizado' }))
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/12/cancelar' })
    expect(await screen.findByRole('heading', { name: 'Vuelo AT-204' })).toBeInTheDocument()
    expect(screen.getByText(/ya fue realizado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar vuelo' })).not.toBeInTheDocument()
  })

  it('si el backend rechaza, muestra el error del motivo y cierra el diálogo', async () => {
    api.cancelarVuelo.mockRejectedValue(new ApiError({
      status: 422, message: 'Los datos enviados no son validos.',
      fields: { motivo: 'Causa de fuerza mayor obligatoria (mínimo 10 caracteres).' },
    }))
    await open(DEL_BACKEND({ tiquetes_vendidos: 4 }))
    await userEvent.type(screen.getByLabelText(/Causa de fuerza mayor/), 'Cierre del aeropuerto por tormenta')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar vuelo' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, cancelar vuelo' }))

    expect(await screen.findByText('Causa de fuerza mayor obligatoria (mínimo 10 caracteres).')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('VuelosRealizadosPage (HU14)', () => {
  const lista = [
    DEL_BACKEND({ id: 20, codigo: 'AT-300', estado: 'realizado', tiquetes_vendidos: 120 }),
    DEL_BACKEND({ id: 21, codigo: 'AT-301', estado: 'sucedido', tiquetes_vendidos: 90 }),
  ]

  it('lista los vuelos sucedidos y realizados con su estado', async () => {
    api.listarVuelosRealizados.mockResolvedValue(lista)
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/realizados' })
    expect(await screen.findByText('AT-300')).toBeInTheDocument()
    expect(screen.getByText('Realizado')).toBeInTheDocument()
    expect(screen.getByText('Sucedido')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Editar|Cancelar/ })).not.toBeInTheDocument() // es un histórico
  })

  it('sin vuelos realizados lo explica', async () => {
    api.listarVuelosRealizados.mockResolvedValue([])
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/realizados' })
    expect(await screen.findByText('No hay vuelos realizados')).toBeInTheDocument()
  })

  it('si falla la carga ofrece reintentar', async () => {
    api.listarVuelosRealizados.mockRejectedValueOnce(new ApiError({ status: 500, message: 'Error del servidor' }))
    api.listarVuelosRealizados.mockResolvedValueOnce(lista)
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos/realizados' })
    await userEvent.click(await screen.findByRole('button', { name: /Reintentar/ }))
    expect(await screen.findByText('AT-300')).toBeInTheDocument()
  })
})

describe('Zona horaria y cuerpos del formulario (HU12)', () => {
  it('convierte la salida UTC a fecha y hora de Colombia', () => {
    expect(fechaHoraColombia('2027-03-12T13:15:00Z')).toEqual({ fecha: '2027-03-12', hora: '08:15' })
    expect(fechaHoraColombia(null)).toBeNull()
  })

  it('el payload de edición omite tipo y siempre envía precio_primera', () => {
    const f = {
      origen: 'BOG', destino: 'MDE', fecha: '2027-03-15', hora: '08:15',
      horas: '1', minutos: '30', costo: '280000', costoPrimera: '',
    }
    expect(payloadEditarVuelo(f)).toEqual({
      origen: 'BOG', destino: 'MDE', fecha: '2027-03-15', hora: '08:15',
      duracion_min: 90, precio: 280000, precio_primera: 280000,
    })
  })
})
