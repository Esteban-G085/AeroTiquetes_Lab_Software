import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/feedback'
import { HOME_BY_ROLE } from '@/config/roles'
import { useAuth } from '@/context'

export default function ForbiddenPage() {
  const { rol } = useAuth()
  return (
    <EmptyState
      title="No tienes acceso a esta sección"
      message="Tu rol no incluye este módulo."
      action={<Link to={HOME_BY_ROLE[rol]} className="btn btn-primary">Volver a mi inicio</Link>}
    />
  )
}
