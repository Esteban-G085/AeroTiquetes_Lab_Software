import { screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuth } from '@/context'
import { renderWithProviders, makeJwt, seedSession } from '@/test/helpers'
import * as authApi from '@/services/authApi'
import { tokenStorage } from '@/services/tokenStorage'

vi.mock('@/services/authApi')

function Probe() {
  const { rol, isAuthenticated, user, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="rol">{rol}</span>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="user">{user?.nombres ?? '-'}</span>
      <button onClick={() => login('ana', 'Clave123').catch(() => {})}>entrar</button>
      <button onClick={logout}>salir</button>
    </div>
  )
}

describe('AuthContext', () => {
  it('arranca como visitante', () => {
    renderWithProviders(<Probe />)
    expect(screen.getByTestId('rol')).toHaveTextContent('visitante')
    expect(screen.getByTestId('auth')).toHaveTextContent('false')
  })

  it('login guarda token, toma el rol del JWT y logout lo limpia', async () => {
    authApi.login.mockResolvedValue({ token: makeJwt({ rol: 'administrador' }), rol: 'administrador', user: { nombres: 'Ana' } })
    renderWithProviders(<Probe />)
    await userEvent.click(screen.getByText('entrar'))
    expect(await screen.findByText('administrador')).toBeInTheDocument()
    expect(screen.getByTestId('user')).toHaveTextContent('Ana')
    expect(tokenStorage.get()).toBeTruthy()

    await userEvent.click(screen.getByText('salir'))
    expect(screen.getByTestId('rol')).toHaveTextContent('visitante')
    expect(tokenStorage.get()).toBeNull()
  })

  it('login fallido deja la sesión como estaba', async () => {
    authApi.login.mockRejectedValue(new Error('credenciales'))
    renderWithProviders(<Probe />)
    await userEvent.click(screen.getByText('entrar'))
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('false'))
  })

  it('restaura la sesión al recargar (desde sessionStorage)', () => {
    seedSession({ rol: 'cliente' }, { nombres: 'Luis' })
    renderWithProviders(<Probe />)
    expect(screen.getByTestId('rol')).toHaveTextContent('cliente')
    expect(screen.getByTestId('user')).toHaveTextContent('Luis')
  })

  describe('cierres automáticos (RNF06)', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('cierra por inactividad a los 30 min y avisa', () => {
      seedSession({ rol: 'cliente', expInSeconds: 3 * 3600 }) // JWT largo: aísla la inactividad
      renderWithProviders(<Probe />)
      act(() => vi.advanceTimersByTime(29 * 60 * 1000))
      expect(screen.getByTestId('auth')).toHaveTextContent('true')
      act(() => vi.advanceTimersByTime(61 * 1000))
      expect(screen.getByTestId('auth')).toHaveTextContent('false')
      expect(screen.getByText(/por inactividad/i)).toBeInTheDocument()
    })

    it('la actividad del usuario reinicia el contador', () => {
      seedSession({ rol: 'cliente', expInSeconds: 3 * 3600 })
      renderWithProviders(<Probe />)
      act(() => vi.advanceTimersByTime(20 * 60 * 1000))
      act(() => { window.dispatchEvent(new Event('keydown')) })
      act(() => vi.advanceTimersByTime(20 * 60 * 1000)) // 40 min en total, pero 20 desde la actividad
      expect(screen.getByTestId('auth')).toHaveTextContent('true')
    })

    it('cierra cuando vence el JWT aunque haya actividad', () => {
      seedSession({ rol: 'cliente', expInSeconds: 60 })
      renderWithProviders(<Probe />)
      act(() => vi.advanceTimersByTime(61 * 1000))
      expect(screen.getByTestId('auth')).toHaveTextContent('false')
      expect(screen.getByText(/sesión expiró/i)).toBeInTheDocument()
    })
  })
})
