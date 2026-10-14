// Estados y catálogos de etiquetas del módulo de vuelos (RF11-RF13).

export const ESTADOS_VUELO = {
  PROGRAMADO: 'programado',
  SUCEDIDO: 'sucedido', // ya pasó la hora de salida (bloquea edición)
  REALIZADO: 'realizado', // el vuelo se completó
  CANCELADO: 'cancelado',
}

export const ESTADO_LABEL = {
  programado: 'Programado',
  sucedido: 'Sucedido',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

// Clase CSS del badge (definidas en index.css).
export const ESTADO_CLASE = {
  programado: 'at-estado--programado',
  sucedido: 'at-estado--sucedido',
  realizado: 'at-estado--realizado',
  cancelado: 'at-estado--cancelado',
}

export const ESTADO_OPCIONES = Object.values(ESTADOS_VUELO).map((value) => ({
  value,
  label: ESTADO_LABEL[value],
}))

export const CLASES = {
  ECONOMICA: 'economica',
  PRIMERA: 'primera',
}

export const CLASE_LABEL = {
  economica: 'Económica',
  primera: 'Primera',
}

export const CLASE_OPCIONES = Object.values(CLASES).map((value) => ({
  value,
  label: CLASE_LABEL[value],
}))

export const TIPO_LABEL = {
  nacional: 'Nacional',
  internacional: 'Internacional',
}

// Órdenes permitidos en la búsqueda (RF14).
export const ORDEN_BUSQUEDA = [
  { value: 'fecha_asc', label: 'Fecha de salida (más próxima)' },
  { value: 'precio_asc', label: 'Precio (menor a mayor)' },
  { value: 'precio_desc', label: 'Precio (mayor a menor)' },
  { value: 'duracion_asc', label: 'Duración (menor a mayor)' },
  { value: 'duracion_desc', label: 'Duración (mayor a menor)' },
]
