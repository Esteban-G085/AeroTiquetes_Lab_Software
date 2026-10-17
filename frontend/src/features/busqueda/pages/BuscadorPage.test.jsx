import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { CIUDADES } from '@/domain/ciudades'
import { ApiError } from '@/services/apiError'
import { renderWithProviders } from '@/test/helpers'
import * as api from '../api'

vi.mock('../api')
vi.mock('@/utils/useCiudades', () => ({
  useCiudades: () => ({ ciudades: CIUDADES, status: 'ready', recargar: () => {} }),
}))

const VUELO = {
  id: 7, codigo: 'AT-0007', tipo: 'nacional', estado: 'programado',
  origen: { codigo: 'BOG', nombre: 'Bogotá', pais: 'Colombia', zona_horaria: 'America/Bogota' },
  destino: { codigo: 'MDE', nombre: 'Medellín', pais: 'Colombia', zona_horaria: 'America/Bogota' },
  salida_utc: '2026-11-10T13:10:00Z', llegada_utc: '2026-11-10T14:15:00Z',
  duracion_min: 65, costo: 300000, cupos_economica: 125, cupos_primera: 25,
}

const abrirResultados = async () => {
  renderWithProviders(<AppRouter />, { route: '/' })
  return screen.findByRole('article', { name: 'Vuelo AT-0007: Bogotá a Medellín' })
}

beforeEach(() => {
  api.buscarVuelos.mockResolvedValue({ total: 1, items: [VUELO] })
})

describe('BuscadorPage (HU5)', () => {
  it('muestra el formulario y la lista de vuelos con los datos completos', async () => {
    const card = await abrirResultados()
    expect(screen.getByLabelText('Origen')).toBeInTheDocument()
    expect(screen.getByLabelText('Destino')).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha de salida')).toBeInTheDocument()

    expect(card).toHaveTextContent('BOG')
    expect(card).toHaveTextContent('MDE')
    expect(card).toHaveTextContent('08:10') // 13:10 UTC en hora de Bogotá
    expect(card).toHaveTextContent('Económica: 125 · Primera: 25')
    expect(card).toHaveTextContent(/300\.000/)
    expect(screen.getByRole('link', { name: 'Ver detalle' })).toHaveAttribute('href', '/vuelos/7')
  })

  it('aplica los criterios: viajan a la URL y a la consulta', async () => {
    await abrirResultados()
    api.buscarVuelos.mockClear()

    await userEvent.selectOptions(screen.getByLabelText('Origen'), 'BOG')
    await userEvent.click(screen.getByRole('button', { name: /Buscar vuelos/ }))

    await waitFor(() => expect(api.buscarVuelos).toHaveBeenCalledWith(expect.objectContaining({ origen: 'BOG' })))
  })

  it('no busca si origen y destino son la misma ciudad', async () => {
    await abrirResultados()
    api.buscarVuelos.mockClear()

    await userEvent.selectOptions(screen.getByLabelText('Origen'), 'BOG')
    await userEvent.selectOptions(screen.getByLabelText('Destino'), 'BOG')
    await userEvent.click(screen.getByRole('button', { name: /Buscar vuelos/ }))

    expect(await screen.findByText(/no pueden ser la misma ciudad/i)).toBeInTheDocument()
    expect(api.buscarVuelos).not.toHaveBeenCalled()
  })

  it('sin coincidencias explica qué ajustar (y no oculta el formulario)', async () => {
    api.buscarVuelos.mockResolvedValue({ total: 0, items: [] })
    renderWithProviders(<AppRouter />, { route: '/' })

    expect(await screen.findByText('No se encontraron vuelos')).toBeInTheDocument()
    expect(screen.getByLabelText('Origen')).toBeInTheDocument()
  })

  it('abre bajo la franja de marca con el título de la pantalla', () => {
    renderWithProviders(<AppRouter />, { route: '/' })
    const titulo = screen.getByRole('heading', { level: 1, name: 'Buscar vuelos' })
    expect(titulo.closest('.at-hero')).not.toBeNull()
  })

  it('mientras consulta la API reserva el hueco de los resultados con un esqueleto', async () => {
    api.buscarVuelos.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<AppRouter />, { route: '/' })

    expect(await screen.findByRole('status', { name: 'Buscando vuelos…' })).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('si la búsqueda falla, ofrece reintentar', async () => {
    api.buscarVuelos.mockRejectedValueOnce(new ApiError({ status: 500, message: 'Falló el servidor' }))
    renderWithProviders(<AppRouter />, { route: '/' })

    expect(await screen.findByText('Falló el servidor')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('article', { name: 'Vuelo AT-0007: Bogotá a Medellín' })).toBeInTheDocument()
  })
})
