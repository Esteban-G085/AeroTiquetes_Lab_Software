import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { PERFIL_CLIENTE, renderWithProviders, seedSession, VUELO_EJEMPLO } from '@/test/helpers'
import * as api from '../api'

vi.mock('../api')

const VUELTA = {
  ...VUELO_EJEMPLO, id: 13, codigo: 'AT-205', origen: VUELO_EJEMPLO.destino, destino: VUELO_EJEMPLO.origen,
  salida: '2027-03-20T18:00:00-05:00', llegada: '2027-03-20T18:55:00-05:00', precio: 240000,
}
const type = (label, v) => userEvent.type(screen.getByLabelText(label), v)

async function open(vuelo = VUELO_EJEMPLO) {
  api.obtenerVuelo.mockResolvedValue(vuelo)
  renderWithProviders(<AppRouter />, { route: `/comprar/${vuelo.id}` })
  await screen.findByRole('heading', { level: 1, name: 'Bogotá a Medellín' })
}

async function llenarViajero() {
  await type('Documento', 'A12345')
  fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '1990-04-20' } })
  await type('Nombres', 'Ana María')
  await type('Apellidos', 'Gómez')
  await userEvent.selectOptions(screen.getByLabelText('Género'), 'femenino')
  await type('Teléfono', '3001234567')
  await type('Correo electrónico', 'ana@correo.com')
  await type('Nombre del contacto', 'Luis Gómez')
  await type('Teléfono del contacto', '3007654321')
}

beforeEach(() => {
  vi.clearAllMocks()
  seedSession({ rol: 'cliente' }, { nombres: 'Ana' })
  api.obtenerSaldo.mockResolvedValue({ saldo: 1_000_000, moneda: 'COP' })
})

