import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders, seedSession } from '@/test/helpers'
import * as api from '../api'

vi.mock('../api')

const NOTICIAS = [
  {
    id: 'v1', tipo: 'vuelo', vuelo_id: 12, origen: { ciudad: 'Bogotá', codigo: 'BOG' }, destino: { ciudad: 'Medellín', codigo: 'MDE' },
    salida: '2027-03-12T13:15:00Z', salida_zona: 'America/Bogota', precio: 250000, moneda: 'COP', imagen_url: null,
    publicada_en: '2027-03-01T10:00:00Z', vigente_hasta: '2027-03-09T10:00:00Z',
  },
  {
    id: 'p1', tipo: 'promocion', titulo: '20% en cupos disponibles', vuelo_id: 7, origen: { ciudad: 'Bogotá', codigo: 'BOG' }, destino: { ciudad: 'Miami', codigo: 'MIA' },
    salida: '2027-03-18T13:15:00Z', salida_zona: 'America/Bogota', precio: 1160000, precio_original: 1450000, descuento_pct: 20, moneda: 'COP', imagen_url: null,
    publicada_en: '2027-03-01T10:00:00Z', vigente_hasta: '2027-03-09T10:00:00Z',
  },
]

beforeEach(() => {
  api.listarNoticias.mockResolvedValue(NOTICIAS)
  api.obtenerSuscripcion.mockResolvedValue({ suscrito: false, correo: 'ana@correo.com' })
})

describe('NoticiasPage como cliente (HU12)', () => {
  beforeEach(() => seedSession({ rol: 'cliente' }, { nombres: 'Ana' }))

  it('muestra cada noticia con origen, destino, fecha y precio unitario', async () => {
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByRole('heading', { name: 'Bogotá a Medellín' })).toBeInTheDocument()
    expect(screen.getByText(/250\.000/)).toBeInTheDocument()
    expect(screen.getAllByText('por persona')).toHaveLength(2)
    expect(screen.getByText('Nuevo vuelo')).toBeInTheDocument()
  })

  it('las promociones muestran el descuento que envía el backend', async () => {
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByText('20% de descuento')).toBeInTheDocument()
    expect(screen.getByText('Promoción')).toBeInTheDocument()
  })

  it('cada noticia lleva a reservar o comprar ese vuelo', async () => {
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByRole('link', { name: 'Reservar o comprar Bogotá a Medellín' })).toHaveAttribute('href', '/comprar/12')
  })

  it('el cliente se suscribe con su correo', async () => {
    api.suscribirse.mockResolvedValue({ suscrito: true, correo: 'ana@correo.com' })
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme' }))
    expect(api.suscribirse).toHaveBeenCalledWith('ana@correo.com') // usa el correo de su cuenta si no escribe otro
  })

  it('valida el correo antes de suscribirse', async () => {
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    await userEvent.type(await screen.findByLabelText('Correo'), 'no-es-correo')
    await userEvent.click(screen.getByRole('button', { name: 'Suscribirme' }))
    expect(await screen.findByText('Escribe un correo válido.')).toBeInTheDocument()
    expect(api.suscribirse).not.toHaveBeenCalled()
  })

  it('si ya está suscrito puede cancelar la suscripción', async () => {
    api.obtenerSuscripcion.mockResolvedValue({ suscrito: true, correo: 'ana@correo.com' })
    api.cancelarSuscripcion.mockResolvedValue()
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByText(/Estás suscrito/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar suscripción' }))
    expect(api.cancelarSuscripcion).toHaveBeenCalledTimes(1)
  })

  it('sin noticias muestra un estado vacío', async () => {
    api.listarNoticias.mockResolvedValue([])
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByText('No hay noticias por ahora')).toBeInTheDocument()
  })
})

describe('NoticiasPage como administrador', () => {
  it('ve las noticias, pero no se suscribe ni compra desde ellas', async () => {
    seedSession({ rol: 'administrador' }, { nombre: 'Jose' })
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByRole('heading', { name: 'Bogotá a Medellín' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Suscribirme' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Reservar o comprar/ })).not.toBeInTheDocument()
    expect(api.obtenerSuscripcion).not.toHaveBeenCalled()
  })
})
