import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { ApiError } from '@/services/apiError'
import { renderWithProviders, seedSession, VUELO_EJEMPLO } from '@/test/helpers'
import * as api from '../api'

vi.mock('../api')

const VIAJERO = {
  documento: 'A12345', nombres: 'Ana María', apellidos: 'Gómez', fecha_nacimiento: '1990-04-20', genero: 'femenino',
  telefono: '3001234567', correo: 'ana@correo.com', contacto_nombre: 'Luis', contacto_telefono: '3007654321',
}
const ITEM = { vuelo: VUELO_EJEMPLO, clase: 'economica', tramo: 'ida', viajeros: [VIAJERO, { ...VIAJERO, documento: 'B67890', nombres: 'Luis' }] }
const open = () => renderWithProviders(<AppRouter />, { route: '/carrito' })

beforeEach(() => {
  vi.clearAllMocks()
  seedSession({ rol: 'cliente' }, { nombres: 'Ana' })
  api.obtenerSaldo.mockResolvedValue({ saldo: 1_000_000, moneda: 'COP' })
})

describe('CarritoPage (HU7)', () => {
  it('con el carrito vacío lo dice y ofrece buscar vuelos', async () => {
    open()
    expect(await screen.findByText('Tu carrito está vacío')).toBeInTheDocument()
    // La navegación principal también tiene un enlace «Buscar vuelos»: se busca el del contenido.
    const enlaces = screen.getAllByRole('link', { name: 'Buscar vuelos' })
    expect(enlaces.length).toBeGreaterThan(0)
    enlaces.forEach((e) => expect(e).toHaveAttribute('href', '/'))
  })

  it('lista los vuelos con viajeros y muestra el total (precio × viajeros) y el saldo', async () => {
    sessionStorage.setItem('at.cart.v3', JSON.stringify([ITEM]))
    open()
    expect(await screen.findByText('Saldo disponible')).toBeInTheDocument()
    expect(screen.getAllByText(/500\.000/).length).toBeGreaterThan(0) // 2 × 250.000
    expect(screen.getByText(/Ana María Gómez/)).toBeInTheDocument()
    expect(await screen.findByText(/1\.000\.000/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
  })

  it('RF14–RF16: con saldo insuficiente avisa cuánto falta y no deja comprar', async () => {
    api.obtenerSaldo.mockResolvedValue({ saldo: 100_000, moneda: 'COP' })
    sessionStorage.setItem('at.cart.v3', JSON.stringify([ITEM]))
    open()
    expect(await screen.findByText(/Tu saldo es insuficiente/)).toBeInTheDocument()
    expect(screen.getByText(/400\.000/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Agregar saldo' })).toHaveAttribute('href', '/billetera')
  })

  it('quitar un vuelo pide confirmación y lo saca del carrito', async () => {
    sessionStorage.setItem('at.cart.v3', JSON.stringify([ITEM]))
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar vuelo AT-204' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Quitar' }))
    expect(await screen.findByText('Tu carrito está vacío')).toBeInTheDocument()
  })

  it('confirmar la compra paga con la billetera y muestra códigos, total y saldo', async () => {
    api.crearCompra.mockResolvedValue({
      total: 500000, saldo: 500000, correo: 'ana@correo.com',
      compras: [{
        id: 1, vuelo: VUELO_EJEMPLO, clase: 'economica', total: 500000,
        tiquetes: [
          { id: 1, codigo_reserva: 'AB12CD', viajero: { nombres: 'Ana María', apellidos: 'Gómez' } },
          { id: 2, codigo_reserva: 'EF34GH', viajero: { nombres: 'Luis', apellidos: 'Gómez' } },
        ],
      }],
    })
    sessionStorage.setItem('at.cart.v3', JSON.stringify([ITEM]))
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar compra' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /^Pagar/ }))

    expect(await screen.findByRole('heading', { name: 'Compra confirmada' })).toBeInTheDocument()
    expect(screen.getByLabelText('Código de reserva AB12CD')).toBeInTheDocument()
    expect(screen.getByLabelText('Código de reserva EF34GH')).toBeInTheDocument()
    expect(screen.getByText('Total gastado')).toBeInTheDocument()
    expect(screen.getByText('Saldo restante')).toBeInTheDocument()
    expect(screen.getByText('ana@correo.com')).toBeInTheDocument()
    expect(api.crearCompra).toHaveBeenCalledWith([ITEM])
    expect(JSON.parse(sessionStorage.getItem('at.cart.v3'))).toEqual([]) // el carrito queda vacío
  })

  it('si el backend rechaza la compra, muestra el motivo y conserva el carrito', async () => {
    api.crearCompra.mockRejectedValue(new ApiError({ status: 409, code: 'CUPO_AGOTADO', message: 'El vuelo AT-204 no tiene cupos suficientes.' }))
    sessionStorage.setItem('at.cart.v3', JSON.stringify([ITEM]))
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar compra' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^Pagar/ }))
    expect(await screen.findByText('El vuelo AT-204 no tiene cupos suficientes.')).toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('at.cart.v3'))).toHaveLength(1)
  })

  it('no pide elegir sillas: el pago queda habilitado sin revalidar asientos', async () => {
    sessionStorage.setItem('at.cart.v3', JSON.stringify([ITEM]))
    open()
    expect(await screen.findByText('Saldo disponible')).toBeInTheDocument()
    expect(screen.queryByText(/Elegir otras sillas/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
  })

  it('el ícono del carrito de la cabecera dice cuántos tiquetes hay', async () => {
    sessionStorage.setItem('at.cart.v3', JSON.stringify([ITEM]))
    open()
    expect(await screen.findByRole('link', { name: 'Carrito, 2 tiquetes' })).toBeInTheDocument()
  })
})
