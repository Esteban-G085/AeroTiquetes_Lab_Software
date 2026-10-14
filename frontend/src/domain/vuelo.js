// Cálculos de presentación a partir de un vuelo (no lógica de negocio del backend).

import { formatDuracion } from '../utils/fecha.js'

/** Precio con promoción aplicada (si existe). */
export function precioConPromocion(vuelo) {
  const base = Number(vuelo?.precio ?? 0)
  const porcentaje = Number(vuelo?.promocion?.porcentaje ?? 0)
  if (!porcentaje) return { base, final: base, tienePromocion: false, porcentaje: 0 }
  const final = Math.round(base * (1 - porcentaje / 100))
  return { base, final, tienePromocion: true, porcentaje }
}

/** Cupos totales disponibles (suma de clases). */
export function cuposTotales(vuelo) {
  const c = vuelo?.cupos ?? {}
  return Number(c.economica ?? 0) + Number(c.primera ?? 0)
}

export function cuposDisponibles(vuelo) {
  return cuposTotales(vuelo) > 0
}

/** Resumen corto de duración. */
export function duracionTexto(vuelo) {
  return formatDuracion(vuelo?.duracion_min)
}
