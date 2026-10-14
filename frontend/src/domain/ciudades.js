// Catálogo de ciudades del sistema AeroTiquetes.
// Fuente: Requerimientos Lab Soft (módulos de vuelos y búsqueda).
// - Nacionales: 32 capitales de departamento de Colombia (zona horaria America/Bogota).
//   En desarrollo se permite programar desde/hacia cualquier capital (RF04).
//   El enunciado menciona 5 orígenes internacionales destacados (Pereira, Bogotá,
//   Medellín, Cali, Cartagena); se marcan con `origen_internacional: true`.
// - Internacionales: destinos permitidos por RF05/R11-R14.

/** Zona horaria de Colombia (todas las capitales nacionales). */
export const TZ_COLOMBIA = 'America/Bogota'

/** @typedef {'nacional'|'internacional'} TipoVuelo */

/**
 * @typedef {Object} Ciudad
 * @property {string} codigo   Código IATA-like de 3 letras (clave estable).
 * @property {string} nombre
 * @property {string} pais
 * @property {'nacional'|'internacional'} tipo
 * @property {string} zona_horaria  Zona IANA (ej: America/Bogota)
 * @property {boolean} [origen_internacional]  Solo para ciudades colombianas habilitadas como origen internacional.
 */

/** Ciudades internacionales de destino (los 5 destinos permitidos). */
export const CIUDADES_INTERNACIONALES = [
  { codigo: 'MAD', nombre: 'Madrid', pais: 'España', tipo: 'internacional', zona_horaria: 'Europe/Madrid' },
  { codigo: 'LON', nombre: 'Londres', pais: 'Reino Unido', tipo: 'internacional', zona_horaria: 'Europe/London' },
  { codigo: 'NYC', nombre: 'New York', pais: 'Estados Unidos', tipo: 'internacional', zona_horaria: 'America/New_York' },
  { codigo: 'BUE', nombre: 'Buenos Aires', pais: 'Argentina', tipo: 'internacional', zona_horaria: 'America/Argentina/Buenos_Aires' },
  { codigo: 'MIA', nombre: 'Miami', pais: 'Estados Unidos', tipo: 'internacional', zona_horaria: 'America/New_York' },
]

// Orígenes internacionales permitidos (RF05)
const ORIGENES_INTERNACIONALES = new Set(['PEI', 'BOG', 'MDE', 'CLO', 'CTG'])

// 32 capitales de departamento de Colombia
const CAPITALES_COLOMBIA = [
  { codigo: 'LET', nombre: 'Leticia' },
  { codigo: 'MDE', nombre: 'Medellín' },
  { codigo: 'AUC', nombre: 'Arauca' },
  { codigo: 'BAQ', nombre: 'Barranquilla' },
  { codigo: 'CTG', nombre: 'Cartagena' },
  { codigo: 'TUN', nombre: 'Tunja' },
  { codigo: 'MZL', nombre: 'Manizales' },
  { codigo: 'FLA', nombre: 'Florencia' },
  { codigo: 'YOP', nombre: 'Yopal' },
  { codigo: 'POP', nombre: 'Popayán' },
  { codigo: 'VUP', nombre: 'Valledupar' },
  { codigo: 'QUI', nombre: 'Quibdó' },
  { codigo: 'MTR', nombre: 'Montería' },
  { codigo: 'BOG', nombre: 'Bogotá' },
  { codigo: 'INI', nombre: 'Inírida' },
  { codigo: 'SJE', nombre: 'San José del Guaviare' },
  { codigo: 'NVA', nombre: 'Neiva' },
  { codigo: 'RCH', nombre: 'Riohacha' },
  { codigo: 'SMR', nombre: 'Santa Marta' },
  { codigo: 'VVC', nombre: 'Villavicencio' },
  { codigo: 'PSO', nombre: 'Pasto' },
  { codigo: 'CUC', nombre: 'Cúcuta' },
  { codigo: 'MOC', nombre: 'Mocoa' },
  { codigo: 'AXM', nombre: 'Armenia' },
  { codigo: 'PEI', nombre: 'Pereira' },
  { codigo: 'ADZ', nombre: 'San Andrés' },
  { codigo: 'BGA', nombre: 'Bucaramanga' },
  { codigo: 'SIN', nombre: 'Sincelejo' },
  { codigo: 'IBE', nombre: 'Ibagué' },
  { codigo: 'CLO', nombre: 'Cali' },
  { codigo: 'MVP', nombre: 'Mitú' },
  { codigo: 'PDA', nombre: 'Puerto Carreño' },
]

export const CIUDADES_NACIONALES = CAPITALES_COLOMBIA.map((c) => ({
  ...c,
  pais: 'Colombia',
  zona_horaria: 'America/Bogota',
  tipo: 'nacional',
  origen_internacional: ORIGENES_INTERNACIONALES.has(c.codigo),
}))

export const CIUDADES = [...CIUDADES_NACIONALES, ...CIUDADES_INTERNACIONALES]

const CIUDADES_POR_CODIGO = new Map(CIUDADES.map((c) => [c.codigo, c]))

export function getCiudad(codigo) {
  if (!codigo) return null
  return CIUDADES_POR_CODIGO.get(String(codigo).toUpperCase()) ?? null
}

export function esOrigenInternacional(codigo) {
  return ORIGENES_INTERNACIONALES.has(String(codigo).toUpperCase())
}

/**
 * Reglas de programación de vuelos (RF04-RF06).
 * Determina si un par origen/destino es un vuelo internacional válido.
 */
export function clasificarVuelo(origenCodigo, destinoCodigo) {
  const origen = getCiudad(origenCodigo)
  const destino = getCiudad(destinoCodigo)
  if (!origen || !destino || origen.codigo === destino.codigo) return null

  const origenInternacional = origen.tipo === 'internacional'
  const destinoInternacional = destino.tipo === 'internacional'

  if (origenInternacional && destinoInternacional) return null
  if (origenInternacional) return null // los internacionales salen solo de Colombia (RF05)
  if (destinoInternacional) {
    return esOrigenInternacional(origen.codigo) ? 'internacional' : null
  }
  return 'nacional'
}
