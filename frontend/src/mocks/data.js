import { CIUDADES, getCiudad, clasificarVuelo } from '../domain/ciudades.js'

// ---------------------------------------------------------------------------
// Datos de ejemplo para MSW. Deben ser coherentes con el contrato de B2:
// un vuelo guarda instantes en UTC y el front los muestra por zona horaria.
// ---------------------------------------------------------------------------

const COLOMBIA_OFFSET = '-05:00' // Colombia no aplica DST

function fechaRelativa(dias, hora = '08:00') {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hora}:00${COLOMBIA_OFFSET}`
}

let consecutivo = 0

/**
 * Construye un vuelo de ejemplo calculando salida/llegada en UTC.
 * El origen siempre es una ciudad colombiana (offset -05:00).
 */
export function crearVueloMock({
  origen,
  destino,
  diaOffset = 5,
  hora = '08:00',
  duracionMin = 60,
  precio = 300000,
  cuposEconomica = 100,
  cuposPrimera = 20,
  estado = 'programado',
  promocion = null,
}) {
  const salida = new Date(fechaRelativa(diaOffset, hora))
  const llegada = new Date(salida.getTime() + duracionMin * 60 * 1000)
  consecutivo += 1

  return {
    id: `vuelo-${consecutivo}`,
    codigo: `AT-${String(consecutivo).padStart(4, '0')}`,
    tipo: clasificarVuelo(origen, destino) ?? 'nacional',
    origen: getCiudad(origen),
    destino: getCiudad(destino),
    duracion_min: duracionMin,
    fecha_hora_salida: salida.toISOString(),
    fecha_hora_llegada: llegada.toISOString(),
    precio,
    cupos: { economica: cuposEconomica, primera: cuposPrimera },
    estado,
    promocion: promocion
      ? { id: `promo-${consecutivo}`, porcentaje: promocion, aplica_a: 'cupos_disponibles' }
      : null,
  }
}

export const VUELOS_MOCK = [
  // --- Nacionales ---
  crearVueloMock({ origen: 'BOG', destino: 'MDE', diaOffset: 3, hora: '06:30', duracionMin: 65, precio: 280000, cuposEconomica: 120, cuposPrimera: 16 }),
  crearVueloMock({ origen: 'MDE', destino: 'BOG', diaOffset: 3, hora: '09:15', duracionMin: 70, precio: 295000, cuposEconomica: 90, cuposPrimera: 12 }),
  crearVueloMock({ origen: 'BOG', destino: 'CTG', diaOffset: 4, hora: '07:00', duracionMin: 100, precio: 340000, cuposEconomica: 110, cuposPrimera: 18, promocion: 15 }),
  crearVueloMock({ origen: 'CLO', destino: 'BOG', diaOffset: 5, hora: '13:40', duracionMin: 60, precio: 260000, cuposEconomica: 80, cuposPrimera: 10 }),
  crearVueloMock({ origen: 'BOG', destino: 'SMR', diaOffset: 6, hora: '10:20', duracionMin: 95, precio: 360000, cuposEconomica: 100, cuposPrimera: 14 }),
  crearVueloMock({ origen: 'CTG', destino: 'MDE', diaOffset: 7, hora: '15:05', duracionMin: 80, precio: 310000, cuposEconomica: 60, cuposPrimera: 8 }),
  crearVueloMock({ origen: 'PEI', destino: 'BOG', diaOffset: 2, hora: '18:30', duracionMin: 55, precio: 250000, cuposEconomica: 70, cuposPrimera: 10 }),
  crearVueloMock({ origen: 'BAQ', destino: 'BOG', diaOffset: 8, hora: '11:00', duracionMin: 90, precio: 330000, cuposEconomica: 95, cuposPrimera: 12 }),
  crearVueloMock({ origen: 'BOG', destino: 'LET', diaOffset: 9, hora: '05:45', duracionMin: 115, precio: 470000, cuposEconomica: 50, cuposPrimera: 6 }),
  crearVueloMock({ origen: 'CLO', destino: 'PEI', diaOffset: 10, hora: '16:10', duracionMin: 45, precio: 220000, cuposEconomica: 40, cuposPrimera: 6 }),

  // --- Internacionales ---
  crearVueloMock({ origen: 'BOG', destino: 'MIA', diaOffset: 4, hora: '08:00', duracionMin: 210, precio: 1850000, cuposEconomica: 180, cuposPrimera: 30, promocion: 10 }),
  crearVueloMock({ origen: 'MDE', destino: 'MAD', diaOffset: 6, hora: '19:30', duracionMin: 570, precio: 3200000, cuposEconomica: 200, cuposPrimera: 28 }),
  crearVueloMock({ origen: 'CLO', destino: 'NYC', diaOffset: 5, hora: '07:15', duracionMin: 300, precio: 2100000, cuposEconomica: 150, cuposPrimera: 24 }),
  crearVueloMock({ origen: 'CTG', destino: 'MIA', diaOffset: 7, hora: '12:00', duracionMin: 200, precio: 1750000, cuposEconomica: 160, cuposPrimera: 28 }),
  crearVueloMock({ origen: 'PEI', destino: 'MAD', diaOffset: 9, hora: '21:00', duracionMin: 585, precio: 1990000, cuposEconomica: 150, cuposPrimera: 24, promocion: 20 }),
  crearVueloMock({ origen: 'BOG', destino: 'LON', diaOffset: 7, hora: '20:15', duracionMin: 620, precio: 2350000, cuposEconomica: 160, cuposPrimera: 24 }),
  crearVueloMock({ origen: 'BOG', destino: 'NYC', diaOffset: 11, hora: '06:20', duracionMin: 330, precio: 1950000, cuposEconomica: 150, cuposPrimera: 26 }),
  crearVueloMock({ origen: 'CLO', destino: 'MIA', diaOffset: 12, hora: '14:45', duracionMin: 200, precio: 1760000, cuposEconomica: 120, cuposPrimera: 20 }),
  crearVueloMock({ origen: 'CTG', destino: 'MAD', diaOffset: 14, hora: '20:10', duracionMin: 560, precio: 2_400_000, cuposEconomica: 140, cuposPrimera: 22 }),
  crearVueloMock({ origen: 'BOG', destino: 'BUE', diaOffset: 9, hora: '22:15', duracionMin: 375, precio: 1_980_000, cuposEconomica: 130, cuposPrimera: 18 }),
]

export const CIUDADES_MOCK = CIUDADES

export function getVueloMock(id) {
  return VUELOS_MOCK.find((v) => v.id === id || v.codigo === id) ?? null
}
