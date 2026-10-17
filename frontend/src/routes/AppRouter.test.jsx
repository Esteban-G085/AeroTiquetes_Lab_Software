import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from './AppRouter'
import { renderWithProviders, seedSession } from '@/test/helpers'

describe('AppRouter', () => {
  it('muestra el buscador en / con la cabecera, la navegación y las acciones de cuenta', async () => {
    renderWithProviders(<AppRouter />, { route: '/' })
    expect(await screen.findByRole('heading', { name: 'Buscar vuelos' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrarse' })).toHaveAttribute('href', '/registro')
    expect(document.title).toBe('Vuelos · AeroTiquetes')
  })

  it('no dibuja un carrito inactivo: no existe aún, y un botón que no hace nada confunde', async () => {
    renderWithProviders(<AppRouter />, { route: '/' })
    await screen.findByRole('heading', { name: 'Buscar vuelos' })
    expect(screen.queryByRole('button', { name: /carrito/i })).not.toBeInTheDocument()
  })

  it('con sesión, la cabecera muestra el menú de la persona con cuenta y cierre de sesión', async () => {
    seedSession({ rol: 'cliente' }, { nombres: 'Ana' })
    renderWithProviders(<AppRouter />, { route: '/' })
    await userEvent.click(await screen.findByRole('button', { name: 'Ana' }))
    const menu = screen.getByRole('menu', { name: 'Cuenta' })
    expect(within(menu).getByRole('menuitem', { name: 'Mi perfil' })).toHaveAttribute('href', '/perfil')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('link', { name: 'Registrarse' })).toBeInTheDocument()
  })

  it('el menú de la persona se cierra con Escape', async () => {
    seedSession({ rol: 'cliente' }, { nombres: 'Ana' })
    renderWithProviders(<AppRouter />, { route: '/' })
    await userEvent.click(await screen.findByRole('button', { name: 'Ana' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('el login es de pantalla completa: sin barra superior', async () => {
    renderWithProviders(<AppRouter />, { route: '/login' })
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir menú' })).not.toBeInTheDocument()
  })

  it('muestra 404 en rutas desconocidas', async () => {
    renderWithProviders(<AppRouter />, { route: '/no-existe' })
    expect(await screen.findByText('Esta página no existe')).toBeInTheDocument()
  })

  it('menú diferenciado: el visitante ve acceso y registro; no ve módulos del root', async () => {
    renderWithProviders(<AppRouter />, { route: '/' })
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir menú' }))
    const menu = screen.getByRole('dialog', { name: 'Menú' })
    expect(within(menu).getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: 'Registrarse' })).toBeInTheDocument()
    expect(within(menu).queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })

  it('menú diferenciado: el root ve sus módulos, sin carrito, y puede cerrar sesión', async () => {
    seedSession({ rol: 'root' }, { usuario: 'root' })
    renderWithProviders(<AppRouter />, { route: '/root/roles' })
    expect(await screen.findByRole('heading', { name: 'Gestionar roles' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /carrito/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    const menu = screen.getByRole('dialog', { name: 'Menú' })
    expect(within(menu).getByRole('link', { name: 'Administradores' })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: 'Roles' })).toBeInTheDocument()

    await userEvent.click(within(menu).getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('Escape cierra el menú lateral', async () => {
    renderWithProviders(<AppRouter />, { route: '/' })
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir menú' }))
    expect(screen.getByRole('dialog', { name: 'Menú' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Menú' })).not.toBeInTheDocument()
  })
})
