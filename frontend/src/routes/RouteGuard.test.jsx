import { screen } from '@testing-library/react'
import AppRouter from './AppRouter'
import { renderWithProviders, seedSession, PERFIL_CLIENTE } from '@/test/helpers'
import { http } from '@/services/http'

beforeEach(() => {
  // Pantallas que consultan GET /me: se responde a nivel de red, sin tocar los módulos
  http.defaults.adapter = async (config) => ({ status: 200, data: PERFIL_CLIENTE, headers: {}, config })
})

describe('RouteGuard (rutas protegidas por rol)', () => {
  it('visitante en ruta privada -> lo manda a /login', async () => {
    renderWithProviders(<AppRouter />, { route: '/perfil' })
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('cliente en ruta de administrador -> 403', async () => {
    seedSession({ rol: 'cliente' })
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos' })
    expect(await screen.findByText('No tienes acceso a esta sección')).toBeInTheDocument()
  })

  it('administrador en ruta de root -> 403', async () => {
    seedSession({ rol: 'administrador' })
    renderWithProviders(<AppRouter />, { route: '/root/roles' })
    expect(await screen.findByText('No tienes acceso a esta sección')).toBeInTheDocument()
  })

  it('administrador en su ruta -> entra', async () => {
    seedSession({ rol: 'administrador' })
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos' })
    expect(await screen.findByRole('heading', { name: 'Vuelos programados' })).toBeInTheDocument()
  })

  it('administrador en "/" (buscador de clientes) -> redirige a su inicio', async () => {
    seedSession({ rol: 'administrador' })
    renderWithProviders(<AppRouter />, { route: '/' })
    expect(await screen.findByRole('heading', { name: 'Vuelos programados' })).toBeInTheDocument()
  })

  it('cliente con sesión en /login -> redirige a su inicio', async () => {
    seedSession({ rol: 'cliente' })
    renderWithProviders(<AppRouter />, { route: '/login' })
    expect(await screen.findByRole('heading', { name: 'Buscar vuelos' })).toBeInTheDocument()
  })

  it('sin sesión pide /login y, al entrar, vuelve a la ruta que quería', async () => {
    seedSession({ rol: 'cliente' })
    renderWithProviders(<AppRouter />, { route: { pathname: '/login', state: { from: { pathname: '/perfil' } } } })
    expect(await screen.findByText('Documento: 11111')).toBeInTheDocument()
  })

  it('si el rol no puede entrar al destino previo, va a su inicio', async () => {
    seedSession({ rol: 'cliente' })
    renderWithProviders(<AppRouter />, { route: { pathname: '/login', state: { from: { pathname: '/admin/vuelos' } } } })
    expect(await screen.findByRole('heading', { name: 'Buscar vuelos' })).toBeInTheDocument()
  })

  it('token vencido en storage se descarta: vuelve a ser visitante', async () => {
    seedSession({ rol: 'administrador', expInSeconds: -60 })
    renderWithProviders(<AppRouter />, { route: '/admin/vuelos' })
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})
