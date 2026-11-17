import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders, seedSession } from '@/test/helpers'
import * as api from '../api'

vi.mock('../api')

// Forma real de NoticiaOut (docs/CONTRATO_ADMIN_VUELOS_NOTICIAS.md §5).
const NOTICIAS = [
  {
    id: 12, tipo: 'vuelo', titulo: 'Nuevo vuelo Bogotá → Medellín',
    contenido: 'Ya puedes reservar el vuelo AT-204.',
    vuelo_id: 12,
    origen: { ciudad: 'Bogotá', codigo: 'BOG' }, destino: { ciudad: 'Medellín', codigo: 'MDE' },
    salida: '2027-03-12T13:15:00Z', salida_zona: 'America/Bogota',
    precio: 250000, moneda: 'COP', imagen_url: null,
    publicada_en: '2027-03-01T10:00:00Z', vigente_hasta: '2027-03-09T10:00:00Z',
    descuento_pct: null, precio_original: null,
  },
  {
    id: 13, tipo: 'promocion', titulo: '20% en cupos disponibles',
    contenido: 'Descuento por tiempo limitado.',
    vuelo_id: 7,
    origen: { ciudad: 'Bogotá', codigo: 'BOG' }, destino: { ciudad: 'Miami', codigo: 'MIA' },
    salida: '2027-03-18T13:15:00Z', salida_zona: 'America/Bogota',
    precio: 1160000, precio_original: 1450000, descuento_pct: 20, moneda: 'COP', imagen_url: null,
    publicada_en: '2027-03-02T10:00:00Z', vigente_hasta: '2027-03-10T10:00:00Z',
  },
]

beforeEach(() => {
  api.listarNoticias.mockResolvedValue({ total: NOTICIAS.length, items: NOTICIAS })
  api.estadoSuscripcion.mockResolvedValue({ suscrito: false, correo: 'ana@correo.com' })
  api.suscribirseNoticias.mockResolvedValue({ suscrito: true, correo: 'ana@correo.com' })
  api.cancelarSuscripcionNoticias.mockResolvedValue(undefined)
})

describe('NoticiasPage como cliente (HU11)', () => {
  beforeEach(() => seedSession({ rol: 'cliente' }, { nombres: 'Ana' }))

  it('muestra cada noticia con origen, destino, fecha y precio unitario', async () => {
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByRole('heading', { name: 'Nuevo vuelo Bogotá → Medellín' })).toBeInTheDocument()
    expect(screen.getByText(/250\.000/)).toBeInTheDocument()
    expect(screen.getAllByText(/por persona/)).toHaveLength(2)
    expect(screen.getByText('Bogotá a Medellín')).toBeInTheDocument()
    expect(screen.getByText('Bogotá a Miami')).toBeInTheDocument()
  })

  it('las promociones muestran el descuento que envía el backend', async () => {
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByText('20% de descuento')).toBeInTheDocument()
    expect(screen.getByText('Promoción')).toBeInTheDocument()
  })

  it('cada noticia lleva a reservar o comprar ese vuelo', async () => {
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByRole('link', { name: 'Reservar o comprar Bogotá a Medellín' }))
      .toHaveAttribute('href', '/comprar/12')
  })

  it('cada noticia lleva a su detalle', async () => {
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    const detalles = await screen.findAllByRole('link', { name: 'Ver detalle' })
    expect(detalles.map((a) => a.getAttribute('href'))).toEqual(['/noticias/12', '/noticias/13'])
  })

  it('el cliente se suscribe con el correo de su cuenta si no escribe otro', async () => {
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    await userEvent.click(await screen.findByRole('button', { name: 'Suscribirme' }))
    expect(api.suscribirseNoticias).toHaveBeenCalledWith('ana@correo.com')
  })

  it('el cliente puede suscribirse con otro correo (PUT con { correo })', async () => {
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    const campo = await screen.findByLabelText('Correo')
    await userEvent.clear(campo)
    await userEvent.type(campo, 'otra@correo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Suscribirme' }))
    expect(api.suscribirseNoticias).toHaveBeenCalledWith('otra@correo.com')
  })

  it('valida el correo antes de suscribirse', async () => {
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    const campo = await screen.findByLabelText('Correo')
    await userEvent.clear(campo)
    await userEvent.type(campo, 'no-es-correo')
    await userEvent.click(screen.getByRole('button', { name: 'Suscribirme' }))
    expect(await screen.findByText('Escribe un correo válido.')).toBeInTheDocument()
    expect(api.suscribirseNoticias).not.toHaveBeenCalled()
  })

  it('si ya está suscrito puede cancelar la suscripción', async () => {
    api.estadoSuscripcion.mockResolvedValue({ suscrito: true, correo: 'ana@correo.com' })
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByText(/Estás suscrito/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar suscripción' }))
    expect(api.cancelarSuscripcionNoticias).toHaveBeenCalledTimes(1)
  })

  it('sin noticias muestra un estado vacío y sigue pudiendo suscribirse', async () => {
    api.listarNoticias.mockResolvedValue({ total: 0, items: [] })
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByText('No hay noticias por ahora')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suscribirme' })).toBeInTheDocument()
  })
})

describe('NoticiasPage como administrador', () => {
  it('ve las noticias, no se suscribe ni compra y siempre ofrece Crear noticia', async () => {
    seedSession({ rol: 'administrador' }, { nombre: 'Jose' })
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByRole('heading', { name: 'Nuevo vuelo Bogotá → Medellín' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Suscribirme' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Reservar o comprar/ })).not.toBeInTheDocument()
    expect(api.estadoSuscripcion).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Crear noticia' })).toHaveAttribute('href', '/noticias/crear')
  })

  it('ofrece Crear noticia incluso cuando no hay noticias', async () => {
    seedSession({ rol: 'administrador' }, { nombre: 'Jose' })
    api.listarNoticias.mockResolvedValue({ total: 0, items: [] })
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByText('No hay noticias por ahora')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Crear noticia' })).toHaveAttribute('href', '/noticias/crear')
  })

  it('abre Crear noticia sin caer en el ErrorBoundary', async () => {
    const user = userEvent.setup()
    seedSession({ rol: 'administrador' }, { nombre: 'Jose' })
    renderWithProviders(<AppRouter />, { route: '/noticias' })

    await user.click(await screen.findByRole('link', { name: 'Crear noticia' }))

    expect(await screen.findByRole('heading', { name: 'Crear noticia' })).toBeInTheDocument()
    expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument()
  })

  it('no ofrece Crear noticia a root (el backend solo lo permite a administrador)', async () => {
    seedSession({ rol: 'root' }, { nombre: 'Root' })
    renderWithProviders(<AppRouter />, { route: '/noticias' })
    expect(await screen.findByRole('heading', { name: 'Nuevo vuelo Bogotá → Medellín' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Crear noticia' })).not.toBeInTheDocument()
  })
})
