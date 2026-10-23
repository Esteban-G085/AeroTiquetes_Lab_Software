import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders, seedSession, PERFIL_CLIENTE } from '@/test/helpers'
import { ApiError } from '@/services/apiError'
import * as api from '../api'

vi.mock('../api')

const open = async () => {
  renderWithProviders(<AppRouter />, { route: '/perfil/password' })
  await screen.findByLabelText('Contraseña actual')
}
const type = (label, v) => userEvent.type(screen.getByLabelText(label), v)
const save = () => userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

beforeEach(() => {
  seedSession({ rol: 'cliente' })
  api.obtenerPerfil.mockResolvedValue(PERFIL_CLIENTE)
  api.listarPaises.mockResolvedValue([{ id: 1, nombre: 'Colombia' }, { id: 2, nombre: 'Perú' }])
})

describe('CambiarPasswordPage (HU3)', () => {
  it('muestra la identidad del usuario y los tres campos', async () => {
    await open()
    expect(await screen.findByText('Documento: 11111')).toBeInTheDocument()
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toBeInTheDocument()
  })

  it('valida campos vacíos sin llamar a la API', async () => {
    await open()
    await save()
    expect(screen.getByText('Escribe tu contraseña actual.')).toBeInTheDocument()
    expect(api.cambiarPassword).not.toHaveBeenCalled()
  })

  it('la confirmación debe coincidir', async () => {
    await open()
    await type('Contraseña actual', 'Vieja1234')
    await type('Nueva contraseña', 'Nueva5678')
    await type('Confirmar nueva contraseña', 'Nueva5679')
    await save()
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(api.cambiarPassword).not.toHaveBeenCalled()
  })

  it('éxito: envía actual + nueva (sin la confirmación), avisa y vuelve al perfil', async () => {
    api.cambiarPassword.mockResolvedValue({})
    await open()
    await type('Contraseña actual', 'Vieja1234')
    await type('Nueva contraseña', 'Nueva5678')
    await type('Confirmar nueva contraseña', 'Nueva5678')
    await save()
    await waitFor(() => expect(api.cambiarPassword).toHaveBeenCalledWith(
      { password_actual: 'Vieja1234', password_nueva: 'Nueva5678' }))
    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Datos personales' })).toBeInTheDocument()
  })

  it('contraseña actual incorrecta: el backend la rechaza y el error queda en el campo', async () => {
    api.cambiarPassword.mockRejectedValue(new ApiError({ status: 400, fields: { password_actual: 'La contraseña actual no coincide' } }))
    await open()
    await type('Contraseña actual', 'Mala12345')
    await type('Nueva contraseña', 'Nueva5678')
    await type('Confirmar nueva contraseña', 'Nueva5678')
    await save()
    expect(await screen.findByText('La contraseña actual no coincide')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('error sin campos (red): aviso general', async () => {
    api.cambiarPassword.mockRejectedValue(new ApiError({ code: 'NETWORK_ERROR', message: 'Sin conexión con el servidor' }))
    await open()
    await type('Contraseña actual', 'Vieja1234')
    await type('Nueva contraseña', 'Nueva5678')
    await type('Confirmar nueva contraseña', 'Nueva5678')
    await save()
    expect(await screen.findByText('Sin conexión con el servidor')).toBeInTheDocument()
  })

  it('no se bloquea si falla la carga del perfil (solo afecta al encabezado)', async () => {
    api.obtenerPerfil.mockRejectedValue(new ApiError({ code: 'NETWORK_ERROR', message: 'x' }))
    await open()
    expect(screen.getByLabelText('Contraseña actual')).toBeEnabled()
  })

  it('Cancelar y Atrás regresan al perfil', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByRole('heading', { name: 'Datos personales' })).toBeInTheDocument()
  })
})
