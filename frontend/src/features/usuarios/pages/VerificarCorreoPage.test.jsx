import { StrictMode } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders, seedSession } from '@/test/helpers'
import { ApiError } from '@/services/apiError'
import * as api from '../api'

vi.mock('../api')

// StrictMode a propósito: en dev el efecto se monta dos veces y, como el token es de un
// solo uso, la pantalla debe hacer UNA sola petición.
const open = (route = '/verificar-correo?token=tok123') =>
  renderWithProviders(<StrictMode><AppRouter /></StrictMode>, { route })

describe('VerificarCorreoPage (HU2 / D8)', () => {
  it('enlace válido: confirma el correo y muestra el nuevo', async () => {
    api.verificarCorreo.mockResolvedValue({ id: 7, correo: 'nuevo@123.com', correo_pendiente: null })
    open()
    expect(await screen.findByRole('heading', { name: 'Correo verificado' })).toBeInTheDocument()
    expect(api.verificarCorreo).toHaveBeenCalledWith('tok123')
    expect(screen.getByText('nuevo@123.com')).toBeInTheDocument()
  })

  it('el token es de un solo uso: con StrictMode solo se hace una petición', async () => {
    api.verificarCorreo.mockResolvedValue({ id: 7, correo: 'nuevo@123.com' })
    open()
    await screen.findByRole('heading', { name: 'Correo verificado' })
    expect(api.verificarCorreo).toHaveBeenCalledTimes(1)
  })

  it('sin token en la URL: enlace no válido y sin llamar al backend', async () => {
    open('/verificar-correo')
    expect(await screen.findByRole('heading', { name: 'Enlace no válido' })).toBeInTheDocument()
    expect(api.verificarCorreo).not.toHaveBeenCalled()
  })

  it.each([400, 404, 410])('enlace vencido o ya usado (%i): explica qué hacer', async (status) => {
    api.verificarCorreo.mockRejectedValue(new ApiError({ status, message: 'x' }))
    open()
    expect(await screen.findByRole('heading', { name: 'Enlace no válido' })).toBeInTheDocument()
    expect(screen.getByText(/venció o ya fue utilizado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('error de red: permite reintentar con una petición nueva', async () => {
    api.verificarCorreo.mockRejectedValueOnce(new ApiError({ code: 'NETWORK_ERROR', message: 'Sin conexión' }))
      .mockResolvedValueOnce({ id: 7, correo: 'nuevo@123.com' })
    open()
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Correo verificado' })).toBeInTheDocument()
    expect(api.verificarCorreo).toHaveBeenCalledTimes(2)
  })

  it('sin sesión: el enlace lleva al login', async () => {
    api.verificarCorreo.mockResolvedValue({ id: 7, correo: 'nuevo@123.com' })
    open()
    expect(await screen.findByRole('link', { name: 'Ir a iniciar sesión' })).toHaveAttribute('href', '/login')
  })

  it('con sesión: el enlace lleva al perfil', async () => {
    seedSession({ rol: 'cliente' })
    api.verificarCorreo.mockResolvedValue({ id: 7, correo: 'nuevo@123.com' })
    open()
    expect(await screen.findByRole('link', { name: 'Ir a mi perfil' })).toHaveAttribute('href', '/perfil')
  })
})
