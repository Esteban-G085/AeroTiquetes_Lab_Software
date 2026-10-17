import { Button, Icon, Spinner } from '@/components/ui'

/** Cargando: usar mientras se espera una respuesta de la API. */
export function LoadingState({ label = 'Cargando…' }) {
  return (
    <div className="at-state" role="status">
      <Spinner label={label} />
      <p className="at-state__text">{label}</p>
    </div>
  )
}

/** Error recuperable: explica qué pasó y permite reintentar. */
export function ErrorState({ title = 'No pudimos cargar la información', message, onRetry }) {
  return (
    <div className="at-state" role="alert">
      <span className="at-state__icon at-state__icon--warn"><Icon name="alert" size={26} /></span>
      <div className="at-state__title">{title}</div>
      {message && <p className="at-state__text">{message}</p>}
      {onRetry && <Button variant="outline-primary" onClick={onRetry}>Reintentar</Button>}
    </div>
  )
}

/** Vacío: ej. "No existen vuelos para tu búsqueda" (HU5). `action` es un botón opcional. */
export function EmptyState({ title, message, action, icon = 'plane' }) {
  return (
    <div className="at-state">
      <span className="at-state__icon"><Icon name={icon} size={26} /></span>
      <div className="at-state__title">{title}</div>
      {message && <p className="at-state__text">{message}</p>}
      {action}
    </div>
  )
}
