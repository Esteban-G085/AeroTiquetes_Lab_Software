import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders, seedSession } from '@/test/helpers'
import { ApiError } from '@/services/apiError'
import * as api from '../api'

vi.mock('../api')

// La API nunca devuelve el número completo: `numero` ya son los últimos 4 (ver adaptarTarjeta).
const TARJETA = { id: 1, tipo: 'credito', marca: 'Visa', numero: '1111', titular: 'María José Gómez', vencimiento: '12/29' }
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
    await userEvent.click(screen.getByRole('button', { name: 'Agregar saldo' }))
    expect(await screen.findByText('El monto debe ser mayor a 0.')).toBeInTheDocument()
    expect(api.agregarSaldo).not.toHaveBeenCalled()
  })

  it('agrega saldo con un monto sugerido y la tarjeta vigente preseleccionada', async () => {
    api.agregarSaldo.mockResolvedValue({ saldo: 550000 })
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /50\.000/ }))
    expect(screen.getByLabelText('Monto a agregar')).toHaveValue('50000')
    expect(screen.getByLabelText('Tarjeta registrada')).toHaveValue('1')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar saldo' }))
    expect(api.agregarSaldo).toHaveBeenCalledWith(50000, 1)
    expect(api.obtenerBilletera).toHaveBeenCalledTimes(2)
  })

  it('permite elegir otra tarjeta registrada y le envía su id al backend', async () => {
    api.agregarSaldo.mockResolvedValue({ saldo: 510000 })
    api.listarTarjetas.mockResolvedValue([
      TARJETA,
      { ...TARJETA, id: 2, marca: 'Mastercard', numero: '0004' },
    ])
    await open()
    await userEvent.selectOptions(screen.getByLabelText('Tarjeta registrada'), '2')
    await type('Monto a agregar', '10000')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar saldo' }))
    expect(api.agregarSaldo).toHaveBeenCalledWith(10000, 2)
  })

  it('muestra el error de id_tarjeta que devuelve el backend', async () => {
    api.agregarSaldo.mockRejectedValue(new ApiError({
      status: 422, code: 'tarjeta_invalida', message: 'Tarjeta no válida.',
      fields: { id_tarjeta: 'Selecciona una tarjeta propia y vigente.' },
    }))
    await open()
    await type('Monto a agregar', '10000')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar saldo' }))
    expect(await screen.findByText('Selecciona una tarjeta propia y vigente.')).toBeInTheDocument()
  })

  it('sin tarjetas vigentes no permite recargar', async () => {
    api.listarTarjetas.mockResolvedValue([{ ...TARJETA, vencimiento: '01/20' }])
    await open()
    expect(screen.getByLabelText('Tarjeta registrada')).toHaveValue('')
    expect(screen.getByText('No tienes tarjetas vigentes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar saldo' })).toBeDisabled()
    expect(await screen.findByText(/Registra una tarjeta vigente/)).toBeInTheDocument()
  })

  it('la recarga no pide el CVV y avisa que es simulada', async () => {
    await open()
    expect(await screen.findByText(/se pide el CVV al recargar/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Código de seguridad')).not.toBeInTheDocument()
  })

  it('solo ofrece recargas: no hay modo de establecer saldo', async () => {
    await open()
    expect(screen.queryByRole('button', { name: /Establecer saldo|Nuevo saldo/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Monto a agregar')).toBeInTheDocument()
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
