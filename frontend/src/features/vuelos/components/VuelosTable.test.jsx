import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import VuelosTable from './VuelosTable'

const VUELOS = [
  {
    id: 9, codigo: 'AT-0009', tipo: 'nacional', estado: 'programado',
    origen: { codigo: 'BOG', nombre: 'Bogotá', zona_horaria: 'America/Bogota' },
    destino: { codigo: 'MDE', nombre: 'Medellín', zona_horaria: 'America/Bogota' },
    salida_utc: '2030-01-15T13:00:00Z', duracion_min: 65, costo: 300000,
    cupos_economica: 125, cupos_primera: 25,
  },
  {
    id: 10, codigo: 'AT-0010', tipo: 'internacional', estado: 'cancelado',
    origen: { codigo: 'BOG', nombre: 'Bogotá', zona_horaria: 'America/Bogota' },
    destino: { codigo: 'MAD', nombre: 'Madrid', zona_horaria: 'Europe/Madrid' },
    salida_utc: '2030-02-01T03:10:00Z', duracion_min: 615, costo: 2450000,
    cupos_economica: 0, cupos_primera: 4,
  },
]

const CABECERAS = ['Código', 'Ruta', 'Salida', 'Duración', 'Costo', 'Cupos (Econ./Prim.)', 'Estado', 'Acciones']
// Rótulo que ve el modo tarjeta en móvil (el de cupos se abrevia; la última columna es solo el botón).
const ROTULOS = ['Código', 'Ruta', 'Salida', 'Duración', 'Costo', 'Cupos', 'Estado', '']

const montar = () => render(<MemoryRouter><VuelosTable vuelos={VUELOS} /></MemoryRouter>)

describe('VuelosTable (HU19)', () => {
  it('rotula cada celda con el encabezado de su columna', () => {
    montar()
    const tabla = screen.getByRole('table', { name: 'Vuelos programados' })
    expect(within(tabla).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(CABECERAS)

    const filas = within(tabla).getAllByRole('row').slice(1)
    expect(filas).toHaveLength(2)
    filas.forEach((fila) => {
      const celdas = within(fila).getAllByRole('cell')
      expect(celdas).toHaveLength(CABECERAS.length)
      celdas.forEach((celda, i) => expect(celda).toHaveAttribute('data-label', ROTULOS[i]))
    })
  })

  it('enlaza la consulta de cada vuelo programado', () => {
    montar()
    const consultas = screen.getAllByRole('link', { name: 'Consultar' })
    expect(consultas).toHaveLength(2)
    expect(consultas[0]).toHaveAttribute('href', '/admin/vuelos/9')
    expect(consultas[1]).toHaveAttribute('href', '/admin/vuelos/10')
  })

  it('presenta código, ruta, cupos por clase, costo y estado', () => {
    montar()
    const primera = screen.getAllByRole('row')[1]
    expect(primera).toHaveTextContent('AT-0009')
    expect(primera).toHaveTextContent('BOG')
    expect(primera).toHaveTextContent('MDE')
    expect(primera).toHaveTextContent('125 / 25')
    expect(primera).toHaveTextContent(/300\.000/)
    expect(primera).toHaveTextContent('Programado')
  })
})
