import { screen, waitFor } from '@testing-library/react'
import { within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import AppRouter from '@/routes/AppRouter'
import { renderWithProviders, seedSession } from '@/test/helpers'
import { ApiError } from '@/services/apiError'
import * as api from '../api'

vi.mock('../api')

const MATRIZ = () => ({
  modulos: [{ id: 'vuelos', nombre: 'Vuelos' }, { id: 'reservas', nombre: 'Reservas' }],
  roles: [
    { id: 'root', nombre: 'Root', descripcion: 'Control total', editable: false, modulos: { vuelos: true, reservas: false } },
    { id: 'administrador', nombre: 'Administrador', editable: false, modulos: { vuelos: true, reservas: false } },
    { id: 'cliente', nombre: 'Cliente', editable: false, modulos: { vuelos: false, reservas: true } },
    { id: 'visitante', nombre: 'Visitante', editable: false, modulos: { vuelos: false, reservas: false } },
  ],
})

const open = async () => {
  renderWithProviders(<AppRouter />, { route: '/root/roles' })
  await screen.findByRole('table')
}

beforeEach(() => {
  seedSession({ rol: 'root' }, { usuario: 'root' })
  api.obtenerRoles.mockResolvedValue(MATRIZ())
})

describe('RolesPage (HU24)', () => {
  it('muestra los 4 roles y una columna por cada módulo que devuelve el backend', async () => {
    await open()
    for (const r of ['Root', 'Administrador', 'Cliente', 'Visitante']) {
      expect(screen.getByRole('rowheader', { name: new RegExp(r) })).toBeInTheDocument()
    }
    expect(screen.getByRole('columnheader', { name: 'Vuelos' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Reservas' })).toBeInTheDocument()
  })

  it('no hay forma de crear ni eliminar roles (son fijos)', async () => {
    await open()
    expect(screen.queryByRole('button', { name: /crear|eliminar|nuevo rol/i })).not.toBeInTheDocument()
  })

  it('todos los roles son solo lectura: no hay switches ni botones de guardar', async () => {
    await open()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar|descartar/i })).not.toBeInTheDocument()
    expect(screen.getByText(/no se pueden cambiar desde esta pantalla/i)).toBeInTheDocument()
  })

  it('muestra el estado de cada módulo por rol con ✓ y ✗', async () => {
    await open()
    const rootRow = screen.getByRole('rowheader', { name: /^Root/ }).closest('tr')
    expect(within(rootRow).getByText('✓')).toBeInTheDocument() // Vuelos habilitado
    expect(within(rootRow).getByText('✗')).toBeInTheDocument() // Reservas deshabilitado
  })

  it('un módulo nuevo del backend aparece sin tocar el front', async () => {
    const m = MATRIZ()
    m.modulos.push({ id: 'noticias', nombre: 'Noticias' })
    m.roles.forEach((r) => { r.modulos.noticias = r.id === 'administrador' })
    api.obtenerRoles.mockResolvedValue(m)
    await open()
    expect(screen.getByRole('columnheader', { name: 'Noticias' })).toBeInTheDocument()
    const adminRow = screen.getByRole('rowheader', { name: /^Administrador/ }).closest('tr')
    expect(within(adminRow).getAllByText('✓')).toHaveLength(2) // Vuelos y Noticias habilitados
  })

  it('error de carga ofrece reintentar', async () => {
    api.obtenerRoles.mockRejectedValueOnce(new ApiError({ code: 'NETWORK_ERROR', message: 'Sin conexión' }))
    renderWithProviders(<AppRouter />, { route: '/root/roles' })
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('solo el root accede (el cliente recibe 403)', async () => {
    sessionStorage.clear()
    seedSession({ rol: 'cliente' })
    renderWithProviders(<AppRouter />, { route: '/root/roles' })
    expect(await screen.findByText('No tienes acceso a esta sección')).toBeInTheDocument()
  })
})
