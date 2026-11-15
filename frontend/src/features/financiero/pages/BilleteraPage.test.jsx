import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders, seedSession } from '@/test/helpers'
import * as api from '../api'

vi.mock('../api')

const TARJETA = { id: 1, tipo: 'credito', numero: '4111111111111111', titular: 'María José Gómez', vencimiento: '12/29' }
const type = (label, v) => userEvent.type(screen.getByLabelText(label), v)

const open = async () => {
  renderWithProviders(<AppRouter />, { route: '/billetera' })
  await screen.findByRole('heading', { name: 'Mi billetera' })
}

beforeEach(() => {
  seedSession({ rol: 'cliente' }, { nombres: 'Ana' })
  api.obtenerBilletera.mockResolvedValue({ saldo: 500000, moneda: 'COP' })
  api.listarTarjetas.mockResolvedValue([TARJETA])
})

describe('BilleteraPage (HU15–HU17)', () => {
  it('muestra el saldo y permite ocultarlo', async () => {
    await open()
    expect((await screen.findAllByText(/500\.000/)).length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar saldo' }))
    expect(screen.getByText(/••••••/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mostrar saldo' })).toBeInTheDocument()
  })

  it('las tarjetas se ven enmascaradas: nunca el número completo', async () => {
    await open()
    expect(await screen.findByLabelText(/Tarjeta Crédito •••• 1111/)).toBeInTheDocument()
    expect(screen.queryByText(/4111111111111111/)).not.toBeInTheDocument()
  })

  it('agregar saldo valida que el monto sea mayor a 0', async () => {
    await open()
    await type('Monto a agregar', '0')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(await screen.findByText('El monto debe ser mayor a 0.')).toBeInTheDocument()
    expect(api.agregarSaldo).not.toHaveBeenCalled()
  })

  it('agrega saldo con un monto sugerido y refresca la billetera', async () => {
    api.agregarSaldo.mockResolvedValue({ saldo: 550000 })
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /50\.000/ }))
    expect(screen.getByLabelText('Monto a agregar')).toHaveValue('50000')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(api.agregarSaldo).toHaveBeenCalledWith(50000)
    expect(api.obtenerBilletera).toHaveBeenCalledTimes(2)
  })

  it('establecer saldo (RF03) acepta 0 y usa otra operación', async () => {
    api.establecerSaldo.mockResolvedValue({ saldo: 0 })
    await open()
    await userEvent.click(await screen.findByRole('button', { name: 'Establecer saldo' }))
    await type('Nuevo saldo', '0')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(api.establecerSaldo).toHaveBeenCalledWith(0)
  })

  it('registrar una tarjeta valida los campos antes de enviar', async () => {
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /Agregar tarjeta/ }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar tarjeta' }))
    expect(await within(dialog).findAllByText('Este campo es obligatorio.')).not.toHaveLength(0)
    expect(api.crearTarjeta).not.toHaveBeenCalled()
  })

  it('registra una tarjeta válida y recarga la lista', async () => {
    api.crearTarjeta.mockResolvedValue({ ...TARJETA, id: 2 })
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /Agregar tarjeta/ }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText('Tipo de tarjeta'), 'debito')
    await userEvent.type(within(dialog).getByLabelText('Número de la tarjeta'), '5500000000000004')
    await userEvent.type(within(dialog).getByLabelText('Nombre del titular'), 'María José Gómez')
    await userEvent.type(within(dialog).getByLabelText('Vencimiento'), '12/29')
    await userEvent.type(within(dialog).getByLabelText('Código de seguridad'), '123')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar tarjeta' }))
    expect(api.crearTarjeta).toHaveBeenCalledTimes(1)
    expect(api.crearTarjeta.mock.calls[0][0]).toMatchObject({ tipo: 'debito', numero: '5500000000000004' })
    expect(api.listarTarjetas).toHaveBeenCalledTimes(2)
  })

  it('eliminar una tarjeta pide confirmación', async () => {
    api.eliminarTarjeta.mockResolvedValue()
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /Eliminar tarjeta •••• 1111/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/no se puede deshacer/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
    expect(api.eliminarTarjeta).toHaveBeenCalledWith(1)
  })

  it('no muestra historial de movimientos ni comprobantes (SRS RF19 y RF20)', async () => {
    await open()
    expect(screen.queryByText(/movimientos|comprobante/i)).not.toBeInTheDocument()
  })

  it('es solo para clientes: un administrador no entra', async () => {
    seedSession({ rol: 'administrador' })
    renderWithProviders(<AppRouter />, { route: '/billetera' })
    expect(await screen.findByText('No tienes acceso a esta sección')).toBeInTheDocument()
  })
})
