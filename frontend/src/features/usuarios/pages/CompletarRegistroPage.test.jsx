import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders } from '@/test/helpers'
import { ApiError } from '@/services/apiError'
import * as api from '../api'

vi.mock('../api')

const open = (route = '/completar-registro?token=tok123') => renderWithProviders(<AppRouter />, { route })
const type = (label, v) => userEvent.type(screen.getByLabelText(label), v)

describe('CompletarRegistroPage (HU23 / D6)', () => {
  it('con enlace válido: precarga correo (bloqueado) y nombre, y reutiliza el formulario de registro', async () => {
    api.validarInvitacion.mockResolvedValue({ correo: 'camila@123.com', nombre: 'Camila' })
    open()
    expect(await screen.findByRole('heading', { name: 'Completar registro' })).toBeInTheDocument()
    expect(api.validarInvitacion).toHaveBeenCalledWith('tok123')
    expect(screen.getByLabelText('Correo')).toHaveValue('camila@123.com')
    expect(screen.getByLabelText('Correo')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Nombres')).toHaveValue('Camila')
    for (const l of ['Apellidos', 'Documento (DNI)', 'Fecha de nacimiento', 'Lugar de nacimiento', 'Dirección de facturación', 'Género', 'Usuario', 'Contraseña']) {
      expect(screen.getByLabelText(l)).toBeInTheDocument()
    }
  })

  it('el correo bloqueado no se valida como obligatorio aunque falle otro campo', async () => {
    api.validarInvitacion.mockResolvedValue({ correo: 'camila@123.com', nombre: '' })
    open()
    await screen.findByRole('heading', { name: 'Completar registro' })
    await userEvent.click(screen.getByRole('button', { name: 'Completar registro' }))
    expect(screen.getAllByText(/obligatorio|Selecciona una opción/i).length).toBeGreaterThanOrEqual(8)
    expect(api.completarRegistro).not.toHaveBeenCalled()
  })

  it('éxito: envía token + datos, avisa y lleva al login', async () => {
    api.validarInvitacion.mockResolvedValue({ correo: 'camila@123.com', nombre: 'Camila' })
    api.completarRegistro.mockResolvedValue({})
    open()
    await screen.findByRole('heading', { name: 'Completar registro' })
    await type('Apellidos', 'Torres')
    await type('Documento (DNI)', '1088123456')
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '1995-03-02' } })
    await type('Lugar de nacimiento', 'Pereira')
    await type('Dirección de facturación', 'Cra 8 # 20-15')
    await userEvent.selectOptions(screen.getByLabelText('Género'), 'femenino')
    await type('Usuario', 'camila.t')
    await type('Contraseña', 'Clave1234')
    await userEvent.click(screen.getByRole('button', { name: 'Completar registro' }))

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByText(/Registro completado/)).toBeInTheDocument()
    expect(api.completarRegistro).toHaveBeenCalledWith(
      'tok123', expect.objectContaining({ correo: 'camila@123.com', nombres: 'Camila', apellidos: 'Torres', usuario: 'camila.t' }), null)
  })

  it.each([404, 410, 400])('enlace vencido o ya usado (%i): explica qué hacer y no muestra el formulario', async (status) => {
    api.validarInvitacion.mockRejectedValue(new ApiError({ status, message: 'x' }))
    open()
    expect(await screen.findByRole('heading', { name: 'Enlace no válido' })).toBeInTheDocument()
    expect(screen.getByText(/venció o ya fue utilizado/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombres')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a iniciar sesión' })).toHaveAttribute('href', '/login')
  })

  it('sin token en la URL: enlace no válido y sin llamar al backend', async () => {
    open('/completar-registro')
    expect(await screen.findByRole('heading', { name: 'Enlace no válido' })).toBeInTheDocument()
    expect(api.validarInvitacion).not.toHaveBeenCalled()
  })

  it('error de red al validar: permite reintentar', async () => {
    api.validarInvitacion.mockRejectedValueOnce(new ApiError({ code: 'NETWORK_ERROR', message: 'Sin conexión' }))
      .mockResolvedValueOnce({ correo: 'camila@123.com', nombre: 'Camila' })
    open()
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Completar registro' })).toBeInTheDocument()
  })

  it('si el token vence mientras se llena el formulario, se informa', async () => {
    api.validarInvitacion.mockResolvedValue({ correo: 'camila@123.com', nombre: 'Camila' })
    api.completarRegistro.mockRejectedValue(new ApiError({ status: 410, message: 'El enlace venció' }))
    open()
    await screen.findByRole('heading', { name: 'Completar registro' })
    await type('Apellidos', 'Torres')
    await type('Documento (DNI)', '1088123456')
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '1995-03-02' } })
    await type('Lugar de nacimiento', 'Pereira')
    await type('Dirección de facturación', 'Cra 8')
    await userEvent.selectOptions(screen.getByLabelText('Género'), 'otro')
    await type('Usuario', 'camila.t')
    await type('Contraseña', 'Clave1234')
    await userEvent.click(screen.getByRole('button', { name: 'Completar registro' }))
    await waitFor(() => expect(screen.getByText('El enlace venció')).toBeInTheDocument())
  })
})
