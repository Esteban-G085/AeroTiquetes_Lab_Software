import { screen } from '@testing-library/react'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders, seedSession } from '@/test/helpers'
import * as api from '../api'

vi.mock('../api')

const CON_VUELO = {
  id: 12, tipo: 'vuelo', titulo: 'Nuevo vuelo Bogotá → Medellín',
  contenido: 'Ya puedes reservar el vuelo AT-204.',
  vuelo_id: 12,
  origen: { ciudad: 'Bogotá', codigo: 'BOG' }, destino: { ciudad: 'Medellín', codigo: 'MDE' },
  salida: '2027-03-12T13:15:00Z', salida_zona: 'America/Bogota',
  precio: 250000, moneda: 'COP', imagen_url: null,
  publicada_en: '2027-03-01T10:00:00Z', vigente_hasta: '2027-03-09T10:00:00Z',
}

const SIN_VUELO = {
  ...CON_VUELO, id: 99, titulo: 'Nuevos destinos para el próximo mes',
  contenido: 'Estamos ampliando nuestra ruta nacional.', vuelo_id: null,
  origen: { ciudad: '', codigo: '' }, destino: { ciudad: '', codigo: '' },
  precio: 0,
}

beforeEach(() => {
  seedSession({ rol: 'cliente' }, { nombres: 'Ana' })
  api.obtenerNoticia.mockResolvedValue(CON_VUELO)
})

describe('NoticiaDetallePage (HU11)', () => {
  it('carga el detalle por id y ofrece la reserva del vuelo', async () => {
    renderWithProviders(<AppRouter />, { route: '/noticias/12' })

    expect(await screen.findByRole('heading', { name: 'Nuevo vuelo Bogotá → Medellín' })).toBeInTheDocument()
    expect(screen.getByText(/Ya puedes reservar el vuelo AT-204/)).toBeInTheDocument()
    expect(api.obtenerNoticia).toHaveBeenCalledWith('12')
    expect(screen.getByRole('link', { name: /Reservar o comprar Bogotá → Medellín/ }))
      .toHaveAttribute('href', '/comprar/12')
  })

  it('muestra una noticia manual sin vuelo sin enlace de compra', async () => {
    api.obtenerNoticia.mockResolvedValue(SIN_VUELO)
    renderWithProviders(<AppRouter />, { route: '/noticias/99' })

    expect(await screen.findByRole('heading', { name: 'Nuevos destinos para el próximo mes' })).toBeInTheDocument()
    expect(screen.getByText(/Estamos ampliando nuestra ruta nacional/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Reservar o comprar/ })).not.toBeInTheDocument()
  })

  it('muestra un estado de error si la noticia no existe o ya no está vigente', async () => {
    api.obtenerNoticia.mockRejectedValue(new Error('La noticia no existe.'))
    renderWithProviders(<AppRouter />, { route: '/noticias/99999' })

    expect(await screen.findByText('No encontramos la noticia')).toBeInTheDocument()
  })
})
