import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders, seedSession } from '@/test/helpers'
import { ApiError } from '@/services/apiError'
import * as api from '../api'

vi.mock('../api')

const ADMINS = [
  { id: 1, nombre: 'Jose Luis', correo: 'jose1@123.com', estado: 'activo', imagen_url: null },
  { id: 3, nombre: 'Camila Torres', correo: 'camila@123.com', estado: 'pendiente', imagen_url: null },
]

const open = async () => {
  renderWithProviders(<AppRouter />, { route: '/root/administradores' })
  await screen.findByText('Administradores actuales')
}
const type = (label, v) => userEvent.type(screen.getByLabelText(label), v)

beforeEach(() => {
  seedSession({ rol: 'root' }, { usuario: 'root' })
  api.listarAdministradores.mockResolvedValue(ADMINS)
})

describe('AdministradoresPage (HU23)', () => {
  it('lista administradores con su estado (activo / pendiente)', async () => {
    await open()
    expect(await screen.findByText('Jose Luis')).toBeInTheDocument()
    expect(screen.getByText('jose1@123.com')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('solo pide nombre y correo; no hay botón de editar', async () => {
    await open()
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo')).toBeInTheDocument()
    expect(screen.queryByLabelText(/documento|dni|contraseña/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
  })

  it('crear: valida, envía, avisa que se mandó el enlace, limpia el formulario y recarga la lista', async () => {
    api.crearAdministrador.mockResolvedValue({})
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Crear administrador' }))
    expect(screen.getAllByText('Este campo es obligatorio.')).toHaveLength(2) // nombre y correo
    expect(api.crearAdministrador).not.toHaveBeenCalled()

    await type('Nombre', 'Nuevo Admin')
    await type('Correo', 'nuevo@123.com')
    await userEvent.click(screen.getByRole('button', { name: 'Crear administrador' }))

    await waitFor(() => expect(api.crearAdministrador).toHaveBeenCalledWith({ nombre: 'Nuevo Admin', correo: 'nuevo@123.com' }))
    expect(await screen.findByText(/enlace de primer ingreso a nuevo@123.com/)).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('')
    await waitFor(() => expect(api.listarAdministradores).toHaveBeenCalledTimes(2))
  })

  it('correo duplicado (409) se muestra en el campo correo', async () => {
    api.crearAdministrador.mockRejectedValue(new ApiError({ status: 409, fields: { correo: 'Ese correo ya existe' } }))
    await open()
    await type('Nombre', 'Otro')
    await type('Correo', 'jose1@123.com')
    await userEvent.click(screen.getByRole('button', { name: 'Crear administrador' }))
    expect(await screen.findByText('Ese correo ya existe')).toBeInTheDocument()
  })

  it('eliminar pide confirmación y no llama a la API si se cancela', async () => {
    await open()
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar a Jose Luis' }))
    const dlg = screen.getByRole('dialog', { name: 'Eliminar administrador' })
    expect(within(dlg).getByText(/Jose Luis \(jose1@123.com\)/)).toBeInTheDocument()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.eliminarAdministrador).not.toHaveBeenCalled()
  })

  it('confirmar eliminación: llama a la API con el id, avisa y recarga', async () => {
    api.eliminarAdministrador.mockResolvedValue()
    await open()
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar a Jose Luis' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(api.eliminarAdministrador).toHaveBeenCalledWith(1))
    expect(await screen.findByText('Jose Luis fue eliminado.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(api.listarAdministradores).toHaveBeenCalledTimes(2))
  })

  it('eliminar un pendiente avisa que su enlace dejará de funcionar', async () => {
    await open()
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar a Camila Torres' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Su enlace de primer ingreso dejará de funcionar')
  })

  it('error al eliminar: avisa y deja el diálogo abierto para reintentar', async () => {
    api.eliminarAdministrador.mockRejectedValue(new ApiError({ status: 500, message: 'Falló el servidor' }))
    await open()
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar a Jose Luis' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText('Falló el servidor')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('lista vacía y error de carga con reintento', async () => {
    api.listarAdministradores.mockResolvedValueOnce([])
    await open()
    expect(await screen.findByText(/Aún no hay administradores/)).toBeInTheDocument()
  })

  it('error de carga ofrece reintentar', async () => {
    api.listarAdministradores.mockRejectedValueOnce(new ApiError({ code: 'NETWORK_ERROR', message: 'Sin conexión' }))
    renderWithProviders(<AppRouter />, { route: '/root/administradores' })
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Jose Luis')).toBeInTheDocument()
  })
})

describe('Acceso al panel', () => {
  it('un administrador no entra a /root/administradores (403)', async () => {
    sessionStorage.clear()
    seedSession({ rol: 'administrador' })
    renderWithProviders(<AppRouter />, { route: '/root/administradores' })
    expect(await screen.findByText('No tienes acceso a esta sección')).toBeInTheDocument()
    expect(api.listarAdministradores).not.toHaveBeenCalled()
  })
})
