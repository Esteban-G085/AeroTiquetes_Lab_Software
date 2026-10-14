import { extraerError } from '../../utils/errores.js'

/**
 * Muestra un error ya sea en formato string o como respuesta de Axios.
 */
export default function ErrorAlert({ error, onReintentar }) {
  if (!error) return null
  const { code, message, fields } = typeof error === 'string' ? { code: 'ERROR', message: error, fields: null } : extraerError(error)

  return (
    <div className="alert alert-danger" role="alert">
      <div className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <strong className="d-block">{message}</strong>
          {fields && (
            <ul className="mb-0 mt-1 small">
              {Object.entries(fields).map(([campo, detalle]) => (
                <li key={campo}>
                  <span className="fw-semibold">{campo}:</span> {detalle}
                </li>
              ))}
            </ul>
          )}
          <span className="small texto-suave">Código: {code}</span>
        </div>
        {onReintentar && (
          <button type="button" className="btn btn-sm btn-outline-dark" onClick={onReintentar}>
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}
