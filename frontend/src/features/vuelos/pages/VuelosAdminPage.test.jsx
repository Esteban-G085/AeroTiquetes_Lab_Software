import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { CIUDADES } from '@/domain/ciudades'
import { ApiError } from '@/services/apiError'
import { renderWithProviders, seedSession } from '@/test/helpers'
import * as api from '../api'

vi.mock('../api')
vi.mock('@/utils/useCiudades', () => ({
  useCiudades: () => ({ ciudades: CIUDADES, status: 'ready', recargar: () => {} }),
}))

const VUELOS = [
  {
    id: 9, codigo: 'AT-0009', tipo: 'nacional', estado: 'programado',
    origen: { codigo: 'BOG', nombre: 'Bogotá', zona_horaria: 'America/Bogota' },
    destino: { codigo: 'MDE', nombre: 'Medellín', zona_horaria: 'America/Bogota' },
    salida_utc: '2026-11-10T13:10:00Z', duracion_min: 65, costo: 300000,
    cupos_economica: 125, cupos_primera: 25,
  },
  {
    id: 10, codigo: 'AT-0010', tipo: 'internacional', estado: 'cancelado',
    origen: { codigo: 'BOG', nombre: 'Bogotá', zona_horaria: 'America/Bogota' },
    destino: { codigo: 'MAD', nombre: 'Madrid', zona_horaria: 'Europe/Madrid' },
    salida_utc: '2026-12-01T10:00:00Z', duracion_min: 615, costo: 2450000,
    cupos_economica: 200, cupos_primera: 50,
  },
]

const abrir = async () => {
  renderWithProviders(<AppRouter />, { route: '/admin/vuelos' })
  await screen.findByText('AT-0009')
}

beforeEach(() => {
  sessionStorage.clear()
  seedSession({ rol: 'administrador' })
  api.listarVuelos.mockResolvedValue({ total: 2, items: VUELOS })
})

describe('VuelosAdminPage (HU19)', () => {
  it('lista los vuelos programados con su estado y enlace de consulta', async () => {
    await abrir()
    const tabla = screen.getByRole('table')
    expect(within(tabla).getByText('AT-0010')).toBeInTheDocument()
    expect(within(tabla).getByText('Programado')).toBeInTheDocument()
    expect(within(tabla).getByText('Cancelado')).toBeInTheDocument()
    expect(within(tabla).getByText(/2\.450\.000/)).toBeInTheDocument()
    const consultas = screen.getAllByRole('link', { name: 'Consultar' })
    expect(consultas).toHaveLength(2)
    expect(consultas[0]).toHaveAttribute('href', '/admin/vuelos/9')
  })

  it('ofrece programar un vuelo nuevo (HU18)', async () => {
    await abrir()
    expect(screen.getByRole('link', { name: 'Programar vuelo' })).toHaveAttribute('href', '/admin/vuelos/nuevo')
  })

  it('filtra por estado contra la API', async () => {
    await abrir()
    api.listarVuelos.mockClear()

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'cancelado')

    await waitFor(() => expect(api.listarVuelos).toHaveBeenCalledWith(expect.objectContaining({ estado: 'cancelado' })))
  })

  it('sin vuelos con esos filtros explica qué hacer', async () => {
    api.listarVuelos.mockResolvedValue({ total: 0, items: [] })
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos' })
    expect(await screen.findByText('No hay vuelos con esos filtros')).toBeInTheDocument()
  })

  it('mientras carga reserva el hueco de la tabla con un esqueleto', async () => {
    api.listarVuelos.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos' })

    expect(await screen.findByRole('status', { name: 'Cargando vuelos…' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('si falla la carga, ofrece reintentar', async () => {
    api.listarVuelos.mockRejectedValueOnce(new ApiError({ status: 500, message: 'Falló el servidor' }))
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos' })
    expect(await screen.findByText('Falló el servidor')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('AT-0009')).toBeInTheDocument()
  })
})

describe('acceso al panel de vuelos', () => {
  it('un cliente no entra a /admin/vuelos (403) y no se llama a la API', async () => {
    sessionStorage.clear()
    seedSession({ rol: 'cliente' })
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos' })
    expect(await screen.findByText('No tienes acceso a esta sección')).toBeInTheDocument()
    expect(api.listarVuelos).not.toHaveBeenCalled()
  })
})
