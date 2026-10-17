// Catálogo de ciudades y reglas de programación de vuelos (HU5 y HU18).
//
// Fuente de verdad: la tabla `ciudad` (RNF13). Este catálogo es solo el RESPALDO de
// desarrollo para que los formularios funcionen si `GET /ciudades` todavía no responde;
// `utils/useCiudades.js` siempre prefiere lo que devuelva la API.
//
// Modelo por ciudad (igual al del backend, sección 9 del plan):
//   { codigo, nombre, pais, zona_horaria, es_capital_departamento, grupo_internacional }
//   · grupo_internacional: 'colombia' | 'exterior' | null
//
// Reglas (D5 / HU18):
//   · Nacional: entre dos capitales de departamento de Colombia.
//   · Internacional: una ciudad del grupo `colombia` {Pereira, Bogotá, Medellín, Cali,
//     Cartagena} y otra del grupo `exterior` {Madrid, Londres, New York, Buenos Aires,
//     Miami}, en cualquiera de los dos sentidos.

/** Zona horaria de todas las capitales de departamento. */
export const TZ_COLOMBIA = 'America/Bogota'

export const GRUPOS = Object.freeze({ COLOMBIA: 'colombia', EXTERIOR: 'exterior' })

// Grupo `colombia`: capitales habilitadas para vuelos internacionales (los 5 orígenes del PO).
const GRUPO_COLOMBIA = new Set(['PEI', 'BOG', 'MDE', 'CLO', 'CTG'])

// Las 32 capitales de departamento (RF04/R15).
const CAPITALES_DEPARTAMENTO = [
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

export const CIUDADES_NACIONALES = CAPITALES_DEPARTAMENTO.map((c) => ({
  ...c,
  pais: 'Colombia',
  zona_horaria: TZ_COLOMBIA,
  es_capital_departamento: true,
  grupo_internacional: GRUPO_COLOMBIA.has(c.codigo) ? GRUPOS.COLOMBIA : null,
}))

// Ciudades del grupo `exterior` (destinos internacionales permitidos).
export const CIUDADES_EXTERIOR = [
  { codigo: 'MAD', nombre: 'Madrid', pais: 'España', zona_horaria: 'Europe/Madrid', es_capital_departamento: false, grupo_internacional: GRUPOS.EXTERIOR },
  { codigo: 'LON', nombre: 'Londres', pais: 'Reino Unido', zona_horaria: 'Europe/London', es_capital_departamento: false, grupo_internacional: GRUPOS.EXTERIOR },
  { codigo: 'NYC', nombre: 'New York', pais: 'Estados Unidos', zona_horaria: 'America/New_York', es_capital_departamento: false, grupo_internacional: GRUPOS.EXTERIOR },
  { codigo: 'BUE', nombre: 'Buenos Aires', pais: 'Argentina', zona_horaria: 'America/Argentina/Buenos_Aires', es_capital_departamento: false, grupo_internacional: GRUPOS.EXTERIOR },
  { codigo: 'MIA', nombre: 'Miami', pais: 'Estados Unidos', zona_horaria: 'America/New_York', es_capital_departamento: false, grupo_internacional: GRUPOS.EXTERIOR },
]

export const CIUDADES = [...CIUDADES_NACIONALES, ...CIUDADES_EXTERIOR]

const POR_CODIGO = new Map(CIUDADES.map((c) => [c.codigo, c]))

/** Ciudad por código IATA (insensible a mayúsculas). `null` si no existe. */
export function getCiudad(codigo) {
  if (!codigo) return null
  return POR_CODIGO.get(String(codigo).toUpperCase()) ?? null
}

/** Acepta un código o la ciudad ya resuelta (la API puede traerla embebida). */
function comoCiudad(valor) {
  if (!valor) return null
  if (typeof valor === 'string') return getCiudad(valor)
  return valor.codigo ? valor : null
}

const esExterior = (ciudad) => ciudad?.grupo_internacional === GRUPOS.EXTERIOR
const esGrupoColombia = (ciudad) => ciudad?.grupo_internacional === GRUPOS.COLOMBIA

/**
 * Clasifica un par origen/destino (HU18, RF04–RF06).
 * @returns {'nacional'|'internacional'|null} `null` si la combinación no está permitida.
 */
export function clasificarVuelo(origen, destino) {
  const a = comoCiudad(origen)
  const b = comoCiudad(destino)
  if (!a || !b || a.codigo === b.codigo) return null

  const exterior = esExterior(a) || esExterior(b)
  if (exterior) {
    // Internacional: un extremo del grupo `exterior` y el otro del grupo `colombia`, en cualquier orden.
    if (esExterior(a) && esExterior(b)) return null
    const colombiano = esExterior(a) ? b : a
    return esGrupoColombia(colombiano) ? 'internacional' : null
  }

  // Sin ciudades del exterior: solo vale entre capitales de departamento (nacional).
  const esColombiana = (c) => c.pais === 'Colombia' || c.es_capital_departamento === true
  return esColombiana(a) && esColombiana(b) ? 'nacional' : null
}

/** Ciudades que pueden ser ORIGEN de un vuelo internacional (grupo `colombia`). */
export function origenesInternacionales(ciudades = CIUDADES) {
  return ciudades.filter(esGrupoColombia)
}
