import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/feedback'

export default function NotFoundPage() {
  return (
    <EmptyState
      title="Esta página no existe"
      message="Revisa la dirección o vuelve al buscador de vuelos."
      action={<Link to="/" className="btn btn-primary">Ir al inicio</Link>}
    />
  )
}
