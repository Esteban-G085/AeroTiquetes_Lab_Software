import { GRUPOS } from '@/domain/ciudades'

// Opciones de ciudad para los selects de Búsqueda (HU5) y Administración de vuelos (HU18).
// Vive en el núcleo porque lo comparten dos features.

/** Todas las ciudades como `{ value, label }` para `ui/Select`. */
export const opcionesDeCiudad = (ciudades = []) =>
  ciudades.map((c) => ({ value: c.codigo, label: `${c.nombre} (${c.codigo})` }))

/** Ciudades de Colombia (capitales de departamento): origen válido de cualquier vuelo. */
export const ciudadesDeColombia = (ciudades = []) =>
  ciudades.filter((c) => c.grupo_internacional !== GRUPOS.EXTERIOR)

/** Ciudades del grupo `exterior`: solo pueden ser destino de un vuelo internacional. */
export const ciudadesDelExterior = (ciudades = []) =>
  ciudades.filter((c) => c.grupo_internacional === GRUPOS.EXTERIOR)

/** Agrupa para el select de la búsqueda: Colombia (nacional) e Internacional. */
export const gruposDeCiudades = (ciudades = []) => [
  { label: 'Colombia (nacional)', options: opcionesDeCiudad(ciudadesDeColombia(ciudades)) },
  { label: 'Internacional', options: opcionesDeCiudad(ciudadesDelExterior(ciudades)) },
]