describe('ReservaCompraPage (HU6 / HU7)', () => {
  it('muestra el vuelo y un resumen con el total antes de continuar', async () => {
    await open()
    expect(screen.getByText('Resumen')).toBeInTheDocument()
    expect(screen.getAllByText(/250\.000/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Agregar al carrito' })).toBeEnabled()
  })

  it('pide los 9 datos obligatorios del viajero y no agrega al carrito si faltan', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar al carrito' }))
    expect(await screen.findAllByText('Este campo es obligatorio.')).not.toHaveLength(0)
    expect(screen.getByText('Selecciona una opción.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mi carrito' })).not.toBeInTheDocument()
  })

  it('ya no hay paso de selección de sillas: la asignación es al azar al confirmar', async () => {
    await open()
    expect(screen.queryByText('Sillas')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Selección de sillas' })).not.toBeInTheDocument()
    expect(screen.getAllByText(/La silla se asigna al azar al confirmar/).length).toBeGreaterThan(0)
    await llenarViajero()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar al carrito' }))
    expect(await screen.findByRole('heading', { name: 'Mi carrito' })).toBeInTheDocument()
  })

  it('con los datos completos agrega el vuelo al carrito y abre el carrito', async () => {
    await open()
    await llenarViajero()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar al carrito' }))
    expect(await screen.findByRole('heading', { name: 'Mi carrito' })).toBeInTheDocument()
    const carrito = JSON.parse(sessionStorage.getItem('at.cart.v3'))
    expect(carrito[0].vuelo.id).toBe(12)
    expect(carrito[0]).not.toHaveProperty('asientos')
  })

  it('reservar sin pagar crea la reserva y muestra el código por viajero', async () => {
    api.crearReserva.mockResolvedValue({
      reservas: [{
        id: 5, vuelo: VUELO_EJEMPLO, clase: 'economica', expira_en: '2027-03-11T08:15:00-05:00',
        tiquetes: [{ id: 1, codigo_reserva: 'AB12CD', viajero: { nombres: 'Ana María', apellidos: 'Gómez' } }],
      }],
    })
    await open()
    await llenarViajero()
    await userEvent.click(screen.getByRole('button', { name: 'Reservar sin pagar' }))
    expect(await screen.findByRole('heading', { name: 'Reserva creada' })).toBeInTheDocument()
    expect(screen.getByLabelText('Código de reserva AB12CD')).toBeInTheDocument()
    expect(api.crearReserva).toHaveBeenCalledTimes(1)
    expect(api.crearReserva.mock.calls[0][0][0]).toMatchObject({ clase: 'economica' })
  })

  it('autocompleta al viajero 1 cuando su documento coincide con el de la cuenta, aunque esté normalizado', async () => {
    api.obtenerMisDatos.mockResolvedValue({ ...PERFIL_CLIENTE, telefono: '3001112233' })
    await open()
    await type('Documento', '11.111')
    fireEvent.blur(screen.getByLabelText('Documento'))

    expect(await screen.findByText(/Datos del viajero 1 completados desde tu cuenta/)).toBeInTheDocument()
    expect(screen.getByLabelText('Documento')).toHaveValue('11111')
    expect(screen.getByLabelText('Nombres')).toHaveValue('María José')
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Gómez Ríos')
    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveValue('1998-05-10')
    expect(screen.getByLabelText('Género')).toHaveValue('femenino')
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('usuario@123.com')
    expect(screen.getByLabelText('Teléfono')).toHaveValue('3001112233')
    expect(screen.getByLabelText('Nombre del contacto')).toHaveValue('María José Gómez Ríos')
  })

  it('autocompleta cualquier viajero, no solo el primero', async () => {
    api.obtenerMisDatos.mockResolvedValue(PERFIL_CLIENTE)
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar otro viajero' }))
    const documentos = screen.getAllByLabelText('Documento')
    await userEvent.type(documentos[1], '11111')
    fireEvent.blur(documentos[1])

    expect(await screen.findByText(/Datos del viajero 2 completados desde tu cuenta/)).toBeInTheDocument()
    expect(screen.getAllByLabelText('Nombres')[1]).toHaveValue('María José')
    expect(screen.getAllByLabelText('Nombres')[0]).toHaveValue('')
  })

  it('no completa nada si el documento es distinto al de la cuenta', async () => {
    api.obtenerMisDatos.mockResolvedValue(PERFIL_CLIENTE)
    await open()
    await type('Documento', 'ZZ999')
    fireEvent.blur(screen.getByLabelText('Documento'))
    expect(screen.queryByText(/completados desde tu cuenta/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nombres')).toHaveValue('')
  })

  it('un menor de edad no puede ser el único viajero', async () => {
    await open()
    await llenarViajero()
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '2015-01-01' } })
    await userEvent.click(screen.getByRole('button', { name: 'Agregar al carrito' }))
    expect(await screen.findByText(/menor de edad no puede viajar solo/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mi carrito' })).not.toBeInTheDocument()
    expect(api.crearReserva).not.toHaveBeenCalled()
  })

  it('si ya tiene 5 tiquetes en el vuelo, avisa y bloquea las acciones', async () => {
    await open({ ...VUELO_EJEMPLO, tiquetes_cliente: 5 })
    expect(screen.getByText(/Ya tienes 5 tiquetes en este vuelo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar al carrito' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reservar sin pagar' })).toBeDisabled()
  })

  it('"Ida y vuelta" ofrece los vuelos de regreso y exige elegir uno', { timeout: 15000 }, async () => {
    api.listarVuelosRegreso.mockResolvedValue([VUELTA])
    await open()
    await userEvent.click(screen.getByLabelText('Ida y vuelta'))
    expect(await screen.findByText('AT-205')).toBeInTheDocument()
    await llenarViajero()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar al carrito' }))
    expect(await screen.findByText(/Elige el vuelo de regreso/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /AT-205/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Agregar al carrito' }))
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem('at.cart.v3'))).toHaveLength(2))
  })

  it('si el vuelo no existe, lo dice y ofrece buscar otros', async () => {
    const { ApiError } = await import('@/services/apiError')
    api.obtenerVuelo.mockRejectedValue(new ApiError({ status: 404, message: 'No encontrado' }))
    renderWithProviders(<AppRouter />, { route: '/comprar/999' })
    expect(await screen.findByText('Este vuelo ya no está disponible')).toBeInTheDocument()
  })
})

describe('permisos de la compra', () => {
  it('un administrador no puede comprar ni reservar (SRS Usuarios RF11)', async () => {
    seedSession({ rol: 'administrador' })
    renderWithProviders(<AppRouter />, { route: '/comprar/12' })
    expect(await screen.findByText('No tienes acceso a esta sección')).toBeInTheDocument()
    expect(api.obtenerVuelo).not.toHaveBeenCalled()
  })

  it('un visitante debe iniciar sesión para comprar (SRS Usuarios RF12)', async () => {
    sessionStorage.clear()
    renderWithProviders(<AppRouter />, { route: '/comprar/12' })
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})
