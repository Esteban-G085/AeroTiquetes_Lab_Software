import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders, seedSession, PERFIL_CLIENTE } from '@/test/helpers'
import { ApiError } from '@/services/apiError'
import * as api from '../api'

vi.mock('../api')

const open = async (route = '/perfil') => {
  renderWithProviders(<AppRouter />, { route })
  return screen.findByRole('heading', { level: 1 })
}

beforeEach(() => {
  seedSession({ rol: 'cliente' })
  api.obtenerPerfil.mockResolvedValue(PERFIL_CLIENTE)
})

describe('PerfilPage (HU2) — cliente', () => {
  it('muestra nombre, documento, datos y correo; pantalla completa sin barra', async () => {
    await open()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('María José Gómez Ríos')
    expect(screen.getByText('Documento: 11111')).toBeInTheDocument()
    expect(screen.getByText('10 de mayo de 1998')).toBeInTheDocument()
    expect(screen.getByText('Femenino')).toBeInTheDocument()
    expect(screen.getByText('usuario@123.com')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir menú' })).not.toBeInTheDocument()
  })

  it('el documento NO es editable: el formulario de edición no lo incluye', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Editar mis datos' }))
    expect(screen.getByLabelText('Nombres')).toBeInTheDocument()
    expect(screen.queryByLabelText(/documento|dni/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /correo/i })).not.toBeInTheDocument() // el correo no se edita aquí (D8)
  })

  it('editar y guardar: envía solo campos editables, relee /me y avisa', async () => {
    api.actualizarPerfil.mockResolvedValue({})
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Editar mis datos' }))
    const nombres = screen.getByLabelText('Nombres')
    await userEvent.clear(nombres)
    await userEvent.type(nombres, 'Laura')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(api.actualizarPerfil).toHaveBeenCalledTimes(1))
    const [sent, imagen] = api.actualizarPerfil.mock.calls[0]
    expect(Object.keys(sent).sort()).toEqual(
      ['apellidos', 'direccion_facturacion', 'fecha_nacimiento', 'genero', 'lugar_nacimiento', 'nombres'])
    expect(sent.nombres).toBe('Laura')
    expect(imagen).toBeNull()
    expect(await screen.findByText('Perfil actualizado')).toBeInTheDocument()
    expect(api.obtenerPerfil).toHaveBeenCalledTimes(2) // carga inicial + relectura tras guardar
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
  })

  it('validación: no guarda con datos inválidos', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Editar mis datos' }))
    await userEvent.clear(screen.getByLabelText('Nombres'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Este campo es obligatorio.')).toBeInTheDocument()
    expect(api.actualizarPerfil).not.toHaveBeenCalled()
  })

  it('cancelar descarta los cambios sin llamar a la API', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Editar mis datos' }))
    await userEvent.type(screen.getByLabelText('Nombres'), 'XYZ')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(api.actualizarPerfil).not.toHaveBeenCalled()
    expect(screen.getByText('Pereira')).toBeInTheDocument()
  })

  it('error del backend por campo se muestra en ese campo', async () => {
    api.actualizarPerfil.mockRejectedValue(new ApiError({ status: 422, fields: { lugar_nacimiento: 'Ciudad no reconocida' } }))
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Editar mis datos' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Ciudad no reconocida')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('"Cambiar contraseña" lleva a la pantalla de HU3', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(await screen.findByLabelText('Nueva contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toBeInTheDocument()
  })

  it('si falla la carga ofrece reintentar', async () => {
    api.obtenerPerfil.mockRejectedValueOnce(new ApiError({ code: 'NETWORK_ERROR', message: 'Sin conexión' }))
    renderWithProviders(<AppRouter />, { route: '/perfil' })
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Documento: 11111')).toBeInTheDocument()
  })

  it('correo pendiente de verificación se informa', async () => {
    api.obtenerPerfil.mockResolvedValue({ ...PERFIL_CLIENTE, correo_pendiente: 'nuevo@123.com' })
    await open()
    expect(screen.getByRole('status')).toHaveTextContent('nuevo@123.com')
  })
})

describe('Cambio de correo con verificación (D8)', () => {
  const openDialog = async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar correo' }))
    return screen.getByRole('dialog', { name: 'Cambiar correo electrónico' })
  }

  it('valida: correo distinto del actual y contraseña obligatoria', async () => {
    const dlg = await openDialog()
    await userEvent.type(within(dlg).getByLabelText('Correo nuevo'), 'usuario@123.com')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Enviar enlace' }))
    expect(within(dlg).getByText('Es el mismo correo que ya tienes.')).toBeInTheDocument()
    expect(within(dlg).getByText(/contraseña actual para confirmar/)).toBeInTheDocument()
    expect(api.solicitarCambioCorreo).not.toHaveBeenCalled()
  })

  it('envía correo nuevo + contraseña actual y avisa que debe verificar', async () => {
    api.solicitarCambioCorreo.mockResolvedValue({})
    const dlg = await openDialog()
    await userEvent.type(within(dlg).getByLabelText('Correo nuevo'), 'nuevo@123.com')
    await userEvent.type(within(dlg).getByLabelText('Contraseña actual'), 'Clave1234')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Enviar enlace' }))
    await waitFor(() => expect(api.solicitarCambioCorreo).toHaveBeenCalledWith(
      { correo_nuevo: 'nuevo@123.com', password_actual: 'Clave1234' }))
    expect(await screen.findByText(/Enviamos un enlace de verificación a nuevo@123.com/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cancelar cierra el diálogo y descarta lo escrito', async () => {
    const dlg = await openDialog()
    await userEvent.type(within(dlg).getByLabelText('Correo nuevo'), 'a@b.co')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar correo' }))
    expect(screen.getByLabelText('Correo nuevo')).toHaveValue('')
    expect(api.solicitarCambioCorreo).not.toHaveBeenCalled()
  })

  it('contraseña incorrecta: el error del backend queda en su campo y el diálogo sigue abierto', async () => {
    api.solicitarCambioCorreo.mockRejectedValue(new ApiError({ status: 400, fields: { password_actual: 'La contraseña no es correcta' } }))
    const dlg = await openDialog()
    await userEvent.type(within(dlg).getByLabelText('Correo nuevo'), 'nuevo@123.com')
    await userEvent.type(within(dlg).getByLabelText('Contraseña actual'), 'mala')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Enviar enlace' }))
    expect(await within(dlg).findByText('La contraseña no es correcta')).toBeInTheDocument()
  })
})

describe('PerfilPage — variante root', () => {
  beforeEach(() => {
    sessionStorage.clear()
    seedSession({ rol: 'root' }, { usuario: 'root' })
    api.obtenerPerfil.mockResolvedValue({ id: 'root', rol: 'root', usuario: 'root' })
  })

  it('solo Id y contraseña: sin datos personales, sin correo y sin edición', async () => {
    await open()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Root')
    expect(screen.getByText('Id: root')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contraseña' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Datos personales' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Correo electrónico' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar mis datos' })).not.toBeInTheDocument()
  })
})
