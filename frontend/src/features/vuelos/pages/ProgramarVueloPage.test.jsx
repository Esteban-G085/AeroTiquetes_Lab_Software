import { fireEvent, screen, waitFor } from '@testing-library/react'
import AppRouter from '@/routes/AppRouter'
import { CIUDADES } from '@/domain/ciudades'
import { ApiError } from '@/services/apiError'
import { renderWithProviders, seedSession } from '@/test/helpers'
import * as api from '../api'

vi.mock('../api')
vi.mock('@/utils/useCiudades', () => ({
  useCiudades: () => ({ ciudades: CIUDADES, status: 'ready', recargar: () => {} }),
}))

const CREADO = {
  id: 9, codigo: 'AT-0009', tipo: 'nacional', estado: 'programado',
  origen: { codigo: 'BOG', nombre: 'Bogotá', zona_horaria: 'America/Bogota' },
  destino: { codigo: 'MDE', nombre: 'Medellín', zona_horaria: 'America/Bogota' },
  salida_utc: '2030-01-15T13:00:00Z', llegada_utc: '2030-01-15T14:30:00Z', duracion_min: 90, costo: 300000,
  cupos_economica: 125, cupos_primera: 25, fecha_programacion: '2026-10-17T10:00:00Z',
}

const abrir = async () => {
  renderWithProviders(<AppRouter />, { route: '/admin/vuelos/nuevo' })
  await screen.findByRole('heading', { name: 'Programar vuelo' })
}

const escribir = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

const llenar = ({ origen = 'BOG', destino = 'MDE', fecha = '2030-01-15', hora = '08:00', horas = '1', minutos = '30', costo = '300000' } = {}) => {
  escribir('Origen', origen)
  escribir('Destino', destino)
  escribir('Fecha de salida', fecha)
  escribir('Hora de salida (Colombia)', hora)
  escribir('Duración (horas)', horas)
  escribir('Duración (minutos)', minutos)
  escribir('Costo por persona (COP)', costo)
}

const enviar = () => fireEvent.click(screen.getByRole('button', { name: 'Programar vuelo' }))

beforeEach(() => {
  sessionStorage.clear()
  seedSession({ rol: 'administrador' })
  api.crearVuelo.mockResolvedValue(CREADO)
  api.obtenerVueloAdmin.mockResolvedValue(CREADO)
})

describe('ProgramarVueloPage (HU18)', () => {
  it('muestra la ruta y los cupos que asignará el sistema', async () => {
    await abrir()
    llenar()
    expect(screen.getByText('Nacional')).toBeInTheDocument()
    expect(screen.getByText('Bogotá → Medellín')).toBeInTheDocument()
    expect(screen.getByText('Económica: 125 · Primera: 25')).toBeInTheDocument()
  })

  it('envía solo origen, destino, fecha, hora, duración y costo (el resto lo genera el sistema)', async () => {
    await abrir()
    llenar()
    enviar()

    await waitFor(() => expect(api.crearVuelo).toHaveBeenCalledWith({
      tipo: 'nacional', origen: 'BOG', destino: 'MDE', fecha: '2030-01-15', hora: '08:00', duracion: 90, costo: 300000,
    }))
    expect(await screen.findByText(/AT-0009.*programado correctamente/)).toBeInTheDocument()
    // Tras crear, lleva al detalle del vuelo (HU19).
    expect(await screen.findByText('Vuelo AT-0009')).toBeInTheDocument()
  })

  it('valida los campos obligatorios antes de llamar a la API', async () => {
    await abrir()
    enviar()

    expect(await screen.findByText('Selecciona la ciudad de origen.')).toBeInTheDocument()
    expect(screen.getByText('Selecciona la ciudad de destino.')).toBeInTheDocument()
    expect(screen.getByText('Indica la fecha de salida.')).toBeInTheDocument()
    expect(screen.getByText('El costo por persona debe ser mayor que cero.')).toBeInTheDocument()
    expect(api.crearVuelo).not.toHaveBeenCalled()
  })

  it('rechaza una combinación internacional no permitida (RF04–RF06)', async () => {
    await abrir()
    llenar({ origen: 'LET', destino: 'MAD' })
    enviar()

    expect(await screen.findByText(/Combinación no permitida/)).toBeInTheDocument()
    expect(api.crearVuelo).not.toHaveBeenCalled()
  })

  it('pinta en el campo los errores que devuelve el backend', async () => {
    api.crearVuelo.mockRejectedValue(new ApiError({ status: 400, fields: { fecha: 'La fecha no puede ser anterior a hoy' } }))
    await abrir()
    llenar()
    enviar()

    expect(await screen.findByText('La fecha no puede ser anterior a hoy')).toBeInTheDocument()
  })
})
