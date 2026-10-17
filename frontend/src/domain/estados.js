// Catálogos del módulo de vuelos (HU5, HU18, HU19).
//
// El vocabulario coincide con el backend: estado ∈ {programado, sucedido, realizado, cancelado}
// (plan, sección 9) y clase ∈ {economica, primera}.

export const ESTADOS_VUELO = Object.freeze({
  PROGRAMADO: 'programado',
  SUCEDIDO: 'sucedido', // ya pasó la hora de salida (en la Iteración 2 bloquea la edición)
  REALIZADO: 'realizado',
  CANCELADO: 'cancelado',
})

export const ESTADO_LABEL = Object.freeze({
  programado: 'Programado',
  sucedido: 'Sucedido',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
})

/** Tono de `ui/Badge` para cada estado. */
export const ESTADO_TONE = Object.freeze({
  programado: 'neutral',
  sucedido: 'warning',
  realizado: 'success',
  cancelado: 'danger',
})

export const ESTADO_OPCIONES = Object.values(ESTADOS_VUELO).map((value) => ({ value, label: ESTADO_LABEL[value] }))

export const CLASES = Object.freeze({ ECONOMICA: 'economica', PRIMERA: 'primera' })

export const CLASE_LABEL = Object.freeze({ economica: 'Económica', primera: 'Primera' })

export const CLASE_OPCIONES = Object.values(CLASES).map((value) => ({ value, label: CLASE_LABEL[value] }))

export const TIPO_LABEL = Object.freeze({ nacional: 'Nacional', internacional: 'Internacional' })

/** Órdenes aceptados por `GET /vuelos` (por defecto, salida ascendente). */
export const ORDEN_BUSQUEDA = [
  { value: 'fecha_asc', label: 'Fecha de salida (más próxima)' },
  { value: 'precio_asc', label: 'Precio (menor a mayor)' },
  { value: 'precio_desc', label: 'Precio (mayor a menor)' },
  { value: 'duracion_asc', label: 'Duración (menor a mayor)' },
  { value: 'duracion_desc', label: 'Duración (mayor a mayor)' },
]

/** Cupos por clase que el sistema asigna al programar un vuelo (D4, HU18). */
export const CAPACIDAD_POR_TIPO = Object.freeze({
  nacional: { economica: 125, primera: 25 }, // 150 en total
  internacional: { economica: 200, primera: 50 }, // 250 en total
})
