import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState } from '@/components/feedback'
import { Button } from '@/components/ui'
import { BackLink, PageHeader } from '@/components/layout'
import { SkyArt } from '@/components/brand'
import { VueloDetalle, VueloDetalleSkeleton } from '@/components/travel'
import { ROLES } from '@/config/roles'
import { useAuth } from '@/context'
import useVuelo from '../hooks/useVuelo'
import '../busqueda.css'

/** HU5 — Detalle de un vuelo (visitante y cliente). La compra es de la Iteración 2. */
export default function DetalleVueloPage() {
  const { id } = useParams()
  const { vuelo, status, error, recargar } = useVuelo(id)
  const { rol, isAuthenticated } = useAuth()

  const volver = <BackLink to="/">Volver a los resultados</BackLink>

  if (status === 'loading') {
    return (
      <div className="bu-detail">
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
          message="El vuelo que buscas no existe o ya no está disponible."
          action={<Link className="btn btn-primary" to="/">Volver a la búsqueda</Link>}
        />
      )
    }
    return <ErrorState message={error?.message} onRetry={recargar} />
  }

  const esCliente = isAuthenticated && rol === ROLES.CLIENTE
  const ruta = vuelo?.origen?.nombre && vuelo?.destino?.nombre
    ? `${vuelo.origen.nombre} → ${vuelo.destino.nombre}`
    : undefined

  return (
    <div className="bu-detail">
      {volver}

      <div className="at-hero at-sky">
        <SkyArt variant="wide" />
        <PageHeader eyebrow="Detalle del vuelo" title={`Vuelo ${vuelo.codigo}`} subtitle={ruta} />
      </div>

      <VueloDetalle
        vuelo={vuelo}
        acciones={
          <>
            {esCliente && <Button disabled>Reservar / Comprar (próximo sprint)</Button>}
            {!isAuthenticated && <Link className="btn btn-primary" to="/login">Inicia sesión para reservar</Link>}
            {isAuthenticated && !esCliente && (
              <span className="bu-detail__note">
                Tu rol actual ({rol}) no puede reservar ni comprar tiquetes.
              </span>
            )}
          </>
        }
      />
    </div>
  )
}
