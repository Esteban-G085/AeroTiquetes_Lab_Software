import { screen, within, waitFor } from '@testing-library/react'
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
    { id: 'administrador', nombre: 'Administrador', editable: true, modulos: { vuelos: true, reservas: false } },
    { id: 'cliente', nombre: 'Cliente', editable: true, modulos: { vuelos: false, reservas: true } },
    { id: 'visitante', nombre: 'Visitante', editable: true, modulos: { vuelos: false, reservas: false } },
  ],
})

const open = async () => {
  renderWithProviders(<AppRouter />, { route: '/root/roles' })
  await screen.findByRole('table') // el título se ve desde el inicio; la tabla solo cuando los datos llegaron
}
const sw = (label) => screen.getByRole('switch', { name: label })

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
    expect(sw('Cliente: Reservas')).toBeChecked()
    expect(sw('Cliente: Vuelos')).not.toBeChecked()
  })

  it('no hay forma de crear ni eliminar roles (son fijos)', async () => {
    await open()
    expect(screen.queryByRole('button', { name: /crear|eliminar|nuevo rol/i })).not.toBeInTheDocument()
  })

  it('el rol no editable (root) queda bloqueado: nadie se quita su propio acceso', async () => {
    await open()
    expect(sw('Root: Vuelos')).toBeDisabled()
    expect(sw('Root: Reservas')).toBeDisabled()
    expect(screen.getByText('No editable')).toBeInTheDocument()
    expect(sw('Administrador: Vuelos')).toBeEnabled()
  })

  it('sin cambios, Guardar y Descartar están deshabilitados', async () => {
    await open()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeDisabled()
  })

  it('al activar un permiso cuenta el cambio; Descartar lo revierte', async () => {
    await open()
    await userEvent.click(sw('Cliente: Vuelos'))
    expect(sw('Cliente: Vuelos')).toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent('1 rol con cambios sin guardar')
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(sw('Cliente: Vuelos')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('guardar envía SOLO los roles modificados, con su mapa completo, y recarga', async () => {
    api.guardarRoles.mockResolvedValue({})
    await open()
    await userEvent.click(sw('Cliente: Vuelos'))
    await userEvent.click(sw('Visitante: Reservas'))
    expect(screen.getByRole('status')).toHaveTextContent('2 roles con cambios sin guardar')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(api.guardarRoles).toHaveBeenCalledTimes(1))
    expect(api.guardarRoles.mock.calls[0][0]).toEqual([
      { id: 'cliente', modulos: { vuelos: true, reservas: true } },
      { id: 'visitante', modulos: { vuelos: false, reservas: true } },
    ])
    expect(await screen.findByText(/Permisos actualizados/)).toBeInTheDocument()
    expect(api.obtenerRoles).toHaveBeenCalledTimes(2)
  })

  it('error al guardar: avisa y conserva los cambios para reintentar', async () => {
    api.guardarRoles.mockRejectedValue(new ApiError({ status: 500, message: 'No se pudo guardar en el servidor' }))
    await open()
    await userEvent.click(sw('Cliente: Vuelos'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar en el servidor')
    expect(sw('Cliente: Vuelos')).toBeChecked()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('un módulo nuevo del backend aparece sin tocar el front', async () => {
    const m = MATRIZ()
    m.modulos.push({ id: 'noticias', nombre: 'Noticias' })
    m.roles.forEach((r) => { r.modulos.noticias = r.id === 'administrador' })
    api.obtenerRoles.mockResolvedValue(m)
    await open()
    expect(screen.getByRole('columnheader', { name: 'Noticias' })).toBeInTheDocument()
    expect(sw('Administrador: Noticias')).toBeChecked()
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
    expect(within(document.body).queryByRole('switch')).not.toBeInTheDocument()
  })
})
