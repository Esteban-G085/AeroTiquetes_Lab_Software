/**
 * Error normalizado de la API. El backend responde (definido por B2 en core/):
 *   { "error": { "code", "message", "fields" } }
 * El resto de la app solo conoce esta clase, nunca el error crudo de Axios.
 */
export class ApiError extends Error {
  constructor({ status = 0, code = 'UNKNOWN', message, fields = {} }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields // { campo: "mensaje" } -> se pasa al prop `error` de Input/Select
  }
}

const DEFAULT_MESSAGES = {
  401: 'Tu sesión no es válida. Inicia sesión de nuevo.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No encontramos lo que buscas.',
  500: 'Ocurrió un error en el servidor. Inténtalo más tarde.',
}

// Respaldo si algún endpoint devolviera el 422 nativo de FastAPI: { detail: [{ loc, msg }] }
const fieldsFromDetail = (detail) =>
  Array.isArray(detail)
    ? Object.fromEntries(detail.map((d) => [String(d.loc?.at(-1) ?? 'general'), d.msg]))
    : {}

export function toApiError(err) {
  if (err instanceof ApiError) return err
  if (!err.response) {
    return new ApiError({
      code: 'NETWORK_ERROR',
      message: 'No pudimos conectar con el servidor. Revisa tu conexión.',
    })
  }
  const { status, data } = err.response
  const body = data?.error
  return new ApiError({
    status,
    code: body?.code ?? `HTTP_${status}`,
    message: body?.message ?? DEFAULT_MESSAGES[status] ?? (status >= 500 ? DEFAULT_MESSAGES[500] : 'No se pudo completar la solicitud.'),
    fields: body?.fields ?? fieldsFromDetail(data?.detail),
  })
}
