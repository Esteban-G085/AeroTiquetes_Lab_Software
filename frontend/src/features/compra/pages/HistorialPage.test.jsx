import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders, seedSession, VUELO_EJEMPLO } from '@/test/helpers'
import * as api from '../api'

vi.mock('../api')

const H = 3_600_000
const en = (horas) => new Date(Date.now() + horas * H).toISOString()
const viajero = { nombres: 'Ana María', apellidos: 'Gómez', documento: 'A12345' }
const tiquete = (id, codigo, extra = {}) => ({ id, codigo_reserva: codigo, viajero, ...extra })
const compra = (id, extra = {}) => ({ id, vuelo: { ...VUELO_EJEMPLO, salida: en(30), llegada: en(31) }, clase: 'economica', estado: 'confirmada', total: 250000, tiquetes: [tiquete(1, 'AB12CD')], ...extra })
const reserva = (id, extra = {}) => ({
  id, vuelo: { ...VUELO_EJEMPLO, salida: en(72), llegada: en(73) }, clase: 'economica', estado: 'activa', expira_en: en(5),
  tiquetes: [tiquete(9, 'ZZ99XX')], ...extra,
})

const open = async (historial) => {
  api.obtenerHistorial.mockResolvedValue(historial)
  renderWithProviders(<AppRouter />, { route: '/mis-viajes' })
  await screen.findByRole('heading', { name: 'Mis viajes' })
}

beforeEach(() => seedSession({ rol: 'cliente' }, { nombres: 'Ana' }))

describe('HistorialPage (HU9)', () => {
  it('lista las compras con su estado y el código de cada tiquete', async () => {
    await open({ compras: [compra(1), compra(2, { estado: 'cancelada', reintegro: 250000, tiquetes: [tiquete(3, 'CC33DD')] })], reservas: [] })
    expect(await screen.findByText('AB12CD')).toBeInTheDocument()
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
    expect(screen.getByText('Cancelada')).toBeInTheDocument()
  })

  it('el filtro "Canceladas" deja solo las canceladas', async () => {
    await open({ compras: [compra(1), compra(2, { estado: 'cancelada', tiquetes: [tiquete(3, 'CC33DD')] })], reservas: [] })
    await userEvent.click(await screen.findByRole('button', { name: 'Canceladas' }))
    expect(screen.getByText('CC33DD')).toBeInTheDocument()
    expect(screen.queryByText('AB12CD')).not.toBeInTheDocument()
  })

  it('una compra activa ofrece cancelar y ver el detalle; el check-in y las sillas son de la Iteración 3', async () => {
    await open({ compras: [compra(1)], reservas: [] })
    expect(await screen.findByRole('button', { name: 'Cancelar compra' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver detalle del tiquete AB12CD' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Check-in|silla/i })).not.toBeInTheDocument()
  })

  it('RF15: cancelar la compra pide confirmación y reintegra a la billetera', async () => {
    api.cancelarCompra.mockResolvedValue({ reintegro: 250000, saldo: 900000 })
    await open({ compras: [compra(1)], reservas: [] })
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar compra' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Te reintegramos/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar compra' }))
    expect(api.cancelarCompra).toHaveBeenCalledWith(1)
    expect(await screen.findByText(/Reintegramos/)).toBeInTheDocument()
  })

  it('RF15: a menos de 1 hora del vuelo ya no se puede cancelar y se explica por qué', async () => {
    await open({ compras: [compra(1, { vuelo: { ...VUELO_EJEMPLO, salida: en(0.5), llegada: en(1.5) } })], reservas: [] })
    expect(await screen.findByText(/Ya no se puede cancelar/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar compra' })).not.toBeInTheDocument()
  })

  it('la pestaña Reservas muestra cuánto falta para que venza y permite pagar o cancelar', async () => {
    await open({ compras: [], reservas: [reserva(5)] })
    await userEvent.click(await screen.findByRole('tab', { name: /Reservas/ }))
    expect(await screen.findByText(/Vence en/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pagar reserva' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument()
  })

  it('una reserva cuyo plazo ya pasó figura como vencida y no tiene acciones', async () => {
    await open({ compras: [], reservas: [reserva(5, { expira_en: en(-1) })] })
    await userEvent.click(await screen.findByRole('tab', { name: /Reservas/ }))
    expect(await screen.findByText('Vencida')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument()
  })

  it('"Ver detalle" abre los datos del tiquete', async () => {
    await open({ compras: [compra(1)], reservas: [] })
    await userEvent.click(await screen.findByRole('button', { name: 'Ver detalle del tiquete AB12CD' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Detalle del tiquete')).toBeInTheDocument()
    expect(within(dialog).getByText('A12345')).toBeInTheDocument()
  })

  it('sin compras explica y ofrece buscar vuelos', async () => {
    await open({ compras: [], reservas: [] })
    expect(await screen.findByText('Aún no tienes compras')).toBeInTheDocument()
  })
})
