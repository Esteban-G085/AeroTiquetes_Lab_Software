import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { ApiError } from '@/services/apiError'
import { renderWithProviders, seedSession } from '@/test/helpers'
import * as api from '../api'

vi.mock('../api')

const VUELO = {
  id: 7, codigo: 'AT-0007', tipo: 'nacional', estado: 'programado',
  origen: { codigo: 'BOG', nombre: 'Bogotá', pais: 'Colombia', zona_horaria: 'America/Bogota' },
  destino: { codigo: 'MDE', nombre: 'Medellín', pais: 'Colombia', zona_horaria: 'America/Bogota' },
  salida_utc: '2026-11-10T13:10:00Z', llegada_utc: '2026-11-10T14:15:00Z',
  duracion_min: 65, costo: 300000, cupos_economica: 125, cupos_primera: 25,
}

const abrir = async () => {
  renderWithProviders(<AppRouter />, { route: '/vuelos/7' })
  await screen.findByText('AT-0007')
}

beforeEach(() => {
  sessionStorage.clear()
  api.obtenerVuelo.mockResolvedValue(VUELO)
})

describe('DetalleVueloPage (HU5)', () => {
  it('presenta código, ruta, horas locales de cada ciudad, duración, cupos y costo', async () => {
    await abrir()
    expect(screen.getByText('Bogotá, Colombia')).toBeInTheDocument()
    expect(screen.getByText('Medellín, Colombia')).toBeInTheDocument()
    expect(screen.getByText('1 h 5 min')).toBeInTheDocument()
    expect(screen.getByText(/300\.000/)).toBeInTheDocument()
    expect(screen.getByText('Programado', { selector: '.at-badge' })).toBeInTheDocument()
  })

  it('al visitante se le invita a iniciar sesión para reservar', async () => {
    await abrir()
    expect(screen.getByRole('link', { name: 'Inicia sesión para reservar' })).toHaveAttribute('href', '/login')
  })

  it('al cliente se le indica que la compra llega en el próximo sprint', async () => {
    seedSession({ rol: 'cliente' })
    await abrir()
    expect(screen.getByRole('button', { name: /próximo sprint/ })).toBeDisabled()
  })

  it('si el vuelo no existe, ofrece volver a la búsqueda', async () => {
    api.obtenerVuelo.mockRejectedValue(new ApiError({ status: 404, message: 'No encontramos lo que buscas.' }))
    renderWithProviders(<AppRouter />, { route: '/vuelos/404' })
    expect(await screen.findByText('Vuelo no encontrado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a la búsqueda' })).toHaveAttribute('href', '/')
  })

  it('si falla la carga, ofrece reintentar', async () => {
    api.obtenerVuelo.mockRejectedValueOnce(new ApiError({ status: 500, message: 'Falló el servidor' }))
    renderWithProviders(<AppRouter />, { route: '/vuelos/7' })
    expect(await screen.findByText('Falló el servidor')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('AT-0007')).toBeInTheDocument()
  })
})
