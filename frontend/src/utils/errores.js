// Normaliza errores del backend al formato único acordado:
//   { "error": { "code", "message", "fields" } }

export function extraerError(error) {
  const respuesta = error?.response?.data
  const apiError = respuesta?.error

  if (apiError) {
    return {
      code: apiError.code ?? 'ERROR',
      message: apiError.message ?? 'Ocurrió un error inesperado.',
      fields: apiError.fields ?? null,
    }
  }

  if (error?.response) {
    return {
      code: `HTTP_${error.response.status}`,
      message: 'El servidor respondió con un error. Intenta de nuevo.',
      fields: null,
    }
  }

  if (error?.request) {
    return {
      code: 'SIN_CONEXION',
      message: 'No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.',
      fields: null,
    }
  }

  return {
    code: 'DESCONOCIDO',
    message: error?.message ?? 'Ocurrió un error inesperado.',
    fields: null,
  }
}
