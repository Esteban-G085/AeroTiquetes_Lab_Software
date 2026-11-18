import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/helpers'
import { obtenerAsientosVuelo } from '../api'
import AsientoMapa from './AsientoMapa'

vi.mock('../api', () => ({ obtenerAsientosVuelo: vi.fn() }))

const asiento = (id, columna, estado = 'disponible') => ({
  id,
  numero: `1${columna}`,
  fila: 1,
  columna,
  clase: 'economica',
  estado,
})

const ASIENTOS_3_3 = [
  asiento(101, 'A'), asiento(102, 'B'), asiento(103, 'C'),
  asiento(104, 'D'), asiento(105, 'E'), asiento(106, 'F'),
]

const ASIENTOS_3_2 = [
  asiento(201, 'A'), asiento(202, 'B'), asiento(203, 'C'),
  asiento(204, 'D'), asiento(205, 'E'),
]

beforeEach(() => {
  vi.clearAllMocks()
  obtenerAsientosVuelo.mockResolvedValue(ASIENTOS_3_3)
})

describe('AsientoMapa (selección intuitiva de sillas)', () => {
  it('dibuja el pasillo entre C y D y explica ventana, medio y pasillo', async () => {
    const { container } = renderWithProviders(<AsientoMapa idVuelo={1} clase="economica" />)
    await screen.findByRole('button', { name: '1F' })

    expect(container.querySelector('.asiento-mapa__pasillo')).toBeInTheDocument()
    expect(screen.getByText('Ventana')).toBeInTheDocument()
    expect(screen.getByText('Medio')).toBeInTheDocument()
    expect(screen.getAllByText('Pasillo').length).toBeGreaterThanOrEqual(2)
  })

  it('marca la posición de cada columna en el tooltip', async () => {
    renderWithProviders(<AsientoMapa idVuelo={1} />)
    await screen.findByRole('button', { name: '1F' })

    const esperado = {
      '1A': 'Ventana', '1B': 'Medio', '1C': 'Pasillo',
      '1D': 'Pasillo', '1E': 'Medio', '1F': 'Ventana',
    }
    Object.entries(esperado).forEach(([numero, posicion]) => {
      expect(screen.getByRole('button', { name: numero }).title).toContain(posicion)
    })
  })

  it('selecciona por ID y muestra la posición en el resumen', async () => {
    const onCambio = vi.fn()
    renderWithProviders(<AsientoMapa idVuelo={1} onCambio={onCambio} />)

    await userEvent.click(await screen.findByRole('button', { name: '1A' }))
    expect(onCambio).toHaveBeenCalledWith([101])
    expect(screen.getByText(/1A \(ventana\)/)).toBeInTheDocument()
  })

  it('no deja seleccionar un asiento ocupado', async () => {
    obtenerAsientosVuelo.mockResolvedValue([asiento(103, 'C', 'ocupado')])
    const onCambio = vi.fn()
    renderWithProviders(<AsientoMapa idVuelo={1} onCambio={onCambio} />)

    const ocupado = await screen.findByRole('button', { name: '1C' })
    expect(ocupado).toBeDisabled()
    await userEvent.click(ocupado)
    expect(onCambio).not.toHaveBeenCalled()
  })

  it('interpreta bien los vuelos antiguos con columnas A-E', async () => {
    obtenerAsientosVuelo.mockResolvedValue(ASIENTOS_3_2)
    renderWithProviders(<AsientoMapa idVuelo={1} />)

    expect((await screen.findByRole('button', { name: '1E' })).title).toContain('Ventana')
    expect(screen.getByRole('button', { name: '1C' }).title).toContain('Pasillo')
    expect(screen.queryByRole('button', { name: '1F' })).not.toBeInTheDocument()
  })
})
