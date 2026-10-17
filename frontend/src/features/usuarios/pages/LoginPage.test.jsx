import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders, makeJwt } from '@/test/helpers'
import * as authApi from '@/services/authApi'
import { ApiError } from '@/services/apiError'

vi.mock('@/services/authApi')

const fill = async (user = 'ana', pass = 'Clave123') => {
  await userEvent.type(await screen.findByLabelText(/usuario o correo/i), user)
  await userEvent.type(screen.getByLabelText('Escribe tu contraseña'), pass)
}
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
const loginAs = (rol) => authApi.login.mockResolvedValue({ token: makeJwt({ rol }), rol, user: { nombres: 'Ana' } })

describe('LoginPage (HU1)', () => {
  it('muestra los campos y el enlace a registro, y oculta "¿Olvidó su contraseña?" (D9)', async () => {
    renderWithProviders(<AppRouter />, { route: '/login' })
    expect(await screen.findByLabelText(/usuario o correo/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Regístrate' })).toHaveAttribute('href', '/registro')
    expect(screen.queryByText(/olvidó/i)).not.toBeInTheDocument()
  })

  it('la contraseña se puede mostrar y ocultar para evitar errores de tecleo', async () => {
    renderWithProviders(<AppRouter />, { route: '/login' })
    const input = await screen.findByLabelText('Escribe tu contraseña')
    expect(input).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('valida campos obligatorios sin llamar a la API', async () => {
    renderWithProviders(<AppRouter />, { route: '/login' })
    await screen.findByLabelText(/usuario o correo/i)
    await submit()
    expect(screen.getByText('Escribe tu usuario o correo.')).toBeInTheDocument()
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument()
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('cliente: tras entrar llega al buscador', async () => {
    loginAs('cliente')
    renderWithProviders(<AppRouter />, { route: '/login' })
    await fill(); await submit()
    expect(await screen.findByRole('heading', { name: 'Buscar vuelos' })).toBeInTheDocument()
    expect(authApi.login).toHaveBeenCalledWith('ana', 'Clave123')
  })

  it('administrador y root: cada uno llega a su propio inicio', async () => {
    loginAs('administrador')
    const first = renderWithProviders(<AppRouter />, { route: '/login' })
    await fill(); await submit()
    expect(await screen.findByRole('heading', { name: 'Vuelos programados' })).toBeInTheDocument()
    first.unmount(); sessionStorage.clear()

    loginAs('root')
    renderWithProviders(<AppRouter />, { route: '/login' })
    await fill(); await submit()
    expect(await screen.findByRole('heading', { name: 'Gestionar administradores' })).toBeInTheDocument()
  })

  it('credenciales incorrectas: mensaje genérico, sin revelar qué campo falló', async () => {
    authApi.login.mockRejectedValue(new ApiError({ status: 401, code: 'CREDENCIALES', message: 'La contraseña no coincide' }))
    renderWithProviders(<AppRouter />, { route: '/login' })
    await fill(); await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.')
    expect(screen.queryByText(/no coincide/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled()
  })

  it('error de red: informa el problema real', async () => {
    authApi.login.mockRejectedValue(new ApiError({ code: 'NETWORK_ERROR', message: 'No pudimos conectar con el servidor. Revisa tu conexión.' }))
    renderWithProviders(<AppRouter />, { route: '/login' })
    await fill(); await submit()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No pudimos conectar'))
  })
})
