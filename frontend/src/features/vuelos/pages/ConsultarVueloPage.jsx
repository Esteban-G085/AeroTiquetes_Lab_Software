import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { VueloDetalle } from '@/components/travel'
import useVueloAdmin from '../hooks/useVueloAdmin'
import '../vuelos.css'

/** HU19 — Consultar un vuelo programado (solo administrador). */
export default function ConsultarVueloPage() {
  const { id } = useParams()
  const { vuelo, status, error, recargar } = useVueloAdmin(id)

  if (status === 'loading') return <LoadingState label="Cargando vuelo…" />

  if (status === 'error') {
    if (error?.status === 404) {
      return (
        <EmptyState
          title="Vuelo no encontrado"
          message="El vuelo consultado no existe o fue retirado del sistema."
          action={<Link className="btn btn-primary" to="/admin/vuelos">Volver al panel</Link>}
        />
      )
    }
    return <ErrorState message={error?.message} onRetry={recargar} />
  }

  return (
    <div className="vu-page">
      <Link className="vu-back" to="/admin/vuelos">
        <span aria-hidden="true">←</span> Volver al panel
      </Link>

      <PageHeader
        eyebrow="Administración"
        title={`Vuelo ${vuelo.codigo}`}
        subtitle="Detalle del vuelo programado."
      />

      <VueloDetalle vuelo={vuelo} admin />
    </div>
  )
}
