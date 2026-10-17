import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders } from '@/test/helpers'
import { ApiError } from '@/services/apiError'
import * as api from '../api'

vi.mock('../api')

const open = async () => {
  renderWithProviders(<AppRouter />, { route: '/registro' })
  await screen.findByRole('heading', { name: 'Registro' })
}
const type = (label, value) => userEvent.type(screen.getByLabelText(label), value)

async function fillValid() {
  await type('Nombres', 'María José')
  await type('Apellidos', 'Gómez')
  await type('Documento (DNI)', '1088123456')
  fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '1998-05-10' } })
  await type('Lugar de nacimiento', 'Pereira')
  await type('Dirección de facturación', 'Cra 8 # 20-15')
  await userEvent.selectOptions(screen.getByLabelText('Género'), 'femenino')
  await type('Correo', 'maria@correo.com')
  await type('Usuario', 'maria.j')
  await type('Contraseña', 'Clave1234')
}
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Registrarse' }))

describe('RegistroPage (HU4)', () => {
  it('muestra los 10 campos, el selector de foto y la pantalla es completa (sin barra)', async () => {
    await open()
    for (const l of ['Nombres', 'Apellidos', 'Documento (DNI)', 'Fecha de nacimiento', 'Lugar de nacimiento',
      'Dirección de facturación', 'Género', 'Correo', 'Usuario', 'Contraseña']) {
      expect(screen.getByLabelText(l)).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Elegir foto de perfil' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir menú' })).not.toBeInTheDocument()
  })

  it('vacío: marca todos los campos, no llama a la API y enfoca el primero', async () => {
    await open()
    await submit()
    expect(screen.getAllByText(/obligatorio|Selecciona una opción/i).length).toBeGreaterThanOrEqual(9)
    expect(api.registrarCliente).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByLabelText('Nombres')).toHaveFocus())
  })

  it('el error de un campo desaparece al corregirlo', async () => {
    await open()
    await type('Correo', 'mal')
    await submit()
    expect(screen.getByText('Escribe un correo válido.')).toBeInTheDocument()
    await type('Correo', '@correo.com')
    expect(screen.queryByText('Escribe un correo válido.')).not.toBeInTheDocument()
  })

  it('foto: rechaza formatos no permitidos y permite quitarla', async () => {
    await open()
    const input = screen.getByLabelText('Archivo de foto de perfil')
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(input, new File(['x'], 'a.gif', { type: 'image/gif' }))
    expect(await screen.findByText('La foto debe ser JPG o PNG.')).toBeInTheDocument()

    await user.upload(input, new File(['x'], 'a.png', { type: 'image/png' }))
    expect(screen.queryByText('La foto debe ser JPG o PNG.')).not.toBeInTheDocument()
    expect(screen.getByAltText(/vista previa/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar foto' }))
    expect(screen.queryByAltText(/vista previa/i)).not.toBeInTheDocument()
  })

  it('éxito: envía los datos, avisa y lleva al login', async () => {
    api.registrarCliente.mockResolvedValue({ id: 1 })
    await open()
    await fillValid()
    await submit()
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByText(/Cuenta creada/)).toBeInTheDocument()
    expect(api.registrarCliente).toHaveBeenCalledWith(
      expect.objectContaining({ dni: '1088123456', correo: 'maria@correo.com', genero: 'femenino', password: 'Clave1234' }),
      null,
    )
  })

  it('duplicados del backend (409): se pintan en el campo correspondiente', async () => {
    api.registrarCliente.mockRejectedValue(new ApiError({
      status: 409, code: 'DUPLICADO', message: 'Datos ya registrados',
      fields: { correo: 'Este correo ya está registrado', usuario: 'Ese usuario ya existe', inventado: 'x' },
    }))
    await open()
    await fillValid()
    await submit()
    expect(await screen.findByText('Este correo ya está registrado')).toBeInTheDocument()
    expect(screen.getByText('Ese usuario ya existe')).toBeInTheDocument()
    expect(screen.getByText('Revisa los campos marcados.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrarse' })).toBeEnabled()
  })

  it('error sin campos (red/servidor): aviso general y se conservan los datos', async () => {
    api.registrarCliente.mockRejectedValue(new ApiError({ code: 'NETWORK_ERROR', message: 'No pudimos conectar con el servidor. Revisa tu conexión.' }))
    await open()
    await fillValid()
    await submit()
    expect(await screen.findByText(/No pudimos conectar/)).toBeInTheDocument()
    expect(screen.getByLabelText('Usuario')).toHaveValue('maria.j')
  })

  it('enlaza de vuelta al login', async () => {
    await open()
    expect(screen.getByRole('link', { name: /Inicia sesión/ })).toHaveAttribute('href', '/login')
  })
})
