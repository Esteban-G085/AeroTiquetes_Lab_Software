// Lectura de la forma de un vuelo que devuelve la API (contrato en docs/CONTRATO_VUELOS.md).
// Solo presentación: no calcula reglas de negocio (eso es del backend).

const numero = (valor) => (Number.isFinite(Number(valor)) ? Number(valor) : 0)

/** Cupos totales disponibles (suma de las dos clases). */
export function cuposTotales(vuelo) {
  return numero(vuelo?.cupos_economica) + numero(vuelo?.cupos_primera)
}

/** ¿Queda algún cupo? (la búsqueda NO oculta vuelos sin cupo: solo lo advierte, D13). */
export function cuposDisponibles(vuelo) {
  return cuposTotales(vuelo) > 0
}

/** Texto de disponibilidad por clase para la tarjeta de resultados (D13). */
export function disponibilidadTexto(vuelo) {
  const econ = numero(vuelo?.cupos_economica)
  const prim = numero(vuelo?.cupos_primera)
  if (!econ && !prim) return 'Sin cupos disponibles'
  return `Económica: ${econ} · Primera: ${prim}`
}
