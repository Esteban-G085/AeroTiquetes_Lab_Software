/**
 * Adaptador: vuelo de la API (snake_case) → props de <FlightCard>.
 * Un solo lugar conoce los nombres de campo del vuelo; si B2 los cambia, se ajusta aquí.
 *
 * Vuelo de la API:
 *   { id, codigo, aerolinea?, tipo: 'nacional' | 'internacional',
 *     origen: { ciudad, codigo }, destino: { ciudad, codigo },
 *     salida, llegada            (ISO con zona),
 *     salida_zona, llegada_zona  (IANA),
 *     duracion_min, precio, moneda }
 */
export function toFlightProps(v) {
  return {
    codigo: v.codigo,
    aerolinea: v.aerolinea ?? 'AeroTiquetes',
    origen: v.origen,
    destino: v.destino,
    salida: v.salida,
    llegada: v.llegada,
    salidaZona: v.salida_zona,
    llegadaZona: v.llegada_zona,
    duracionMin: v.duracion_min,
    escalas: 0, // el sistema solo maneja vuelos directos (SRS RF06)
    precio: v.precio,
    moneda: v.moneda ?? 'COP',
  }
}
