import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState } from '@/components/feedback'
import { BackLink, PageHeader } from '@/components/layout'
import { VueloDetalle, VueloDetalleSkeleton } from '@/components/travel'
import useVueloAdmin from '../hooks/useVueloAdmin'
import '../vuelos.css'

/** HU19 — Consultar un vuelo programado (solo administrador). */
export default function ConsultarVueloPage() {
  const { id } = useParams()
  const { vuelo, status, error, recargar } = useVueloAdmin(id)

  const volver = <BackLink to="/admin/vuelos">Volver al panel</BackLink>

  if (status === 'loading') {
    return (
      <div className="vu-page">
        {volver}
        <VueloDetalleSkeleton />
      </div>
    )
  }

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
      {volver}

      <PageHeader
        eyebrow="Administración"
        title={`Vuelo ${vuelo.codigo}`}
        subtitle="Detalle del vuelo programado."
      />

      <VueloDetalle vuelo={vuelo} admin />
    </div>
  )
}
